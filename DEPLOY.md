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

## 2. Create the Cloudflare Worker

The site runs on Cloudflare Workers through the OpenNext adapter (`wrangler.jsonc`, `open-next.config.ts`). It needs the **Workers Paid** plan ($5/month): the free plan's 10 ms CPU limit per request is too low for server-rendered pages.

1. Cloudflare → **Workers & Pages → Create → Import a repository** → pick the GitHub repo.
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Deploy command:** `npx opennextjs-cloudflare deploy`
   - **Production branch:** `main`
2. **Never deploy from your laptop.** The build copies every `.env*` file into the Worker, so a local deploy would ship your local secrets and test keys. `npm run deploy` refuses while a `.env` file exists.
3. **Every setting and key lives in Cloudflare, none in the repo.** Worker → Settings:
   - **Build → Variables and secrets:** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The build needs these three to make the pages.
   - **Variables and Secrets** (type **Secret**): all of the variables below, including those three again.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://reviewlabs.space` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project settings → API |
| `SUPABASE_SECRET_KEY` | Supabase → Project settings → API |
| `ENCRYPTION_KEY` | **The exact value the live site used.** Saved Meta tokens were encrypted with it; a different key makes them unreadable. |
| `CRON_SECRET` | The value already in the Supabase cron job (`supabase/cron.sql`) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | **Live** keys from Razorpay |
| `RAZORPAY_WEBHOOK_SECRET` | The secret in Razorpay's live webhook (step 5) |
| `RAZORPAY_PLAN_*_ID` | Plan ids from `node scripts/create-razorpay-plan.mjs` (live mode) |
| `RESEND_API_KEY` | Resend key |
| `EMAIL_FROM` | `Reviewlabs <no-reply@reviewlabs.space>` |
| `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `META_GRAPH_VERSION` | The Meta app (Instagram AutoDM) |

You don't need `DOWNLOAD_LINK_TTL_DAYS` or `DOWNLOAD_MAX_PER_GRANT`; the defaults are lifetime access and 50 downloads per link.

4. Deploy. When it finishes, open the `*.workers.dev` URL and check the home page loads.

To try a production build locally on the Workers runtime: `npm run preview` (http://localhost:8787, uses your `.env`).

---

## 3. Connect the domain

The domain's DNS has to live on Cloudflare for the Worker to serve it.

1. Cloudflare → **Add a domain** → `reviewlabs.space` (Free plan is fine for DNS).
2. **Before switching nameservers**, make sure every existing record is in Cloudflare's DNS list. Cloudflare imports most of them; check these by hand, set to **DNS only** (grey cloud):
   - `resend._domainkey` TXT (Resend DKIM)
   - `send` MX → `feedback-smtp.ap-northeast-1.amazonses.com` (priority 10)
   - `send` TXT → `v=spf1 include:amazonses.com ~all`
   - any Meta or Google verification TXT records

   Email stops working without the Resend records.
3. Worker → Settings → **Domains & Routes → Add → Custom domain** → `reviewlabs.space`. Add `www.reviewlabs.space` too, and a **Redirect Rule** sending `www` to the apex.
4. At the registrar (Hostinger), replace the nameservers with the two Cloudflare shows.
5. Wait until Cloudflare shows the domain as **Active**, then open https://reviewlabs.space.

---

## 4. Point Supabase at the live site

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://reviewlabs.space`
- **Redirect URLs:** add `https://reviewlabs.space/auth/callback`. Keep `http://localhost:3000/auth/callback` for local development.

Then **Authentication → Sign In / Providers → Email**:
- **Allow new users to sign up:** on
- **Confirm email:** on (users must verify before they can log in)
- **Minimum password length:** 8

And **Authentication → Emails → Templates**, paste from `supabase/templates/` (subjects are in its README):
- **Confirm signup** → `confirm-signup.html`
- **Reset password** → `reset-password.html`
- **Change email address** → `change-email.html`

Custom SMTP through Resend and the email rate limit were set up earlier.

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
   - **Settings → API Keys →** generate live keys and put them in the Worker (`NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
   - **Settings → Payment capture →** Automatic.
   - **Settings → Webhooks → Add:** URL `https://reviewlabs.space/api/webhooks/razorpay`, the secret = `RAZORPAY_WEBHOOK_SECRET` from the Worker, and the events `payment.captured`, `payment.authorized`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`, plus the subscription events `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `subscription.resumed`.
   - **Creator plan:** with the live keys in your local `.env`, run `node scripts/create-razorpay-plan.mjs` and put the printed ids in the Worker as `RAZORPAY_PLAN_MONTHLY_ID` and `RAZORPAY_PLAN_YEARLY_ID`.
   - **Subscriptions** must be enabled on your Razorpay account (Dashboard → Subscriptions). Ask Razorpay support if the menu isn't there.
   - Optional: **Settings → Branding →** upload `src/assets/logo-mark.svg` (as a PNG if it asks) so buyers see the logo in the payment popup.
3. Redeploy (Worker → **Deployments**, or push to `main`) so the new keys take effect.

Test-mode and live-mode webhooks are separate in Razorpay. Add the live one even if a test one exists.

---

## 6. Recovery job (every 15 minutes)

Supabase calls `/api/cron/reconcile` every 15 minutes to recover missed payments and send pending emails. To set it up:
1. Supabase → **Database → Extensions** → enable **pg_cron** and **pg_net**.
2. Open `supabase/cron.sql`, replace `PASTE_CRON_SECRET_HERE` with the Worker `CRON_SECRET`, and run it in the SQL editor.
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

- **New creators** sign up themselves at `/signup` and start on Free. Admin → a creator → **Grant Creator** gives a free period without a subscription.
- **Payouts:** Admin → Creators → a creator → pay them by UPI or bank → **Record payout** with the UTR.
- **Creator plan billing** runs through Razorpay Subscriptions. Renewals, failures and cancellations update accounts automatically, with the reconcile job as a safety net.
- **Logs:** Cloudflare → Worker → **Observability** (or `npx wrangler tail`). Payment problems show up there, and in the `webhook_events` and `meta_events` tables.
