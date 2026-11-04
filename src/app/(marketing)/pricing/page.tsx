import Link from "next/link";
import { CheckList, CtaBand, Faq, Icon, PageHero, Section, SectionHead } from "@/components/marketing";
import { buttonClass, cx, tableClass } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { creatorFeatures, GATEWAY_FEE_LABEL, planMatrix, priceLabel, proFeatures, yearlySaving, type PlanCell, type Tier } from "@/lib/plans";

export const metadata = { title: "Pricing" };

function Cell({ value }: { value: PlanCell }) {
  if (value === true) return <Icon name="check" className="mx-auto size-5 text-up" />;
  if (value === false) return <span className="text-muted-soft" aria-label="Not included">–</span>;
  return <span className="text-[14px] font-medium">{value}</span>;
}

// Razorpay's charge (about 2% + 18% GST); the actual amount per payment can vary slightly.
const gateway = (paise: number) => Math.round((paise * 236) / 10000);

function Prices({ tier, dark }: { tier: Tier; dark?: boolean }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className={cx("rounded-2xl p-4", dark ? "bg-dark-elevated" : "bg-surface-soft")}>
        <p className={cx("text-[13px]", dark ? "text-on-dark-soft" : "text-body")}>Monthly</p>
        <p className="display mt-1 text-[32px]">{priceLabel(tier, "month")}</p>
        <p className={cx("text-[12px]", dark ? "text-on-dark-soft" : "text-muted")}>per month · incl. GST</p>
      </div>
      <div className={cx("rounded-2xl p-4 ring-1", dark ? "bg-dark-elevated ring-primary/60" : "bg-surface-soft ring-primary/30")}>
        <p className={cx("flex items-center justify-between text-[13px]", dark ? "text-on-dark-soft" : "text-body")}>
          Yearly <span className="rounded-full bg-up/20 px-2 py-0.5 text-[11px] font-semibold text-up">Save {yearlySaving(tier)}</span>
        </p>
        <p className="display mt-1 text-[32px]">{priceLabel(tier, "year")}</p>
        <p className={cx("text-[12px]", dark ? "text-on-dark-soft" : "text-muted")}>2 months free · incl. GST</p>
      </div>
    </div>
  );
}

export default function Pricing() {
  const rows = [9900, 29900, 49900, 99900, 199900].map((price) => ({ price, gateway: gateway(price), keep: price - gateway(price) }));
  return (
    <>
      <PageHero
        kicker="Pricing"
        title="0% platform fee. Keep what you sell."
        sub={`Two simple plans, and we never take a cut of your sales. The only deduction is Razorpay's payment charge (${GATEWAY_FEE_LABEL}), passed on at cost. All prices include GST.`}
      />

      <Section className="pt-4 md:pt-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Creator */}
          <div className="flex flex-col rounded-3xl border border-hairline p-8">
            <p className="text-[18px] font-semibold">Creator</p>
            <p className="mt-1 text-[15px] text-body">Everything you need to sell digital products.</p>
            <Prices tier="creator" />
            <p className="mt-4 text-[15px] text-body"><b className="text-ink">0%</b> platform fee on every sale</p>
            <Link href="/signup" className={cx(buttonClass.secondary, "mt-6 h-12 w-full")}>Get started</Link>
            <div className="mt-8"><CheckList items={creatorFeatures} /></div>
          </div>

          {/* Pro */}
          <div className="relative flex flex-col overflow-hidden rounded-3xl bg-dark p-8 text-white">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary/40 blur-[100px]" />
            <div className="relative flex flex-1 flex-col">
              <div className="flex items-center gap-3">
                <p className="text-[18px] font-semibold">Pro</p>
                <span className="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold">Grow faster</span>
              </div>
              <p className="mt-1 text-[15px] text-on-dark-soft">AutoDM, email broadcasts, coupons, order bumps and analytics that show what sells.</p>
              <Prices tier="pro" dark />
              <p className="mt-4 text-[15px] text-on-dark-soft"><b className="text-white">0%</b> platform fee on every sale</p>
              <Link href="/signup" className={cx(buttonClass.primary, "mt-6 h-12 w-full")}>Get started</Link>
              <div className="mt-8"><CheckList dark items={proFeatures} /></div>
            </div>
          </div>

          {/* Custom */}
          <div className="flex flex-col rounded-3xl border border-hairline bg-surface-soft p-8">
            <p className="text-[18px] font-semibold">Custom</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="display text-[44px]">Let&apos;s talk</span>
            </p>
            <p className="text-[15px] text-body">For high-volume sellers, coaches and businesses.</p>
            <Link href="/custom" className={cx(buttonClass.dark, "mt-8 h-12 w-full bg-ink")}>Tell us your requirements</Link>
            <div className="mt-8">
              <CheckList
                items={[
                  "Help setting up your pages and files",
                  "Moving your products from another platform",
                  "Custom features for your business",
                  "Priority support on WhatsApp and email",
                ]}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHead center kicker="Compare plans" title="Everything in each plan." sub="Creator has everything you need to sell. Pro adds the tools that grow sales." />
        <div className="mx-auto mt-10 max-w-4xl overflow-x-auto rounded-3xl border border-hairline bg-canvas">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-hairline">
                <th className="px-5 py-4 font-semibold">Feature</th>
                <th className="w-40 px-4 py-4 text-center font-semibold">Creator</th>
                <th className="w-40 bg-primary-soft px-4 py-4 text-center font-semibold text-primary">Pro</th>
              </tr>
            </thead>
            {planMatrix.map((g) => (
              <tbody key={g.group}>
                <tr>
                  <th colSpan={3} className="bg-surface-soft px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-muted">{g.group}</th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.feature} className="border-b border-hairline-soft last:border-0">
                    <td className="px-5 py-3.5 text-body">{r.feature}</td>
                    <td className="px-4 py-3.5 text-center"><Cell value={r.creator} /></td>
                    <td className="bg-primary-soft/40 px-4 py-3.5 text-center"><Cell value={r.pro} /></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Section>

      <Section tone="soft">
        <SectionHead
          kicker="The maths"
          title="What you keep from each sale."
          sub="We take 0%. Razorpay charges about 2% plus GST on each payment, and that's passed on at exactly what Razorpay charges us."
        />
        <div className={cx(tableClass.wrap, "mt-10")}>
          <table className={tableClass.table}>
            <thead>
              <tr>
                <th className={tableClass.th}>Price</th>
                <th className={`${tableClass.th} text-right`}>Platform fee</th>
                <th className={`${tableClass.th} text-right`}>Razorpay charge (approx.)</th>
                <th className={`${tableClass.th} text-right`}>You keep</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.price}>
                  <td className={`${tableClass.td} num`}>{formatPaise(r.price)}</td>
                  <td className={`${tableClass.td} num text-right text-up`}>₹0.00</td>
                  <td className={`${tableClass.td} num text-right text-body`}>{formatPaise(r.gateway)}</td>
                  <td className={`${tableClass.td} num text-right text-up`}>{formatPaise(r.keep)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] text-muted">
          The exact Razorpay charge depends on the payment method and is shown on every sale in your earnings. Your plan is billed separately and never taken from your earnings.
        </p>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHead kicker="Questions" title="Pricing, answered." />
          <Faq
            items={[
              { q: "Is there a free trial?", a: "No. Create your account, choose Creator or Pro, and your dashboard unlocks straight away. You can cancel any time." },
              { q: "Do you take a cut of my sales?", a: `No. The platform fee is 0% on both plans. The only deduction is Razorpay's payment charge (${GATEWAY_FEE_LABEL}: about 2% plus 18% GST), which we pass on at exactly what Razorpay charges us. You see it on every sale in your earnings.` },
              { q: "What's the difference between Creator and Pro?", a: "Creator has everything you need to sell: unlimited products and lead magnets, your storefront, checkout, instant delivery, a sales dashboard, GST invoices and payouts. Pro adds the tools that grow sales: AutoDM (comment a keyword, get the link by DM), coupons, an add-on offer at checkout, advanced analytics with conversion and traffic sources, and no \"Made with Reviewlabs\" badge." },
              { q: "Do plan prices include GST?", a: `Yes. ${priceLabel("creator", "month")} a month or ${priceLabel("creator", "year")} a year for Creator, and ${priceLabel("pro", "month")} a month or ${priceLabel("pro", "year")} a year for Pro, are the full amounts you pay.` },
              { q: "Monthly or yearly?", a: `Yearly costs the same as 10 months, so you get 2 months free: ${yearlySaving("creator")} saved on Creator and ${yearlySaving("pro")} on Pro. Both renew automatically by autopay and can be cancelled from Plan and billing.` },
              { q: "When do I get paid?", a: "When you ask. Request a payout from Earnings once you have ₹500 or more available (sales become available 24 hours after they happen), and we send it to the bank account you added. Each payout shows in your earnings with its UTR number." },
              { q: "What happens if I cancel?", a: "You keep your plan until the end of the period you paid for. After that your store goes offline until you subscribe again. Nothing is deleted." },
              { q: "Who pays for refunds?", a: "Refunds come out of your balance. Razorpay keeps its charge on refunded payments, so that charge isn't returned." },
              { q: "Can I switch between Creator and Pro?", a: "Upgrade to Pro any time from Plan and billing, in one click. You pay only the difference for the days left in your current period, Pro turns on straight away, and your billing date stays the same. To move from Pro to Creator, write to us." },
              { q: "Do you offer custom pricing?", a: "Yes. If you sell at high volume or need help setting up, tell us your requirements on the Custom plan page and we'll get back to you." },
            ]}
          />
        </div>
      </Section>

      <CtaBand title="Put your first product online today." sub="0% platform fee. Cancel any time." primary={{ href: "/signup", label: "Get started" }} secondary={{ href: "/custom", label: "Custom plan" }} />
    </>
  );
}
