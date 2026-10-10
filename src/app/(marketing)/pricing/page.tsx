import Link from "next/link";
import { CheckList, CtaBand, Faq, PageHero, Section, SectionHead } from "@/components/marketing";
import { buttonClass, cx, tableClass } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { COMMISSION_PERCENT, CREATOR_PRICE_PAISE, creatorFeatures, freeFeatures } from "@/lib/plans";

export const metadata = { title: "Pricing" };

const plan = formatPaise(CREATOR_PRICE_PAISE).replace(".00", "");

function example(pricePaise: number) {
  const gateway = Math.round(pricePaise * 0.02 * 1.18);
  const platform = Math.round((pricePaise * COMMISSION_PERCENT) / 100);
  return { price: pricePaise, gateway, platform, keep: pricePaise - gateway - platform };
}

export default function Pricing() {
  const rows = [9900, 29900, 49900, 99900].map(example);
  return (
    <>
      <PageHero
        kicker="Pricing"
        title="Start free. Upgrade when you grow."
        sub={`Sell your first product on the Free plan. Move to Creator for ${plan} a month when you want more pages and the growth tools. Both plans have a simple ${COMMISSION_PERCENT}% fee per sale.`}
      />

      <Section className="pt-4 md:pt-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-hairline p-8 sm:p-10">
            <p className="text-[18px] font-semibold">Free</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="display text-[64px]">₹0</span>
              <span className="text-[16px] text-body">/ month</span>
            </p>
            <p className="text-[15px] text-body">{COMMISSION_PERCENT}% platform fee per sale</p>
            <Link href="/signup" className={cx(buttonClass.secondary, "mt-8 h-14 w-full px-8 sm:w-auto")}>Start for free</Link>
            <div className="mt-8"><CheckList items={freeFeatures} /></div>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-dark p-8 text-white sm:p-10">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary/40 blur-[100px]" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <p className="text-[18px] font-semibold">Creator</p>
                <span className="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold">Most popular</span>
              </div>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="display text-[64px]">{plan}</span>
                <span className="text-[16px] text-on-dark-soft">/ month</span>
              </p>
              <p className="text-[15px] text-on-dark-soft">{COMMISSION_PERCENT}% platform fee per sale · UPI autopay or card · cancel any time</p>
              <Link href="/signup" className={cx(buttonClass.hero, "mt-8 w-full sm:w-auto")}>Start free, upgrade anytime</Link>
              <div className="mt-8"><CheckList dark items={["Everything in Free", ...creatorFeatures]} /></div>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="soft">
        <SectionHead
          kicker="The maths"
          title="What you keep from each sale."
          sub={`Two fees per sale: Razorpay's gateway fee (about 2% plus GST on the fee for most UPI and Indian cards) and our ${COMMISSION_PERCENT}% platform fee. Nothing else.`}
        />
        <div className={cx(tableClass.wrap, "mt-10")}>
          <table className={tableClass.table}>
            <thead>
              <tr>
                <th className={tableClass.th}>Price</th>
                <th className={`${tableClass.th} text-right`}>Razorpay fee</th>
                <th className={`${tableClass.th} text-right`}>Platform fee ({COMMISSION_PERCENT}%)</th>
                <th className={`${tableClass.th} text-right`}>You keep</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.price}>
                  <td className={`${tableClass.td} num`}>{formatPaise(r.price)}</td>
                  <td className={`${tableClass.td} num text-right text-body`}>−{formatPaise(r.gateway)}</td>
                  <td className={`${tableClass.td} num text-right text-body`}>−{formatPaise(r.platform)}</td>
                  <td className={`${tableClass.td} num text-right text-up`}>{formatPaise(r.keep)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] text-muted">Gateway fees are approximate and set by Razorpay. The exact fees for each sale are shown in your ledger. The Creator subscription is billed separately and never taken from your earnings.</p>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHead kicker="Questions" title="Pricing, answered." />
          <Faq
            items={[
              { q: "Is the Free plan really free?", a: `Yes. There's no monthly charge. You pay only the ${COMMISSION_PERCENT}% platform fee and Razorpay's gateway fee when you make a sale.` },
              { q: "What's the difference between Free and Creator?", a: "Free gives you one product page with checkout, delivery, orders and payouts. Creator adds unlimited pages, coupons, page analytics, Meta Pixel and Conversions API, and CSV export." },
              { q: `Why is there a ${COMMISSION_PERCENT}% fee on both plans?`, a: "It covers delivery, storage, emails and support for every sale. It's the same on both plans, so upgrading is only about the extra features." },
              { q: "How do I pay for Creator?", a: "Through Razorpay with UPI autopay or a card. It renews monthly and you can cancel any time from Plan and billing." },
              { q: "What happens if I cancel?", a: "You keep Creator until the end of the month you paid for. Then you move to Free: your oldest live page stays live and the others become drafts. Nothing is deleted, and upgrading again lets you publish them." },
              { q: "Who pays for refunds?", a: `Refunds come out of your balance, and we return the ${COMMISSION_PERCENT}% platform fee on the refunded amount. Razorpay keeps its gateway fee on refunded payments.` },
            ]}
          />
        </div>
      </Section>

      <CtaBand title="Put your first product online today." sub="Free to start. No card needed." primary={{ href: "/signup", label: "Start for free" }} secondary={{ href: "/features", label: "See features" }} />
    </>
  );
}
