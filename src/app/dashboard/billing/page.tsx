import Link from "next/link";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { canUpgradeInOneClick, creatorFeatures, currentTier, isNewAccount, upgradeQuote, GATEWAY_FEE_LABEL, planName, platformFeePercent, priceLabel, proFeatures, trialDaysLeft, yearlySaving, type Tier } from "@/lib/plans";
import { Notice, PageTitle, Panel, tableClass } from "@/components/ui";
import { CheckList } from "@/components/marketing";
import { BillingDetailsForm, CancelButton, PlanPicker, UpgradeButton, type PlanCard } from "./billing-client";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export const metadata = { title: "Plan and billing" };

const card = (tier: Tier): PlanCard => ({
  tier,
  prices: { month: priceLabel(tier, "month"), year: priceLabel(tier, "year") },
  saving: yearlySaving(tier),
  features: tier === "pro" ? proFeatures : creatorFeatures,
});

export default async function BillingPage() {
  const profile = await requireCreator();
  const tier = currentTier(profile);
  const daysLeft = trialDaysLeft(profile);
  const supabase = await createClient();
  const [{ data: payments }, { data: invoices }] = await Promise.all([
    supabase
      .from("subscription_payments")
      .select("id, razorpay_payment_id, razorpay_subscription_id, amount_paise, status, created_at, period_end")
      .order("created_at", { ascending: false })
      .limit(24),
    supabase.from("invoices").select("id, invoice_number, subscription_payment_id").order("issued_at", { ascending: false }).limit(24),
  ]);
  const invoiceFor = new Map((invoices ?? []).map((i) => [i.subscription_payment_id, i]));
  const periodEnd = profile.plan_current_period_end ? dateFmt.format(new Date(profile.plan_current_period_end)) : null;
  const trialEnd = profile.trial_ends_at ? dateFmt.format(new Date(profile.trial_ends_at)) : null;
  const paid = tier === "creator" || tier === "pro";
  const customFee = platformFeePercent(profile);
  const canUpgrade = tier === "creator" && canUpgradeInOneClick(profile);
  const quote = canUpgrade && profile.plan_current_period_end ? upgradeQuote(profile.plan_interval === "year" ? "year" : "month", new Date(profile.plan_current_period_end)) : null;

  return (
    <>
      <PageTitle sub={`Plan prices include GST. ${customFee ? `Your custom platform fee is ${customFee}% per sale` : "0% platform fee on every sale"}; Razorpay's payment charge (${GATEWAY_FEE_LABEL}) is passed on at cost.`}>
        Plan and billing
      </PageTitle>

      {profile.is_admin && <Notice>Admin accounts have every feature without a subscription.</Notice>}
      {tier === "trial" && (
        <Notice tone="info">
          <b>Free trial: {daysLeft} day{daysLeft === 1 ? "" : "s"} left</b> (until {trialEnd}). Your trial includes 1 product page and 1 lead magnet with checkout, delivery, your storefront and payouts. Choose Creator for unlimited pages, or Pro to add AutoDM, email broadcasts, coupons and more. Billing starts when the trial ends, and your store stays live.
        </Notice>
      )}
      {tier === "none" && isNewAccount(profile) ? (
        <Notice tone="info">
          <b>Choose a plan to get started.</b> Your plan unlocks your dashboard: product pages, lead magnets, your storefront and payouts. 0% platform fee on every sale.
        </Notice>
      ) : tier === "none" && !profile.is_admin && (
        <Notice tone="bad">
          <b>Your store is offline.</b> {profile.plan_status === "none" || profile.plan === "free" ? "Your free trial has ended." : "Your plan has ended."} Buyers can&apos;t open your pages, storefront or lead magnets until you choose a plan. Nothing has been deleted: everything comes back the moment you subscribe.
        </Notice>
      )}
      {profile.plan_status === "past_due" && (
        <Notice tone="warn">Your last renewal didn&apos;t go through. Razorpay will retry automatically; update your payment method in the Razorpay email if it keeps failing.</Notice>
      )}
      {profile.plan_status === "cancelling" && periodEnd && (
        <Notice tone="warn">Your plan is cancelled and ends on {periodEnd}. After that your store goes offline until you subscribe again.</Notice>
      )}

      {canUpgrade && quote && periodEnd && (
        <section id="upgrade" className="relative overflow-hidden rounded-3xl bg-dark p-8 text-white">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-60 rounded-full bg-primary/40 blur-[90px]" />
          <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-3">
              <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[12px] font-semibold">Upgrade to Pro</span>
              <p className="text-[22px] font-semibold">AutoDM, coupons, the add-on offer, advanced analytics and no badge.</p>
              <p className="max-w-xl text-[15px] text-on-dark-soft">
                Pay <b className="text-white">{formatPaise(quote.paise)}</b> now for the {quote.daysLeft} day{quote.daysLeft === 1 ? "" : "s"} left in this period. From {periodEnd} you pay {priceLabel("pro", profile.plan_interval === "year" ? "year" : "month")} a {profile.plan_interval === "year" ? "year" : "month"} instead of {priceLabel("creator", profile.plan_interval === "year" ? "year" : "month")}. Pro turns on straight away.
              </p>
            </div>
            <UpgradeButton label={`Upgrade for ${formatPaise(quote.paise)}`} />
          </div>
        </section>
      )}

      {paid && !profile.is_admin ? (
        <Panel title={`${planName(tier)} plan`}>
          <CheckList items={tier === "pro" ? proFeatures : creatorFeatures} />
          <p className="mt-5 text-[14px] text-body">
            {profile.plan_interval === "lifetime"
              ? "Lifetime plan. Paid once, no renewals."
              : <>
                  {profile.plan_interval === "year" ? "Yearly plan. " : "Monthly plan. "}
                  {profile.plan_status === "cancelling" ? `Ends on ${periodEnd}.` : periodEnd ? `Next charge on ${periodEnd}.` : "Active."}
                </>}
          </p>
          {tier === "creator" && !canUpgrade && (
            <p className="mt-2 text-[14px] text-body">Want AutoDM, coupons, the add-on offer and advanced analytics? <a href={`mailto:satyabrata@veyrnlabs.com?subject=Switch%20to%20Pro`} className="link">Write to us</a> and we&apos;ll move you to Pro.</p>
          )}
        </Panel>
      ) : !profile.is_admin ? (
        <PlanPicker plans={[card("creator"), card("pro")]} inTrial={tier === "trial"} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-hairline bg-canvas p-6">
        <div>
          <p className="text-[17px] font-semibold">Need something bigger?</p>
          <p className="mt-1 text-[14px] text-body">Custom plans for high-volume sellers and businesses: setup help and custom features.</p>
        </div>
        <Link href="/custom" className="inline-flex h-11 items-center rounded-full bg-surface-strong px-5 text-[15px] font-semibold">Talk to us</Link>
      </div>

      {paid && !profile.is_admin && profile.plan_status !== "cancelling" && profile.razorpay_subscription_id && profile.plan_interval !== "lifetime" && (
        <Panel title="Cancel">
          <p className="mb-4 text-[14px] text-body">Cancelling stops future renewals. You keep {planName(tier)} until {periodEnd ?? "the end of this period"}; after that your store goes offline until you subscribe again.</p>
          <CancelButton planLabel={planName(tier)} />
        </Panel>
      )}

      {!profile.is_admin && (
        <Panel title="GST details for invoices">
          <p className="mb-5 text-[14px] text-body">Every plan payment comes with a GST tax invoice by email. These details are printed on invoices issued from now on.</p>
          <BillingDetailsForm initial={{ name: profile.billing_name ?? profile.name ?? "", gstin: profile.billing_gstin ?? "", stateCode: profile.billing_state_code ?? "", address: profile.billing_address ?? "" }} />
        </Panel>
      )}

      {!!payments?.length && (
        <div className={tableClass.wrap}>
          <table className={tableClass.table}>
            <thead>
              <tr>
                <th className={tableClass.th}>Date</th>
                <th className={tableClass.th}>Amount</th>
                <th className={tableClass.th}>Covers until</th>
                <th className={tableClass.th}>Invoice</th>
                <th className={tableClass.th}>Payment ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const inv = invoiceFor.get(p.id);
                return (
                  <tr key={p.razorpay_payment_id}>
                    <td className={tableClass.td}>{dateFmt.format(new Date(p.created_at))}</td>
                    <td className={`${tableClass.td} num`}>{formatPaise(p.amount_paise)}</td>
                    <td className={tableClass.td}>{p.period_end ? dateFmt.format(new Date(p.period_end)) : p.razorpay_subscription_id.startsWith("lifetime:") ? "Lifetime" : "-"}</td>
                    <td className={tableClass.td}>{inv ? <Link href={`/invoices/${inv.id}`} className="link num">{inv.invoice_number}</Link> : <span className="text-muted">Being prepared</span>}</td>
                    <td className={`${tableClass.td} num text-[12px] text-muted`}>{p.razorpay_payment_id}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
