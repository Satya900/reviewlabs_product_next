# Deploying Reviewlabs to reviewlabs.space

Follow these in order. Each step says where to do it and what to check.

---

## 1. Push the code to GitHub

1. Create an **empty private repository** on GitHub (no README, no .gitignore), e.g. `reviewlabs`.
2. In this folder:
   ```bash
   git remote add origin https://github.com/<you>/reviewlabs.git
   git push -u origin main
   ```
3. Check on GitHub that **no `.env` file** is in the repo. It is ignored by `.gitignore`; only `.env.example` should be there.

---

## 2. Create the Vercel project

1. Vercel → **Add New → Project** → import the GitHub repo. Framework: **Next.js** (auto-detected). Leave build settings as they are.
2. Before the first deploy, open **Environment Variables** and add every variable below for **Production** (and Preview if you use it).

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://reviewlabs.space` |
| `ENCRYPTION_KEY` | **The exact same value as your local `.env`.** Saved Meta tokens were encrypted with it; a different key makes them unreadable. |
| `CRON_SECRET` | A new random value: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as local |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same as local |
| `SUPABASE_SECRET_KEY` | Same as local |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | **Live** key id (`rzp_live_…`), see step 5. Use the test key until Razorpay activates live mode. |
| `RAZORPAY_KEY_SECRET` | **Live** key secret |
| `RAZORPAY_WEBHOOK_SECRET` | A new random value, also entered in Razorpay's live webhook (step 5) |
| `RESEND_API_KEY` | A **new** Resend key (the old one was shared in chat, so rotate it) |
| `EMAIL_FROM` | `Reviewlabs <no-reply@reviewlabs.space>` |
| `META_GRAPH_VERSION` | `v24.0` |

You don't need `DOWNLOAD_LINK_TTL_DAYS` or `DOWNLOAD_MAX_PER_GRANT`; the defaults are lifetime access and 50 downloads per link.

3. Click **Deploy**. When it finishes, open the `*.vercel.app` URL and check the home page loads.

---

## 3. Connect the domain

1. Vercel → Project → **Settings → Domains** → add `reviewlabs.space`, and also `www.reviewlabs.space` set to redirect to the apex.
2. Vercel shows the DNS records to add at your domain registrar (usually an `A` record to `76.76.21.21` for the apex and a `CNAME` to `cname.vercel-dns.com` for `www`).
3. **Do not delete the Resend DNS records** (`resend._domainkey`, the `send` subdomain MX and TXT records). Email stops working without them.
4. Wait until Vercel shows the domain as **Valid** with HTTPS, then open https://reviewlabs.space.

---

## 4. Point Supabase at the live site

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://reviewlabs.space`
- **Redirect URLs:** add `https://reviewlabs.space/auth/callback`. Keep `http://localhost:3000/auth/callback` for local development.

Already done earlier, nothing to change: custom SMTP through Resend, the branded email templates, and the email rate limit.

---

## 5. Razorpay live mode

1. **Activate live mode** (Razorpay dashboard → Account & Settings → activation form). When it asks for the website, give `https://reviewlabs.space`. The pages reviewers check are live:
   - https://reviewlabs.space/terms
   - https://reviewlabs.space/privacy
   - https://reviewlabs.space/refund-policy
   - https://reviewlabs.space/delivery-policy
   - https://reviewlabs.space/contact
   - https://reviewlabs.space/pricing
2. Once activated, switch the dashboard to **Live mode** and:
   - **Settings → API Keys →** generate live keys and put them in Vercel (`NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
   - **Settings → Payment capture →** Automatic.
   - **Settings → Webhooks → Add:** URL `https://reviewlabs.space/api/webhooks/razorpay`, the secret = `RAZORPAY_WEBHOOK_SECRET` from Vercel, and the events `payment.captured`, `payment.authorized`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.
   - Optional: **Settings → Branding →** upload `src/assets/logo-mark.svg` (as a PNG if it asks) so buyers see the logo in the payment popup.
3. Vercel → **Deployments → Redeploy** so the new keys take effect.

Test-mode and live-mode webhooks are separate in Razorpay. Add the live one even if a test one exists.

---

## 6. Fast recovery job (every 15 minutes)

Vercel's free plan only runs crons daily (`vercel.json` reconciles once a day at 2 am IST and charges the ₹99 plan on the 1st).
For 15-minute recovery of missed payments:
1. Supabase → **Database → Extensions** → enable **pg_cron** and **pg_net**.
2. Open `supabase/cron.sql`, replace `PASTE_CRON_SECRET_HERE` with the `CRON_SECRET` from Vercel, and run it in the SQL editor.
3. A few minutes later, run `select status_code from net._http_response order by created desc limit 3;`. You should see `200`.

---

## 7. Clear test data, then smoke-test with real money

1. **Clear test-mode transactions:** run `supabase/reset-test-data.sql` in the SQL editor. It keeps creators, pages, files, coupons and Meta settings. Run it **only before real sales start.**
2. **Meta:** in Dashboard → Settings, paste a **new** CAPI token and **clear the test event code**. Do the same on any page that has its own pixel.
3. **Live smoke test** on https://reviewlabs.space:
   - [ ] Log in. The sign-in email arrives from Reviewlabs.
   - [ ] Create a ₹1 page with a small file and set it Live.
   - [ ] Buy it with your own UPI or card (real ₹1).
   - [ ] The success page shows the file and the delivery email arrives with it attached.
   - [ ] Admin → Orders: the order is **paid**, with webhook events processed.
   - [ ] Refund it from Admin → Orders. You get the ₹1 back within a few days and the order shows **refunded**.
   - [ ] Meta Events Manager shows PageView, ViewContent, InitiateCheckout and Purchase.
4. Run `supabase/reset-test-data.sql` once more if you want the ₹1 test gone from the books, before any real buyer pays.

---

## Day-to-day after launch

- **Invite creators:** Admin → Invites → add their email, then they log in at `/login`.
- **Payouts:** Admin → Creators → a creator → pay them by UPI or bank → **Record payout** with the UTR.
- **Monthly plan fee:** charged automatically on the 1st. The Admin button does the same, and nobody is charged twice.
- **Logs:** Vercel → Project → **Logs**. Payment problems show up there, and in the `webhook_events` and `meta_events` tables.
