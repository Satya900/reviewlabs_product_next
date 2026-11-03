import Link from "next/link";
import type { ReactNode } from "react";
import { CheckList, CtaBand, Faq, Icon, PageHero, Section, SectionHead } from "@/components/marketing";
import { buttonClass, cx } from "@/components/ui";
import { GATEWAY_FEE_LABEL, PLAN_PRICES, priceLabel } from "@/lib/plans";
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
    { label: "Paid plan", us: `Creator ${priceLabel("creator", "month")}/month, Pro (with AutoDM) ${priceLabel("pro", "month")}/month, GST included; yearly gets 2 months free`, them: sp.indiaCreatorPrice },
    { label: "Platform fee per sale", us: <span className="font-medium">0%. Razorpay&apos;s charge ({GATEWAY_FEE_LABEL}) passed on at cost</span>, them: sp.indiaFeePerSale },
    { label: "Instagram AutoDM", us: "On Pro: comment a keyword, get the link by DM", them: yes },
    { label: "UPI, cards and netbanking", us: yes, them: yes },
    { label: "Instant download after payment", us: yes, them: yes },
    { label: "Files attached to the delivery email", us: "Up to 10 MB", them: null },
    { label: "Line-by-line earnings ledger", us: "Every sale, fee, refund and payout", them: null },
    { label: "Link-in-bio storefront", us: yes, them: yes },
    { label: "Lead magnets", us: "Unlimited on Creator, email verification codes", them: yes },
    { label: "Payouts", us: "On request from ₹500, to your bank, with UTR", them: sp.payouts },
    { label: "Import your Superprofile pages", us: <><span className="font-medium">Upload a saved page, get a draft in a minute.</span> <Link href="/import" className="link">How it works</Link></>, them: null },
    { label: "Free migration, done for you", us: "We move your products and files", them: null },
  ].filter((r) => r.them !== null || ["Platform fee per sale", "Files attached to the delivery email", "Line-by-line earnings ledger", "Import your Superprofile pages", "Free migration, done for you"].includes(r.label));

  return (
    <>
      <PageHero
        kicker="Compare"
        title="Reviewlabs vs Superprofile"
        sub={`Both let you sell digital products from one link. Reviewlabs takes 0% of your sales, costs ${priceLabel("creator", "month")}/month (${priceLabel("pro", "month")} with AutoDM) and shows every rupee in a ledger. Here's an honest look at both.`}
      >
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/signup" className={buttonClass.hero}>Get started</Link>
          <Link href="/import" className={cx(buttonClass.secondary, "h-14 px-8")}>Import your page</Link>
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
          <SavingsCalculator gatewayPercent={2.36} creatorPlan={PLAN_PRICES.creator.month / 100} proPlan={PLAN_PRICES.pro.month / 100} />
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-6">
            <SectionHead kicker="Why creators switch" title="Built for selling files in India." />
            <CheckList
              items={[
                "0% platform fee: we never take a cut of your sales",
                `${priceLabel("creator", "month")}/month, or ${priceLabel("pro", "month")}/month with Instagram AutoDM`,
                "Every sale, fee, refund and payout as a line in your ledger",
                "Files attached to the email, lifetime links buyers can resend themselves",
                "Import a Superprofile page yourself in a minute, or we move everything for you, free",
              ]}
            />
          </div>
          <div className="space-y-6 rounded-3xl border border-hairline p-8">
            <p className="text-[18px] font-semibold">Where Superprofile may suit you better</p>
            <p className="text-[15px] text-body">We&apos;d rather you pick the right tool. Superprofile offers things we don&apos;t yet:</p>
            <ul className="space-y-2 text-[15px] text-body">
              <li>• Courses and paid communities</li>
              <li>• Selling in multiple currencies</li>
            </ul>
            <p className="text-[15px] text-body">If you mainly sell ebooks, templates, presets or other files, Reviewlabs is built for exactly that.</p>
          </div>
        </div>
      </Section>

      <Section tone="soft">
        <SectionHead center kicker="Switching" title="Move over in minutes. Two ways to do it." />
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-2">
          <div className="space-y-5 rounded-3xl border border-hairline bg-canvas p-8">
            <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-[13px] font-semibold text-primary">New · Do it yourself</span>
            <p className="text-[22px] font-semibold">Import a page in about a minute</p>
            <ol className="space-y-3 text-[15px] text-body">
              <li><b className="text-ink">1. Save your page.</b> Open your product page on superprofile.bio on a laptop and press Ctrl+S (Cmd+S on a Mac), choosing “Webpage, Complete”.</li>
              <li><b className="text-ink">2. Upload the .html file.</b> Payment pages → Import from Superprofile. You see everything we found before anything is saved.</li>
              <li><b className="text-ink">3. Finish the draft.</b> Your text, prices, images, testimonials, FAQs, add-on offer and policies are already in. Upload your file and publish.</li>
            </ol>
            <Link href="/import" className={buttonClass.primary}>See the full guide</Link>
          </div>
          <div className="space-y-5 rounded-3xl border border-hairline bg-canvas p-8">
            <span className="inline-flex rounded-full bg-surface-strong px-3 py-1 text-[13px] font-semibold text-body">Done for you · Free</span>
            <p className="text-[22px] font-semibold">Or we move everything</p>
            <ol className="space-y-3 text-[15px] text-body">
              <li><b className="text-ink">1. Send us your link.</b> Email or DM us your Superprofile link. That&apos;s all we need to start.</li>
              <li><b className="text-ink">2. We rebuild your pages.</b> Titles, prices, covers, descriptions and files, set up on Reviewlabs. You review them.</li>
              <li><b className="text-ink">3. Swap the link.</b> Put your new page or storefront link in your bio and ads. Your old page keeps working until you switch it off.</li>
            </ol>
            <a href={migrateHref} className={buttonClass.secondary}>Request free migration</a>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-3xl text-center text-[15px] text-body">
          <span className="font-semibold text-ink">Selling on another platform?</span> Imports from other platforms are in development.{" "}
          <Link href="/import#other-platforms" className="link">Tell us which one you use</Link> and we&apos;ll build it sooner.
        </p>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHead kicker="Questions" title="Switching, answered." />
          <Faq
            items={[
              { q: "Can I import my Superprofile pages myself?", a: <>Yes. Save your product page from your browser and upload the file. You get a draft with your text, prices, images, testimonials, FAQs, add-on offer and policies in about a minute. <Link href="/import" className="link">Read the step-by-step guide</Link>.</> },
              { q: "Will my buyers lose access?", a: "No. People who bought on Superprofile keep their access there. New buyers get their files from Reviewlabs, instantly and by email." },
              { q: "Do I need my own payment gateway?", a: "No. Payments go through our Razorpay account. You add your bank account and request payouts from your balance, with the UTR in your ledger." },
              { q: "How often are payouts?", a: "Whenever you like. Request a payout from Earnings once you have ₹500 or more available (sales become available 24 hours after they happen), and we send it to your bank. Every payout shows in your ledger with its UTR." },
              { q: "Do you take a cut of my sales?", a: `No. The platform fee is 0%. Razorpay's payment charge (${GATEWAY_FEE_LABEL}) is passed on at exactly what it costs, and you see it on every sale.` },
            ]}
          />
        </div>
      </Section>

      <CtaBand title="Try it on one product first." sub="Import it yourself in a minute, or we'll move it over for you, free." primary={{ href: "/signup", label: "Get started" }} secondary={{ href: "/pricing", label: "See pricing" }} />

      <p className="mx-auto max-w-[1200px] px-5 pb-10 text-[12px] text-muted sm:px-8">
        Superprofile is a trademark of its owner. Reviewlabs is not affiliated with or endorsed by Superprofile. This comparison uses information from Superprofile&apos;s public website as of {sp.checkedOn}.
      </p>
    </>
  );
}
