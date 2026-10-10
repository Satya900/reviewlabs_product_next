import { CtaBand, FeatureCard, PageHero, Section, SectionHead } from "@/components/marketing";
import { site } from "@/lib/site";

export const metadata = { title: "About" };

export default function About() {
  return (
    <>
      <PageHero kicker="About" title="We make selling a file as simple as sharing one." sub={site.description} />

      <Section className="pt-4 md:pt-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <SectionHead kicker="Why we built it" title="The screenshot problem." />
          <div className="prose-body space-y-4 text-[18px] text-body">
            <p>
              A lot of creators in India still sell ebooks the slow way. Someone pays on UPI, sends a screenshot, and the
              creator emails the PDF by hand, sometimes hours later. It works until you have more than a handful of buyers.
            </p>
            <p>
              {site.name} replaces that with one page per product. Razorpay takes the payment, the file goes out on its own,
              and the sale lands in a ledger you can check. We keep the product small on purpose: pages, delivery, tracking
              and payouts, done carefully.
            </p>
            <p>
              {site.name} is built by {site.legalName}, founded by {site.founder}. Anyone can start
              for free, and we read every message that comes in.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="soft">
        <SectionHead center kicker="What we care about" title="Three promises." />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <FeatureCard icon="bolt" title="Buyers get what they paid for">Within seconds, every time, with access that does not run out.</FeatureCard>
          <FeatureCard icon="ledger" title="Creators see every rupee">No black-box balance. Every sale, fee, refund and payout is a line you can read.</FeatureCard>
          <FeatureCard icon="lock" title="We stay out of your sales">One flat fee per sale, no selling buyer data, no holding your earnings longer than needed.</FeatureCard>
        </div>
      </Section>

      <CtaBand title="Sell digital products? Come try it." primary={{ href: "/signup", label: "Start for free" }} />
    </>
  );
}
