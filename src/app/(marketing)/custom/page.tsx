import { CheckList, PageHero, Section } from "@/components/marketing";
import { site } from "@/lib/site";
import { CustomForm } from "./custom-form";

export const metadata = { title: "Custom plan" };

export default function CustomPlan() {
  return (
    <>
      <PageHero
        kicker="Custom plan"
        title="Selling at scale? Let's set it up together."
        sub="Tell us what you sell and what you need. We'll get back within one working day with a plan and pricing that fits."
      />
      <Section className="pt-4 md:pt-8">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-hairline bg-canvas p-6 shadow-soft sm:p-8">
            <CustomForm />
          </div>
          <aside className="space-y-6">
            <div className="rounded-3xl bg-dark p-8 text-white">
              <p className="text-[18px] font-semibold">What a custom plan can include</p>
              <div className="mt-6">
                <CheckList
                  dark
                  items={[
                    "Lower fees based on your monthly sales",
                    "We set up your pages, files and checkout for you",
                    "Custom features built for your business",
                    "Migration from Instamojo, Cosmofeed or Gumroad",
                    "Priority support on WhatsApp and email",
                  ]}
                />
              </div>
            </div>
            <div className="rounded-3xl border border-hairline p-6 text-[15px] text-body">
              Prefer email? Write to <a href={`mailto:${site.supportEmail}`} className="link">{site.supportEmail}</a>.
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
