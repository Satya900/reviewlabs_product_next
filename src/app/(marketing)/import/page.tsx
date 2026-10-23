import Link from "next/link";
import { CheckList, CtaBand, Faq, Icon, Kicker, PageHero, Section, SectionHead, Steps } from "@/components/marketing";
import { SaveSteps } from "@/components/import-guide";
import { buttonClass, cx } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata = {
  title: "Import from Superprofile",
  description: "Move a Superprofile product page to Reviewlabs in about a minute: save the page, upload it, and get a draft with your text, prices, images, testimonials and FAQs.",
  alternates: { canonical: "/import" },
};

const IMPORTED = [
  "Title and the buy button's text",
  "Price, and the original price shown crossed out",
  "Full description with headings, lists, links and images",
  "Cover image and every image in the description, copied to Reviewlabs",
  "Testimonials, with their names, ratings and photos",
  "FAQs",
  "Your own checkout questions (name, email and phone are always asked)",
  "Add-on offer, saved switched off until you add its file (Creator plan)",
  "Refund policy and terms",
];

const NOT_IMPORTED = [
  ["Your product files", "Superprofile doesn't put them on the page, so you upload them once in the editor."],
  ["Buyers, orders and sales", "Past buyers keep their access on Superprofile. New buyers get their files from Reviewlabs."],
  ["Your login, email, phone and earnings", "We only read the product fields above. Everything else in the saved file is ignored."],
  ["Coupons and tracking pixels", "Set these up again in a minute: coupons per page, and your Meta Pixel ID in settings."],
] as const;

export default function ImportGuide() {
  const otherPlatformHref = `mailto:${site.supportEmail}?subject=${encodeURIComponent("Import from another platform")}&body=${encodeURIComponent("Hi, I'd like to import my products from: \n\nMy product link: ")}`;
  const migrateHref = `mailto:${site.supportEmail}?subject=${encodeURIComponent("Free migration from Superprofile")}&body=${encodeURIComponent("Hi, I sell on Superprofile and want to move to Reviewlabs.\n\nMy Superprofile link: \nInstagram: \nWhat I sell: ")}`;

  return (
    <>
      <PageHero
        kicker="Import"
        title="Bring your Superprofile page over in about a minute."
        sub="Save your product page from your browser, upload the file to Reviewlabs, and get a ready-to-finish draft with your text, prices, images, testimonials, FAQs and policies. No copying and pasting."
      >
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/signup" className={buttonClass.hero}>Start free</Link>
          <Link href="/dashboard/pages/import" className={cx(buttonClass.secondary, "h-14 px-8")}>I have an account, import now</Link>
        </div>
      </PageHero>

      <Section className="pt-4 md:pt-8">
        <SectionHead kicker="The short version" title="Three steps, all in your browser." />
        <div className="mt-10">
          <Steps
            items={[
              { title: "Save your page", body: "Open your product page on superprofile.bio on a laptop or desktop and press Ctrl+S (Cmd+S on a Mac). Choose “Webpage, Complete”." },
              { title: "Upload the .html file", body: "In Reviewlabs, go to Payment pages → Import from Superprofile and choose the file. We show you everything we found before anything is saved." },
              { title: "Finish the draft", body: "Upload the file buyers get, check the price, and set the page to Live. Then swap the link in your bio." },
            ]}
          />
        </div>
      </Section>

      <Section tone="soft" id="save">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <SectionHead
            kicker="Step 1 in detail"
            title="How to save your page."
            sub="Pick your browser. It takes under ten seconds, and the saved file stays on your computer until you upload it."
          />
          <div className="rounded-3xl border border-hairline bg-canvas p-6 sm:p-8">
            <SaveSteps />
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <SectionHead kicker="Step 2 in detail" title="Upload and check." />
          <ol className="space-y-5 text-[16px] text-body">
            {[
              ["Open the importer", <>Log in and go to <b>Payment pages</b>, then <b>Import from Superprofile</b>. New here? <Link href="/signup" className="link">Create a free account</Link> first.</>],
              ["Choose or drop the .html file", "The file is read in your browser. If it isn't a Superprofile product page, we tell you straight away and what to do instead."],
              ["Review what we found", "You see the price, button text, description, testimonials, FAQs, checkout questions, add-on offer and policies, side by side with your cover."],
              ["Confirm it's your page and create the draft", "Tick the box to confirm the page is yours, then click Create draft page. Copying the images takes a few seconds."],
            ].map(([t, b], i) => (
              <li key={String(t)} className="flex gap-4">
                <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[14px] font-semibold text-primary">{i + 1}</span>
                <div>
                  <p className="text-[17px] font-semibold text-ink">{t}</p>
                  <p className="mt-1">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="soft">
        <SectionHead center kicker="What moves over" title="Everything on the page. Nothing private." />
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-hairline bg-canvas p-8">
            <p className="text-[18px] font-semibold">Imported for you</p>
            <div className="mt-5">
              <CheckList items={IMPORTED} />
            </div>
          </div>
          <div className="rounded-3xl border border-hairline bg-canvas p-8">
            <p className="text-[18px] font-semibold">Not imported</p>
            <ul className="mt-5 space-y-4">
              {NOT_IMPORTED.map(([t, b]) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-strong text-[14px] text-muted">–</span>
                  <div>
                    <p className="text-[16px] font-semibold">{t}</p>
                    <p className="text-[15px] text-body">{b}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <SectionHead kicker="Step 3 in detail" title="Before you publish." sub="Your import is always a draft, so nothing reaches buyers until you say so. The importer gives you this list at the end." />
          <ol className="space-y-3">
            {[
              ["Upload your product file", "PDFs, ZIPs, sheets, presets: whatever buyers get. Up to 10 MB files are also attached to the receipt email."],
              ["Check the price", "We read it from the saved page. If it was missing (for example from a Safari save), type it in."],
              ["Turn on the add-on offer", "If you had one, upload its file and switch it on. Add-on offers are part of the Creator plan."],
              ["Preview and set it Live", "Look it over on the phone preview, then set the page to Live and share the link."],
            ].map(([t, b]) => (
              <li key={t} className="flex gap-4 rounded-2xl border border-hairline p-5">
                <Icon name="check" className="mt-0.5 size-5 shrink-0 text-up" />
                <div>
                  <p className="text-[16px] font-semibold">{t}</p>
                  <p className="mt-1 text-[15px] text-body">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="dark" id="other-platforms">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent-yellow/15 px-3 py-1 text-[13px] font-semibold text-accent-yellow">
              <span className="size-2 animate-pulse rounded-full bg-accent-yellow" aria-hidden /> In development
            </span>
            <SectionHead dark title="Imports from other platforms are on the way." sub="Superprofile is the first. We're building imports for the other places Indian creators sell, so you can move everything in one go." />
          </div>
          <div className="space-y-5 rounded-3xl bg-dark-elevated p-8">
            <p className="text-[18px] font-semibold">Selling somewhere else today?</p>
            <p className="text-[16px] text-on-dark-soft">
              Tell us which platform, and send a link to one of your products. The platforms creators ask for most get built first, and we&apos;ll email you when yours is ready.
            </p>
            <p className="text-[16px] text-on-dark-soft">Until then, we&apos;ll move your products for you by hand, free.</p>
            <a href={otherPlatformHref} className={cx(buttonClass.outlineDark, "h-12 px-6")}>Tell us your platform</a>
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div className="space-y-4">
            <Kicker>Questions</Kicker>
            <h2 className="display text-[36px] sm:text-[44px]">Importing, answered.</h2>
          </div>
          <Faq
            items={[
              { q: "Is it free?", a: "Yes, on every plan. The Free plan includes one product page, so a Free account can import one page. The Creator plan has unlimited pages, and add-on offers come over too." },
              { q: "Can I do it on my phone?", a: "Not yet. Phone browsers save web pages in a format that leaves out the product details, so please save the page on a laptop or desktop. You can finish and publish the draft from your phone afterwards." },
              { q: "Can I import someone else's page?", a: "No. Only import pages you own. You confirm this before every import, and you need the rights to the text, images and testimonials you bring over." },
              { q: "Why save the page instead of pasting the link?", a: "Superprofile's pages are protected against automated access, and we respect that. Saving the page from your own browser, where you can already see it, means we never visit Superprofile on your behalf and never need your Superprofile login." },
              { q: "What happens to my Superprofile page?", a: "Nothing. Importing only reads the saved file. Your Superprofile page, buyers and sales stay as they are until you decide to switch it off." },
              { q: "The importer says my file isn't a Superprofile page.", a: "Make sure you saved the product page itself (superprofile.bio/vp/…), not your profile or the checkout. Upload the .html file, not the folder next to it, a .mhtml single file or a Safari Web Archive." },
              { q: "The price came through empty.", a: "Some saves, like Safari's Page Source, are made before Superprofile shows the price. The draft starts at ₹99 and the importer reminds you to set the right price before you publish." },
              { q: "Can you do it for me instead?", a: <>Yes. <a href={migrateHref} className="link">Email us your Superprofile link</a> and we&apos;ll move your products, covers and files for you, free.</> },
            ]}
          />
        </div>
      </Section>

      <CtaBand title="Move your first page today." sub="Free to start. Your draft is ready in about a minute." primary={{ href: "/signup", label: "Start free" }} secondary={{ href: "/compare/superprofile", label: "Compare with Superprofile" }} />

      <p className="mx-auto max-w-[1200px] px-5 pb-10 text-[12px] text-muted sm:px-8">
        Superprofile is a trademark of its owner. Reviewlabs is not affiliated with or endorsed by Superprofile.
      </p>
    </>
  );
}
