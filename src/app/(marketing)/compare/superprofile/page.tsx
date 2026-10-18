import Link from "next/link";
import type { ReactNode } from "react";
import { CheckList, CtaBand, Faq, Icon, PageHero, Section, SectionHead } from "@/components/marketing";
import { buttonClass, cx } from "@/components/ui";
import { CREATOR_FEE_PERCENT, CREATOR_LIFETIME_PAISE, CREATOR_PRICE_PAISE, FREE_FEE_PERCENT, priceLabels } from "@/lib/plans";
import { superprofile as sp } from "@/lib/competitors";
import { site } from "@/lib/site";
import { SavingsCalculator } from "./savings-calculator";

export const metadata = {
  title: "Reviewlabs vs Superprofile",
  description: "An honest comparison for Indian creators selling digital products: pricing, fees, delivery and payouts.",
  alternates: { canonical: "/compare/superprofile" },
};

type Row = { label: string; us: ReactNode; them: ReactNode | null };

const yes = <Icon name="check" className="mx-auto size-5 text-up" />;

export default function CompareSuperprofile() {
  const migrateHref = `mailto:${site.supportEmail}?subject=${encodeURIComponent("Free migration from Superprofile")}&body=${encodeURIComponent("Hi, I sell on Superprofile and want to move to Reviewlabs.\n\nMy Superprofile link: \nInstagram: \nWhat I sell: ")}`;
  const rows: Row[] = [
    { label: "Start selling in India for free", us: <span className="font-medium">Yes, on the Free plan</span>, them: sp.indiaSellingNeedsPaidPlan ? "Needs a paid plan" : null },
    { label: "Paid plan", us: `${priceLabels.monthly}/month (${priceLabels.intro} first month), ${priceLabels.yearly}/year, GST included`, them: sp.indiaCreatorPrice },
    { label: "Lifetime option", us: <span className="font-medium">{priceLabels.lifetime} once, no renewals</span>, them: null },
    { label: "Fee per sale", us: `${CREATOR_FEE_PERCENT}% on Creator, ${FREE_FEE_PERCENT}% on Free, payment gateway and GST included`, them: sp.indiaFeePerSale },
    { label: "UPI, cards and netbanking", us: yes, them: yes },
    { label: "Instant download after payment", us: yes, them: yes },
    { label: "Files attached to the delivery email", us: "Up to 10 MB", them: null },
    { label: "Line-by-line earnings ledger", us: "Every sale, fee, refund and payout", them: null },
    { label: "Link-in-bio storefront", us: yes, them: yes },
    { label: "Lead magnets", us: "Unlimited on Creator, email verification codes", them: yes },
    { label: "Meta Pixel and Conversions API", us: "Account-wide or per page", them: yes },
    { label: "Payouts", us: "Daily, to your UPI or bank, with UTR", them: sp.payouts },
    { label: "Free migration, done for you", us: "We move your products and files", them: null },
  ].filter((r) => r.them !== null || ["Lifetime option", "Files attached to the delivery email", "Line-by-line earnings ledger", "Free migration, done for you"].includes(r.label));

  return (
    <>
      <PageHero
        kicker="Compare"
        title="Reviewlabs vs Superprofile"
        sub={`Both let you sell digital products from one link. Reviewlabs lets you start selling for ₹0, costs ${priceLabels.monthly}/month (or ${priceLabels.lifetime} once, for life) and shows every rupee in a ledger. Here's an honest look at both.`}
      >
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/signup" className={buttonClass.hero}>Start free</Link>
          <a href={migrateHref} className={cx(buttonClass.secondary, "h-14 px-8")}>Get free migration</a>
        </div>
      </PageHero>

      <Section className="pt-4 md:pt-8">
        <div className="overflow-x-auto rounded-3xl border border-hairline bg-canvas">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-hairline">
                <th className="px-5 py-4 font-semibold"> </th>
                <th className="w-[38%] bg-primary-soft px-5 py-4 font-semibold text-primary">Reviewlabs</th>
                <th className="w-[30%] px-5 py-4 font-semibold">Superprofile</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-hairline-soft last:border-0">
                  <td className="px-5 py-4 text-body">{r.label}</td>
                  <td className="bg-primary-soft/40 px-5 py-4">{r.us}</td>
                  <td className="px-5 py-4 text-body">{r.them ?? <span className="text-muted-soft">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Superprofile details from their public pages, checked on {sp.checkedOn}. Prices change, so see <a href={sp.pricingUrl} className="link" rel="nofollow noopener" target="_blank">their pricing</a> for the latest. A dash means we didn&apos;t find it on their public pages.
        </p>
      </Section>

      <Section tone="soft">
        <SectionHead kicker="Do the maths" title="What would you keep?" sub="Enter your own numbers. We don't guess what you pay today." />
        <div className="mt-10">
          <SavingsCalculator creatorFee={CREATOR_FEE_PERCENT} creatorPlan={CREATOR_PRICE_PAISE / 100} lifetime={CREATOR_LIFETIME_PAISE / 100} />
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <SectionHead kicker="Why creators switch" title="Built for selling files in India." />
            <CheckList
              items={[
                "Start selling for ₹0. Upgrade only when it pays for itself",
                `${priceLabels.monthly}/month, or ${priceLabels.lifetime} once and never pay a plan again`,
                `One all-inclusive fee: ${CREATOR_FEE_PERCENT}% on Creator, payment gateway and GST already covered`,
                "Every sale, fee, refund and payout as a line in your ledger",
                "Files attached to the email, lifetime links buyers can resend themselves",
                "We move your products, covers and files for you, free",
              ]}
            />
          </div>
          <div className="space-y-6 rounded-3xl border border-hairline p-8">
            <p className="text-[18px] font-semibold">Where Superprofile may suit you better</p>
            <p className="text-[15px] text-body">We&apos;d rather you pick the right tool. Superprofile offers things we don&apos;t yet:</p>
            <ul className="space-y-2 text-[15px] text-body">
              <li>• Instagram AutoDM automation</li>
              <li>• Courses and paid communities</li>
              <li>• Selling in multiple currencies</li>
            </ul>
            <p className="text-[15px] text-body">If you mainly sell ebooks, templates, presets or other files, Reviewlabs is built for exactly that.</p>
          </div>
        </div>
      </Section>

      <Section tone="soft">
        <SectionHead center kicker="Switching" title="Move over in a day. We do the work." />
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            ["1. Send us your link", "Email or DM us your Superprofile link. That's all we need to start."],
            ["2. We rebuild your pages", "Titles, prices, covers, descriptions and files, set up on Reviewlabs. You review them."],
            ["3. Swap the link", "Put your new page or storefront link in your bio and ads. Your old page keeps working until you switch it off."],
          ].map(([t, b]) => (
            <div key={t} className="rounded-3xl border border-hairline bg-canvas p-6">
              <p className="text-[17px] font-semibold">{t}</p>
              <p className="mt-2 text-[15px] text-body">{b}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <a href={migrateHref} className={buttonClass.primary}>Request free migration</a>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHead kicker="Questions" title="Switching, answered." />
          <Faq
            items={[
              { q: "Will my buyers lose access?", a: "No. People who bought on Superprofile keep their access there. New buyers get their files from Reviewlabs, instantly and by email." },
              { q: "Do I need my own payment gateway?", a: "No. Payments go through our Razorpay account. You add your UPI ID or bank account and we pay your balance to it, with the UTR in your ledger." },
              { q: "How often are payouts?", a: "Every day. We send sales from at least 24 hours earlier to your UPI ID or bank account, once you have ₹100 or more. Every payout shows in your ledger with its UTR." },
              { q: "Can I keep my Meta Pixel?", a: `Yes, on Creator. Paste your Pixel ID and we send PageView, ViewContent, InitiateCheckout, Purchase and Lead events. Add a Conversions API token too and they're also sent from our server, so ad blockers don't hide sales.` },
              { q: "Is the lifetime plan really one payment?", a: `Yes. ${priceLabels.lifetime} once gives you Creator for as long as Reviewlabs runs, with no renewals.` },
            ]}
          />
        </div>
      </Section>

      <CtaBand title="Try it on one product first." sub="Free to start. We'll move it over for you." primary={{ href: "/signup", label: "Start free" }} secondary={{ href: "/pricing", label: "See pricing" }} />

      <p className="mx-auto max-w-[1200px] px-5 pb-10 text-[12px] text-muted sm:px-8">
        Superprofile is a trademark of its owner. Reviewlabs is not affiliated with or endorsed by Superprofile. This comparison uses information from Superprofile&apos;s public website as of {sp.checkedOn}.
      </p>
    </>
  );
}
