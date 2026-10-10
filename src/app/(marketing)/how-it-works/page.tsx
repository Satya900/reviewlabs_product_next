import { CheckList, CtaBand, FeatureCard, PageHero, Section, SectionHead, Steps } from "@/components/marketing";

export const metadata = { title: "How it works" };

export default function HowItWorks() {
  return (
    <>
      <PageHero
        kicker="How it works"
        title="From a file on your laptop to money in your account."
        sub="Here is exactly what happens for you, for your buyer, and behind the page."
      />

      <Section className="pt-4 md:pt-8">
        <SectionHead kicker="For you" title="Set up once." />
        <div className="mt-10">
          <Steps
            items={[
              { title: "Create your account", body: "Sign up with your email and a password, then click the link we email you to verify it. It's free." },
              { title: "Make your page", body: "Add a title, price, description, cover and the file. Turn it live when it looks right." },
              { title: "Share and get paid", body: "Post the link anywhere. Orders, analytics and your balance update on their own." },
            ]}
          />
        </div>
      </Section>

      <Section tone="soft">
        <SectionHead kicker="For your buyer" title="Paying takes under a minute." />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon="page" title="1. Open your link">They see your product, price and what&apos;s included.</FeatureCard>
          <FeatureCard icon="upi" title="2. Pay">Name, email, phone, then UPI, card or netbanking on Razorpay.</FeatureCard>
          <FeatureCard icon="bolt" title="3. Download">The download button appears straight away, and a receipt arrives by email.</FeatureCard>
          <FeatureCard icon="infinity" title="4. Come back anytime">Their link keeps working. Lost it? They get it again by email.</FeatureCard>
        </div>
      </Section>

      <Section tone="dark">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <SectionHead dark kicker="Behind the page" title="Built so nothing falls through." sub="Payments go wrong in small ways: a tab closes, a network drops, a bank is slow. This is how we handle those." />
          <CheckList
            dark
            items={[
              "An order only counts as paid after Razorpay confirms it to our server",
              "If the buyer closes the tab mid-payment, they still get their file once the money arrives",
              "Every 15 minutes we ask Razorpay about orders that haven't settled",
              "Receipts and Meta events are sent once, even when updates arrive twice",
              "Your earnings are a ledger: sales add a line, fees and refunds subtract one",
            ]}
          />
        </div>
      </Section>

      <CtaBand title="Want to sell your first file this week?" primary={{ href: "/signup", label: "Start for free" }} secondary={{ href: "/features", label: "See all features" }} />
    </>
  );
}
