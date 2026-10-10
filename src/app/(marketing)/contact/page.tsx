import { FeatureCard, PageHero, Section } from "@/components/marketing";
import { site } from "@/lib/site";

export const metadata = { title: "Contact us" };

export default function Contact() {
  return (
    <>
      <PageHero kicker="Contact" title="Talk to a person." sub="Questions about an order, a refund, or joining as a creator. We reply within one working day." />
      <Section className="pt-4 md:pt-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl bg-dark p-8 text-white md:col-span-1">
            <p className="text-[14px] text-on-dark-soft">Email us</p>
            <a href={`mailto:${site.supportEmail}`} className="mt-2 block break-all text-[20px] font-semibold">{site.supportEmail}</a>
            <p className="mt-4 text-[14px] text-on-dark-soft">Monday to Saturday, 10 am to 6 pm IST.</p>
          </div>
          <FeatureCard icon="spark" title="Start selling">
            Anyone can sign up. Create a free account at reviewlabs.space/signup and write to us if you get stuck setting up.
          </FeatureCard>
          <FeatureCard icon="mail" title="Help with an order">
            Include the order ID from your receipt email. For refunds, see our refund policy first; most requests are sorted the same day.
          </FeatureCard>
        </div>
        <div className="mt-6 rounded-3xl border border-hairline p-8">
          <p className="text-[16px] font-semibold">Complaints</p>
          <p className="mt-2 text-[15px] text-body">
            Write to <a href={`mailto:${site.supportEmail}`} className="link">{site.supportEmail}</a> with the subject line &quot;Complaint&quot;.
            We acknowledge complaints within 48 hours and resolve them within 30 days. {site.name} is a product of {site.legalName}, founded by {site.founder}.
          </p>
        </div>
      </Section>
    </>
  );
}
