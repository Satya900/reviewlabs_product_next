import Link from "next/link";
import { CheckList, CtaBand, Faq, Icon, PageHero, Section, SectionHead } from "@/components/marketing";
import { buttonClass, cx, tableClass } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { CREATOR_FEE_PERCENT, FREE_FEE_PERCENT, creatorFeatures, freeFeatures, planMatrix, priceLabels, type PlanCell } from "@/lib/plans";

export const metadata = { title: "Pricing" };

function Cell({ value }: { value: PlanCell }) {
  if (value === true) return <Icon name="check" className="mx-auto size-5 text-up" />;
  if (value === false) return <span className="text-muted-soft" aria-label="Not included">–</span>;
  return <span className="text-[14px] font-medium">{value}</span>;
}

function keep(pricePaise: number, percent: number) {
  const fee = Math.round((pricePaise * percent) / 100);
  return { fee, keep: pricePaise - fee };
}

export default function Pricing() {
  const rows = [9900, 29900, 49900, 99900, 199900].map((price) => ({ price, free: keep(price, FREE_FEE_PERCENT), creator: keep(price, CREATOR_FEE_PERCENT) }));
  return (
    <>
      <PageHero
        kicker="Pricing"
        title="Start free. Pay less per sale as you grow."
        sub={`Payment pages, a storefront and lead magnets on every plan. One all-inclusive fee per sale, with the payment gateway and GST covered: ${FREE_FEE_PERCENT}% on Free, ${CREATOR_FEE_PERCENT}% on Creator. All prices include GST. No setup fees, no hidden charges.`}
      />

      <Section className="pt-4 md:pt-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Free */}
          <div className="flex flex-col rounded-3xl border border-hairline p-8">
            <p className="text-[18px] font-semibold">Free</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="display text-[56px]">₹0</span>
              <span className="text-[16px] text-body">/ month</span>
            </p>
            <p className="text-[15px] text-body"><b className="text-ink">{FREE_FEE_PERCENT}%</b> per sale, gateway and GST included</p>
            <Link href="/signup" className={cx(buttonClass.secondary, "mt-8 h-12 w-full")}>Start for free</Link>
            <div className="mt-8"><CheckList items={freeFeatures} /></div>
          </div>

          {/* Creator */}
          <div className="relative flex flex-col overflow-hidden rounded-3xl bg-dark p-8 text-white">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary/40 blur-[100px]" />
            <div className="relative flex flex-1 flex-col">
              <div className="flex items-center gap-3">
                <p className="text-[18px] font-semibold">Creator</p>
                <span className="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold">Most popular</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-dark-elevated p-4">
                  <p className="text-[13px] text-on-dark-soft">Monthly</p>
                  <p className="display mt-1 text-[32px]">{priceLabels.monthly}</p>
                  <p className="text-[12px] text-on-dark-soft">First month {priceLabels.intro} · incl. GST</p>
                </div>
                <div className="rounded-2xl bg-dark-elevated p-4 ring-1 ring-primary/60">
                  <p className="flex items-center justify-between text-[13px] text-on-dark-soft">
                    Yearly <span className="rounded-full bg-up/20 px-2 py-0.5 text-[11px] font-semibold text-up">Save {priceLabels.saving}</span>
                  </p>
                  <p className="display mt-1 text-[32px]">{priceLabels.yearly}</p>
                  <p className="text-[12px] text-on-dark-soft">About 2 months free · incl. GST</p>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-2xl bg-dark-elevated p-4">
                  <div>
                    <p className="text-[13px] text-on-dark-soft">Lifetime</p>
                    <p className="display mt-1 text-[32px]">{priceLabels.lifetime}</p>
                  </div>
                  <p className="max-w-[9rem] text-right text-[12px] text-on-dark-soft">Pay once, incl. GST. Creator for good, no renewals.</p>
                </div>
              </div>
              <p className="mt-4 text-[15px] text-on-dark-soft"><b className="text-white">{CREATOR_FEE_PERCENT}%</b> per sale, gateway and GST included</p>
              <Link href="/signup" className={cx(buttonClass.primary, "mt-6 h-12 w-full")}>Start free, upgrade anytime</Link>
              <div className="mt-8"><CheckList dark items={["Everything in Free", ...creatorFeatures]} /></div>
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
                  "Lower fees for high sales volume",
                  "Help setting up your pages and files",
                  "Custom features for your business",
                  "Priority support on WhatsApp and email",
                ]}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHead center kicker="Compare plans" title="Everything in each plan." sub="Free has everything you need to start selling. Creator adds lower fees and the tools to grow." />
        <div className="mx-auto mt-10 max-w-4xl overflow-x-auto rounded-3xl border border-hairline bg-canvas">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-hairline">
                <th className="px-5 py-4 font-semibold">Feature</th>
                <th className="w-36 px-4 py-4 text-center font-semibold">Free</th>
                <th className="w-44 bg-primary-soft px-4 py-4 text-center font-semibold text-primary">Creator</th>
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
                    <td className="px-4 py-3.5 text-center"><Cell value={r.free} /></td>
                    <td className="bg-primary-soft/40 px-4 py-3.5 text-center"><Cell value={r.creator} /></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="mx-auto mt-4 max-w-4xl text-[13px] text-muted">Custom plans can include lower fees and set-up help. <Link href="/custom" className="link">Tell us what you need</Link>.</p>
      </Section>

      <Section tone="soft">
        <SectionHead
          kicker="The maths"
          title="What you keep from each sale."
          sub="One fee per sale, and the payment gateway charge is already inside it. What you see here is what lands in your balance."
        />
        <div className={cx(tableClass.wrap, "mt-10")}>
          <table className={tableClass.table}>
            <thead>
              <tr>
                <th className={tableClass.th}>Price</th>
                <th className={`${tableClass.th} text-right`}>Free ({FREE_FEE_PERCENT}%)</th>
                <th className={`${tableClass.th} text-right`}>Creator ({CREATOR_FEE_PERCENT}%)</th>
                <th className={`${tableClass.th} text-right`}>Extra you keep on Creator</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.price}>
                  <td className={`${tableClass.td} num`}>{formatPaise(r.price)}</td>
                  <td className={`${tableClass.td} num text-right text-body`}>{formatPaise(r.free.keep)}</td>
                  <td className={`${tableClass.td} num text-right text-up`}>{formatPaise(r.creator.keep)}</td>
                  <td className={`${tableClass.td} num text-right`}>+{formatPaise(r.creator.keep - r.free.keep)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] text-muted">
          Selling about ₹15,000 a month? Creator&apos;s lower fee alone covers the {priceLabels.monthly} plan. The Creator subscription is billed separately and never taken from your earnings.
        </p>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHead kicker="Questions" title="Pricing, answered." />
          <Faq
            items={[
              { q: "Is the Free plan really free?", a: `Yes. There's no monthly charge. You pay a ${FREE_FEE_PERCENT}% fee only when you make a sale, and that already includes Razorpay's charge.` },
              { q: "What does \"gateway and GST included\" mean?", a: "Razorpay charges a fee on every payment, and GST applies on top of fees. We pay both out of our fee, so you see one simple percentage and nothing else is deducted." },
              { q: "Do plan prices include GST?", a: `Yes. ${priceLabels.intro} for the first month, ${priceLabels.monthly} a month, ${priceLabels.yearly} a year and ${priceLabels.lifetime} for lifetime are the full amounts you pay. There is no GST added at checkout.` },
              { q: "When do I get paid?", a: "Every day. Payouts go to your UPI ID or bank account, for sales made at least 24 hours earlier, once you have ₹100 or more. Each payout shows in your earnings with its UTR number." },
              { q: "What's the difference between Free and Creator?", a: `Free gives you one product page, one lead magnet and your storefront, with checkout, delivery, testimonials, FAQ and daily payouts, at ${FREE_FEE_PERCENT}% per sale. Creator lowers the fee to ${CREATOR_FEE_PERCENT}% and adds unlimited pages and lead magnets, coupons, add-on offers, analytics, Meta Pixel and Conversions API, CSV export, and removes our branding.` },
              { q: "Is the storefront free?", a: "Yes, on every plan. You get reviewlabs.space/@yourname with your photo, bio, social links and all your products and lead magnets. On Free it shows a small Made with Reviewlabs badge; Creator hides it." },
              { q: "What are lead magnets and do they cost anything?", a: "A lead magnet is a free download, like a checklist or mini guide, that people get in exchange for their name and email. There's no fee because no money changes hands. Free includes one; Creator has unlimited. You can export the leads as CSV on any plan." },
              { q: "How does the first month work?", a: `If you've never had Creator, your first month is ${priceLabels.intro}. After that it's ${priceLabels.monthly} a month by autopay. You can cancel anytime before the month ends.` },
              { q: "Monthly, yearly or lifetime?", a: `Yearly is ${priceLabels.yearly}, which saves ${priceLabels.saving} compared with paying monthly for 12 months. Both renew automatically and can be cancelled from Plan and billing. Lifetime is a single ${priceLabels.lifetime} payment: Creator for good, with no renewals.` },
              { q: "What does lifetime include?", a: `Everything in Creator, including the ${CREATOR_FEE_PERCENT}% fee, for as long as Reviewlabs runs and your account is in good standing. Already on monthly or yearly? Switch from Plan and billing and your subscription is cancelled automatically.` },
              { q: "What happens if I cancel?", a: "You keep Creator until the end of the period you paid for. Then you move to Free: your oldest live page stays live and the others become drafts. Nothing is deleted." },
              { q: "Who pays for refunds?", a: "Refunds come out of your balance. The fee on a refunded sale isn't returned, because the payment gateway keeps its charge on refunds too." },
              { q: "Do you offer custom pricing?", a: "Yes. If you sell at high volume or need help setting up, tell us your requirements on the Custom plan page and we'll get back to you." },
            ]}
          />
        </div>
      </Section>

      <CtaBand title="Put your first product online today." sub="Free to start. No card needed." primary={{ href: "/signup", label: "Start for free" }} secondary={{ href: "/custom", label: "Custom plan" }} />
    </>
  );
}
