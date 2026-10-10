# Reviewlabs: payment pages + transactions

Creators sell digital files from a payment page. Buyers pay once with Razorpay and get lifetime access to their files by email. Anyone can sign up (email and password, verified) and starts on the Free plan (one page); the Creator plan (₹99/month via Razorpay Subscriptions) unlocks unlimited pages, coupons, analytics, Meta tracking and CSV export. Every sale carries a 2% platform fee. Money lands in the platform's Razorpay account, an append-only ledger tracks what each creator is owed, and the admin pays creators manually.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, Storage) · Razorpay · Meta Pixel + Conversions API · Resend

## How a payment flows

```
/p/[slug]  → POST /api/checkout       creates order (amount from DB) + Razorpay order, CAPI InitiateCheckout
           → Razorpay Checkout popup
           → POST /api/checkout/verify verifies signature, fetches payment, records it if captured
           → /p/[slug]/success         polls /api/orders/[id]/status, fires Pixel Purchase
Razorpay   → POST /api/webhooks/razorpay   source of truth: payment.captured / order.paid / refunds
cron       → /api/cron/reconcile      recovers missed webhooks, retries receipt + CAPI Purchase
```

The verify route, the webhook and the cron job all call the same Postgres function, `mark_order_paid`. It locks the order, checks the amount, writes the ledger rows keyed by payment ID, and creates the download grant. Running it any number of times gives the same result, and only one caller sees `newly_paid = true`, so the receipt and Purchase event go out once.

## Money model

Everything is stored in **paise** (integers). `ledger_entries` is append-only: a trigger blocks updates and deletes.

| Event | Ledger entry |
|---|---|
| Sale | `sale +amount` |
| Razorpay fee (incl. GST) | `gateway_fee −fee` |
| Refund processed | `refund −amount` |
| Monthly plan (₹99) | `subscription_fee −9900`, one per creator per month |
| Admin pays creator | `payout −amount` (with UTR) |
| Correction | `adjustment ±amount` |

Creator balance = `SUM(amount_paise)`, exposed through the `creator_balances` view.

## Setup

### 1. Environment
```bash
cp .env.example .env.local
openssl rand -base64 32   # → ENCRYPTION_KEY
openssl rand -hex 32      # → CRON_SECRET
```

### 2. Supabase
1. Create a project. Copy the URL, the **publishable** key and the **secret** key into `.env.local`.
2. Open the SQL editor and run every file in `supabase/migrations/` in order (`0001` to `0006`). Together they create the tables, Row Level Security policies, money functions, storage buckets, invites, coupons, analytics and per-page pixels.
3. Go to Authentication → URL Configuration. Set the Site URL to your app URL and add `http://localhost:3000/auth/callback` (plus your production URL) to the Redirect URLs.
4. Sign in once through `/login`, then make yourself the admin:
   ```sql
   update profiles set is_admin = true where email = 'you@example.com';
   ```
5. The product-file bucket limit is 50 MB, which is the free-plan maximum. On a paid plan, raise it in Storage settings and in `MAX_BYTES` in `files-manager.tsx`.

### 3. Razorpay (start in Test mode)
1. Go to Settings → API Keys and copy the key ID and secret.
2. Go to Settings → Payment capture and choose **Automatic**.
3. Go to Settings → Webhooks and add `https://<your-domain>/api/webhooks/razorpay` with a secret (`RAZORPAY_WEBHOOK_SECRET`). Enable these events:
   `payment.captured`, `payment.authorized`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`
4. For local testing, expose your dev server with a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) and use that URL for the webhook.

### 4. Email
Add a verified domain in Resend and set `RESEND_API_KEY` and `EMAIL_FROM`. Without a key, emails are printed to the server console.

### 5. Meta Pixel / CAPI (per creator)
Each creator enters their Pixel ID, CAPI access token and an optional test event code under **Dashboard → Settings**, then clicks **Send test event**. Tokens are encrypted with AES-256-GCM and never reach the browser.

| Event | Browser (Pixel) | Server (CAPI) | Shared event_id |
|---|---|---|---|
| PageView, ViewContent | page load | `/api/track` | random per view |
| InitiateCheckout | after order created | `/api/checkout` | `ic_<orderId>` |
| Purchase | success page | webhook / verify | `purchase_<orderId>` |

### 6. Run
```bash
npm run dev
```

### 7. Deploy
See **[DEPLOY.md](DEPLOY.md)** for the full production checklist: GitHub, Vercel, domain, Supabase URLs, Razorpay live mode, the 15-minute recovery job and the launch smoke test.

## Testing checklist (Razorpay test mode)
- [ ] Create a page, upload a file, set it Live, open `/p/<slug>`
- [ ] Pay with a test card / `success@razorpay` UPI → success page → download works
- [ ] Webhook shows in `webhook_events` with `processed_at` set; ledger has `sale` + `gateway_fee`
- [ ] Close the tab before the success page loads → order still becomes paid via webhook
- [ ] Refund from **Admin → Orders** → `refund.processed` → ledger `refund`; a full refund disables downloads
- [ ] Record a payout in **Admin → Creators** → balance drops
- [ ] Meta Events Manager → Test events shows browser + server events, deduplicated

## Project map
```
supabase/migrations/0001_init.sql   schema, RLS, money functions, storage
src/proxy.ts                        session refresh + /dashboard,/admin guard
src/lib/                            env, supabase clients, razorpay, crypto, meta, email, fulfilment
src/app/p/[slug]/                   public page, checkout form, success page
src/app/d/[token]/                  buyer download page
src/app/api/                        checkout, verify, webhooks, track, download, cron
src/app/dashboard/                  creator: pages, orders, earnings, settings
src/app/admin/                      creators, payouts, adjustments, refunds
```
