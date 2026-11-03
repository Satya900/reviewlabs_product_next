import Link from "next/link";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { creatorFeatures, currentTier, GATEWAY_FEE_LABEL, planName, platformFeePercent, priceLabel, proFeatures, trialDaysLeft, yearlySaving, type Tier } from "@/lib/plans";
import { Notice, PageTitle, Panel, tableClass } from "@/components/ui";
import { CheckList } from "@/components/marketing";
import { CancelButton, PlanPicker, type PlanCard } from "./billing-client";

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
  const { data: payments } = await supabase
    .from("subscription_payments")
    .select("razorpay_payment_id, razorpay_subscription_id, amount_paise, status, created_at, period_end")
    .order("created_at", { ascending: false })
    .limit(24);
  const periodEnd = profile.plan_current_period_end ? dateFmt.format(new Date(profile.plan_current_period_end)) : null;
  const trialEnd = profile.trial_ends_at ? dateFmt.format(new Date(profile.trial_ends_at)) : null;
  const paid = tier === "creator" || tier === "pro";
  const customFee = platformFeePercent(profile);

  return (
    <>
      <PageTitle sub={`Plan prices include GST. ${customFee ? `Your custom platform fee is ${customFee}% per sale` : "0% platform fee on every sale"}; Razorpay's payment charge (${GATEWAY_FEE_LABEL}) is passed on at cost.`}>
        Plan and billing
      </PageTitle>

      {profile.is_admin && <Notice>Admin accounts have every feature without a subscription.</Notice>}
      {tier === "trial" && (
        <Notice tone="info">
          <b>Free trial: {daysLeft} day{daysLeft === 1 ? "" : "s"} left</b> (until {trialEnd}). You have every feature, including AutoDM. Choose a plan to keep your store live after that.
        </Notice>
      )}
      {tier === "none" && !profile.is_admin && (
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
          {tier === "creator" && (
            <p className="mt-2 text-[14px] text-body">Want AutoDM? <a href={`mailto:satyabrata@veyrnlabs.com?subject=Switch%20to%20Pro`} className="link">Write to us</a> and we&apos;ll move you to Pro.</p>
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

      {!!payments?.length && (
        <div className={tableClass.wrap}>
          <table className={tableClass.table}>
            <thead>
              <tr>
                <th className={tableClass.th}>Date</th>
                <th className={tableClass.th}>Amount</th>
                <th className={tableClass.th}>Covers until</th>
                <th className={tableClass.th}>Payment ID</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.razorpay_payment_id}>
                  <td className={tableClass.td}>{dateFmt.format(new Date(p.created_at))}</td>
                  <td className={`${tableClass.td} num`}>{formatPaise(p.amount_paise)}</td>
                  <td className={tableClass.td}>{p.period_end ? dateFmt.format(new Date(p.period_end)) : p.razorpay_subscription_id.startsWith("lifetime:") ? "Lifetime" : "-"}</td>
                  <td className={`${tableClass.td} num text-[12px] text-muted`}>{p.razorpay_payment_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
