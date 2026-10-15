import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { CREATOR_FEE_PERCENT, FREE_FEE_PERCENT, creatorFeatures, feePercentFor, freeFeatures, hasCreatorPlan, priceLabels } from "@/lib/plans";
import { Badge, Notice, PageTitle, Panel, tableClass } from "@/components/ui";
import { CheckList } from "@/components/marketing";
import { CancelButton, LifetimeButton, PlanPicker } from "./billing-client";
import Link from "next/link";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export const metadata = { title: "Plan and billing" };

export default async function BillingPage() {
  const profile = await requireCreator();
  const onCreator = hasCreatorPlan(profile);
  const supabase = await createClient();
  const { data: payments } = await supabase
    .from("subscription_payments")
    .select("razorpay_payment_id, razorpay_subscription_id, amount_paise, status, created_at, period_end")
    .order("created_at", { ascending: false })
    .limit(24);
  const periodEnd = profile.plan_current_period_end ? dateFmt.format(new Date(profile.plan_current_period_end)) : null;
  const introEligible = !profile.intro_used && !payments?.length;
  const fee = feePercentFor(profile);

  return (
    <>
      <PageTitle sub={`Your fee per sale is ${fee}%, all-inclusive (Razorpay's charge is covered). Free is ${FREE_FEE_PERCENT}%, Creator is ${CREATOR_FEE_PERCENT}%.`}>Plan and billing</PageTitle>

      {profile.is_admin && <Notice>Admin accounts have every Creator feature without a subscription.</Notice>}
      {profile.plan_status === "past_due" && (
        <Notice tone="warn">Your last renewal didn&apos;t go through. Razorpay will retry automatically; update your payment method in the Razorpay email if it keeps failing.</Notice>
      )}
      {profile.plan_status === "cancelling" && periodEnd && (
        <Notice tone="warn">Your plan is cancelled and ends on {periodEnd}. After that you move to Free, and only your oldest live page stays live.</Notice>
      )}
      {["halted", "cancelled", "expired"].includes(profile.plan_status) && !onCreator && (
        <Notice tone="bad">Your Creator plan has ended. Pages beyond your first were moved to draft; upgrade again to publish them.</Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className={onCreator ? "rounded-3xl border border-hairline bg-canvas p-8" : "rounded-3xl border-2 border-primary bg-canvas p-8"}>
          <div className="flex items-center justify-between">
            <p className="text-[18px] font-semibold">Free</p>
            {!onCreator && <Badge status="live" label="Current plan" />}
          </div>
          <p className="mt-3 flex items-baseline gap-2"><span className="display text-[44px]">₹0</span><span className="text-body">/ month</span></p>
          <p className="mt-1 text-[14px] text-muted">{FREE_FEE_PERCENT}% per sale, Razorpay fees included</p>
          <div className="mt-6"><CheckList items={freeFeatures} /></div>
        </section>

        <section className="relative overflow-hidden rounded-3xl bg-dark p-8 text-white">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-60 rounded-full bg-primary/40 blur-[90px]" />
          <div className="relative space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-[22px] font-semibold">Creator</p>
              {onCreator && !profile.is_admin && <span className="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold">Current plan</span>}
            </div>
            {!onCreator ? (
              <PlanPicker
                monthly={priceLabels.monthly}
                yearly={priceLabels.yearly}
                lifetime={priceLabels.lifetime}
                intro={introEligible ? priceLabels.intro : null}
                saving={priceLabels.saving}
                features={["Everything in Free", ...creatorFeatures]}
              />
            ) : (
              <>
                <CheckList dark items={["Everything in Free", ...creatorFeatures]} />
                {!profile.is_admin && (
                  <p className="text-[14px] text-on-dark-soft">
                    {profile.plan_interval === "lifetime"
                      ? "Lifetime plan. Paid once, no renewals, ever."
                      : <>
                          {profile.plan_interval === "year" ? "Yearly plan. " : "Monthly plan. "}
                          {profile.plan_status === "cancelling" ? `Ends on ${periodEnd}.` : periodEnd ? `Next charge on ${periodEnd}.` : "Active."}
                        </>}
                  </p>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-hairline bg-canvas p-6">
        <div>
          <p className="text-[17px] font-semibold">Need something bigger?</p>
          <p className="mt-1 text-[14px] text-body">Custom plans for high-volume sellers and businesses: lower fees, setup help and custom features.</p>
        </div>
        <Link href="/custom" className="inline-flex h-11 items-center rounded-full bg-surface-strong px-5 text-[15px] font-semibold">Talk to us</Link>
      </div>

      {onCreator && !profile.is_admin && profile.plan_interval !== "lifetime" && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-primary bg-primary-soft/40 p-6">
          <div className="max-w-xl">
            <p className="text-[17px] font-semibold">Switch to lifetime for {priceLabels.lifetime}</p>
            <p className="mt-1 text-[14px] text-body">Pay once and keep Creator for good. Your current subscription is cancelled automatically, so you&apos;re never charged again.</p>
          </div>
          <div className="w-full sm:w-64"><LifetimeButton label={`Pay ${priceLabels.lifetime} once`} variant="secondary" /></div>
        </div>
      )}

      {onCreator && !profile.is_admin && profile.plan_status !== "cancelling" && profile.razorpay_subscription_id && (
        <Panel title="Cancel">
          <p className="mb-4 text-[14px] text-body">Cancelling stops future renewals. You keep Creator features until {periodEnd ?? "the end of this period"}.</p>
          <CancelButton />
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
