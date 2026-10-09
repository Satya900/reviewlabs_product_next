import Link from "next/link";
import { CheckList, CtaBand, Faq, PageHero, Section, SectionHead } from "@/components/marketing";
import { buttonClass, cx, tableClass } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { site } from "@/lib/site";

export const metadata = { title: "Pricing" };

const plan = formatPaise(site.creatorPlanPaise).replace(".00", "");

function example(pricePaise: number) {
  const fee = Math.round(pricePaise * 0.02 * 1.18);
  return { price: pricePaise, fee, keep: pricePaise - fee };
}

export default function Pricing() {
  const rows = [9900, 29900, 49900, 99900].map(example);
  return (
    <>
      <PageHero kicker="Pricing" title="One plan. No commission." sub={`${plan} a month, taken from your earnings. Every rupee of every sale is yours, minus Razorpay's gateway fee.`} />

      <Section className="pt-4 md:pt-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative overflow-hidden rounded-3xl bg-dark p-8 text-white sm:p-10">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-primary/40 blur-[100px]" />
            <div className="relative">
              <span className="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold">Everything included</span>
              <p className="mt-6 text-[18px] font-semibold">Creator plan</p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="display text-[72px]">{plan}</span>
                <span className="text-[16px] text-on-dark-soft">/ month</span>
              </p>
              <p className="text-[15px] text-on-dark-soft">No card to add. Cancel by writing to us.</p>
              <Link href="/contact" className={cx(buttonClass.hero, "mt-8 w-full sm:w-auto")}>Get an invite</Link>
            </div>
          </div>
          <div className="rounded-3xl border border-hairline p-8 sm:p-10">
            <p className="text-[18px] font-semibold">What you get</p>
            <div className="mt-6">
              <CheckList
                items={[
                  "Unlimited payment pages and unlimited sales",
                  "₹0 commission on every sale",
                  "Instant delivery with lifetime access for buyers",
                  "UPI, cards and netbanking through Razorpay",
                  "Coupons, custom checkout questions",
                  "Meta Pixel and Conversions API",
                  "Page analytics, orders, ledger and CSV export",
                  "Payouts to UPI or bank with UTR records",
                ]}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section tone="soft">
        <SectionHead kicker="The maths" title="What you keep from each sale." sub="Razorpay's fee is about 2% plus 18% GST on the fee for most UPI and Indian card payments. We add nothing on top." />
        <div className={cx(tableClass.wrap, "mt-10")}>
          <table className={tableClass.table}>
            <thead>
              <tr>
                <th className={tableClass.th}>Price</th>
                <th className={`${tableClass.th} text-right`}>Razorpay fee</th>
                <th className={`${tableClass.th} text-right`}>Our commission</th>
                <th className={`${tableClass.th} text-right`}>You keep</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.price}>
                  <td className={`${tableClass.td} num`}>{formatPaise(r.price)}</td>
                  <td className={`${tableClass.td} num text-right text-body`}>−{formatPaise(r.fee)}</td>
                  <td className={`${tableClass.td} num text-right text-body`}>{formatPaise(0)}</td>
                  <td className={`${tableClass.td} num text-right text-up`}>{formatPaise(r.keep)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] text-muted">Approximate. The exact fee for each sale is shown in your ledger. The {plan} plan fee is taken once a month, not per sale.</p>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHead kicker="Questions" title="Pricing, answered." />
          <Faq
            items={[
              { q: "Do you take a percentage of my sales?", a: `No. You pay ${plan} a month and nothing per sale. The only per-sale cost is Razorpay's gateway fee.` },
              { q: "How do I pay the monthly fee?", a: `We take ${plan} from your earnings balance at the start of each month. You never enter a card.` },
              { q: "What if I make no sales in a month?", a: "The fee still applies and your balance goes below zero. We settle it from your next sales. If you want to stop, write to us and we will close your account." },
              { q: "Who pays for refunds?", a: "Refunds come out of your balance. Razorpay keeps its gateway fee on refunded payments, so that fee stays a cost." },
              { q: "Are there setup fees or hidden charges?", a: "No setup fee, no payout fee from our side, and no limit on pages or sales." },
            ]}
          />
        </div>
      </Section>

      <CtaBand title="Keep what you earn." primary={{ href: "/contact", label: "Get an invite" }} secondary={{ href: "/how-it-works", label: "How it works" }} />
    </>
  );
}
