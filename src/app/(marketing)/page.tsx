import Link from "next/link";
import { CheckList, CtaBand, Faq, FeatureCard, Kicker, Section, SectionHead, Steps } from "@/components/marketing";
import { HeroMockups } from "@/components/hero-mockups";
import { buttonClass, cx } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { CREATOR_FEE_PERCENT, CREATOR_PRICE_PAISE, FREE_FEE_PERCENT, priceLabels } from "@/lib/plans";
import { site } from "@/lib/site";

const sellables = [
  "Ebooks and guides",
  "Notion templates",
  "Canva templates",
  "Lightroom presets",
  "Study notes",
  "Question banks",
  "Planners and worksheets",
  "Resume templates",
  "Recipe books",
  "Sample packs",
  "Fonts and design assets",
  "Workout plans",
];

const plan = formatPaise(CREATOR_PRICE_PAISE).replace(".00", "");

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-dark px-5 pb-20 pt-14 text-white sm:px-8 md:pb-28 md:pt-20">
        <div aria-hidden className="pointer-events-none absolute -left-32 top-10 size-[520px] rounded-full bg-primary/30 blur-[150px]" />
        <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 size-[420px] rounded-full bg-primary/20 blur-[140px]" />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-7">
            <Kicker dark>For creators in India</Kicker>
            <h1 className="display text-[44px] sm:text-[64px] lg:text-[80px]">Sell your ebook from a single link.</h1>
            <p className="max-w-xl text-[18px] text-on-dark-soft sm:text-[20px]">
              Make a payment page in about five minutes. Buyers pay with UPI or card and the file lands in their inbox.
              Add a link-in-bio storefront and free lead magnets to grow your list. Start free, one all-inclusive fee per sale, GST included.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className={buttonClass.hero}>Start for free</Link>
              <Link href="/how-it-works" className={cx(buttonClass.outlineDark, "h-14 px-8")}>See how it works</Link>
            </div>
            <dl className="grid max-w-lg grid-cols-3 gap-4 border-t border-dark-line pt-6">
              {[
                ["₹0", "to start selling"],
                ["Seconds", "from payment to file"],
                [`${FREE_FEE_PERCENT}%→${CREATOR_FEE_PERCENT}%`, "all-in fee per sale"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="num text-[22px] text-white sm:text-[26px]">{value}</dt>
                  <dd className="mt-1 text-[13px] text-on-dark-soft">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroMockups />
        </div>
      </section>

      {/* What you can sell */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <SectionHead
            kicker="What you can sell"
            title="If it fits in a file, it can have a price."
            sub="PDFs, ZIPs, audio, presets, spreadsheets. Upload it once and sell it to as many people as you like."
          />
          <ul className="flex flex-wrap gap-3">
            {sellables.map((s, i) => (
              <li
                key={s}
                className={cx(
                  "rounded-full px-5 py-3 text-[15px] font-medium",
                  i % 5 === 0 ? "bg-primary text-white" : "bg-surface-strong text-ink",
                )}
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Three steps */}
      <Section tone="soft">
        <SectionHead center kicker="How it works" title="Three steps, then it runs itself." />
        <div className="mt-14">
          <Steps
            items={[
              { title: "Make a page", body: "Add a title, a price, a cover and your file. Ask buyers extra questions if you need them." },
              { title: "Share the link", body: "Drop it in your bio, a reel caption, a YouTube description or a WhatsApp group." },
              { title: "Get paid", body: "Razorpay takes the payment, we send the file, and the sale shows up in your earnings." },
            ]}
          />
        </div>
      </Section>

      {/* Storefront + lead magnets */}
      <Section>
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="space-y-6">
            <SectionHead
              kicker="One link for everything"
              title="Your storefront and your email list, on every plan."
              sub="Put reviewlabs.space/@yourname in your Instagram bio. Visitors see your photo, your socials and every product. Give away a free guide to collect emails, then sell to the people who asked for it."
            />
            <CheckList
              items={[
                "Link-in-bio storefront with your photo, bio and social links",
                "Lead magnets: a free file in exchange for a name and email",
                "Email verification codes so your list stays real",
                "Recommend a paid product on the thank-you screen",
                "Export every lead as a CSV, on any plan",
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-[28px] border-[6px] border-ink bg-[radial-gradient(ellipse_at_top,#eef3ff_0%,#f7f7f7_55%)] p-4">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0052ff,#7aa5ff)] text-[22px] font-semibold text-white">A</div>
              <p className="mt-2 text-center text-[14px] font-semibold">Ananya Designs</p>
              <p className="text-center text-[11px] text-muted">@ananya.designs</p>
              <div className="mt-3 space-y-2">
                <div className="overflow-hidden rounded-2xl bg-canvas shadow-soft">
                  <div className="h-16 bg-[linear-gradient(135deg,#0052ff,#7aa5ff)]" />
                  <div className="flex items-center justify-between p-2.5 text-[11px]"><span className="font-semibold">Canva carousel pack</span><span className="num">₹399</span></div>
                </div>
                {[["Notion planner", "₹249"], ["Free brand checklist", "Free"]].map(([t, p]) => (
                  <div key={t} className="flex items-center justify-between rounded-xl bg-canvas p-2.5 text-[11px] shadow-soft">
                    <span className="font-medium">{t}</span>
                    <span className={p === "Free" ? "rounded-full bg-[#e6f7ef] px-2 py-0.5 font-semibold text-up" : "num"}>{p}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center rounded-[28px] bg-[linear-gradient(160deg,#ff8a00_0%,#ff3d6e_55%,#8a1fa8_100%)] p-4">
              <div className="w-full overflow-hidden rounded-2xl bg-canvas shadow-float">
                <div className="h-14 bg-[linear-gradient(135deg,#ffd6e0,#c7d7ff)]" />
                <div className="space-y-2 p-3">
                  <p className="text-[12px] font-semibold leading-snug">Free brand checklist</p>
                  {["Your name", "Your email"].map((f) => <div key={f} className="h-7 rounded-lg border border-hairline px-2 text-[10px] leading-7 text-muted">{f}</div>)}
                  <div className="h-7 rounded-full bg-ink text-center text-[10px] font-semibold leading-7 text-white">Get it now</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Features */}
      <Section>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHead kicker="Everything included" title="Everything you need to sell files and grow." />
          <Link href="/features" className="link text-[16px]">All features →</Link>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard icon="page" title="Payment pages">A rich description with images, a cover and your own checkout questions, on a page that loads fast on any phone.</FeatureCard>
          <FeatureCard icon="bolt" title="Instant delivery">The download appears on the thank-you page seconds after payment, and the files are attached to the email too.</FeatureCard>
          <FeatureCard icon="infinity" title="Lifetime access">Buyers pay once and come back for the file whenever they need it. Lost the email? They get it again in one click.</FeatureCard>
          <FeatureCard icon="store" title="Link-in-bio storefront">One link with your photo, socials and every product. Made for Instagram and YouTube bios.</FeatureCard>
          <FeatureCard icon="magnet" title="Lead magnets">Give away a free guide for a name and email, with optional email verification. Build a list you own.</FeatureCard>
          <FeatureCard icon="star" title="Testimonials and FAQ">Show reviews from happy buyers and answer common questions right on the page.</FeatureCard>
          <FeatureCard icon="tag" title="Coupons" badge="Creator">Percent or flat discounts, limited by date or number of uses, for one page or all of them.</FeatureCard>
          <FeatureCard icon="gift" title="Additional offer" badge="Creator">A one-tick add-on at checkout that raises the value of every order.</FeatureCard>
          <FeatureCard icon="target" title="Meta Pixel and CAPI" badge="Creator">Purchases and leads reach Meta from the browser and the server, so your ads get credit even with ad blockers on.</FeatureCard>
        </div>
      </Section>

      {/* Old way vs this */}
      <Section tone="dark">
        <SectionHead dark center kicker="Why switch" title="Stop matching UPI screenshots at midnight." />
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-dark-line p-8">
            <p className="text-[14px] font-semibold uppercase tracking-wider text-on-dark-soft">Selling over DMs</p>
            <ul className="mt-6 space-y-4 text-[16px] text-on-dark-soft">
              {[
                "Buyer pays on UPI and sends a screenshot",
                "You open your bank app to check the amount landed",
                "You email the PDF by hand, whenever you see the message",
                "Someone says they paid and you have no way to check",
                "No idea which post or ad brought the sale",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-down/15 text-[14px] text-down">×</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl bg-dark-elevated p-8 ring-1 ring-primary/40">
            <p className="text-[14px] font-semibold uppercase tracking-wider text-primary">With {site.name}</p>
            <div className="mt-6">
              <CheckList
                dark
                items={[
                  "Razorpay confirms every payment, no screenshots",
                  "The file goes out on its own, at 3 am too",
                  "Every sale, fee and refund is a line in your ledger",
                  "Meta receives the purchase with your ad attribution",
                  "Free lead magnets grow a list you can sell to later",
                ]}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Money */}
      <Section>
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div className="space-y-6">
            <SectionHead kicker="Your money" title="Know where every rupee went." sub="Your balance is not a mystery number. It is the sum of a ledger you can read line by line." />
            <CheckList
              items={[
                "Sales, fees, refunds and payouts, each with a date",
                "Daily payouts to your UPI ID or bank account, with the UTR number",
                "Download every order as a CSV for your accountant",
              ]}
            />
          </div>
          <div className="rounded-3xl border border-hairline bg-canvas p-6 shadow-soft sm:p-8">
            <div className="flex items-baseline justify-between">
              <p className="text-[14px] text-body">Balance</p>
              <Kicker>Ledger</Kicker>
            </div>
            <p className="num mt-2 text-[36px] tracking-tight">₹1,398.61</p>
            <ul className="mt-6 divide-y divide-hairline-soft">
              {[
                { label: "Sale: Notion budget template", meta: "Today, 9:42 pm", amount: "+₹299.00", up: true },
                { label: "Fees 4% (includes payment gateway)", meta: "Today, 9:42 pm", amount: "−₹11.96", up: false },
                { label: "Sale: 30-day content calendar (coupon DIWALI20)", meta: "Today, 6:10 pm", amount: "+₹399.20", up: true },
                { label: "Fees 4% (includes payment gateway)", meta: "Today, 6:10 pm", amount: "−₹15.97", up: false },
                { label: "Payout to UPI · UTR 4521…", meta: "Yesterday", amount: "−₹2,000.00", up: false },
              ].map((row) => (
                <li key={row.label + row.meta + row.amount} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{row.label}</p>
                    <p className="text-[13px] text-muted">{row.meta}</p>
                  </div>
                  <span className={cx("num shrink-0 text-[15px]", row.up ? "text-up" : "text-ink")}>{row.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Pricing teaser */}
      <Section tone="soft">
        <SectionHead center kicker="Pricing" title="Start free. Upgrade when you grow." />
        <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-dark p-8 text-white">
            <p className="text-[16px] font-semibold">Free, then Creator</p>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="display text-[64px]">₹0</span>
              <span className="text-on-dark-soft">to start</span>
            </p>
            <p className="mt-2 text-[15px] text-on-dark-soft">One product page free at {FREE_FEE_PERCENT}% per sale. Creator is {plan}/month, {priceLabels.yearly}/year or {priceLabels.lifetime} once for lifetime, with fees down to {CREATOR_FEE_PERCENT}%. All prices include GST.</p>
            <div className="mt-8">
              <CheckList dark items={["Free: one page, one lead magnet, your storefront", "Creator: unlimited pages and lead magnets, 4% fees", "Creator: coupons, add-on offers, analytics, Meta, CSV"]} />
            </div>
            <Link href="/signup" className={cx(buttonClass.primary, "mt-8 w-full")}>Start for free</Link>
          </div>
          <div className="rounded-3xl border border-hairline bg-canvas p-8">
            <p className="text-[16px] font-semibold">A ₹499 sale, worked out</p>
            <dl className="mt-6 space-y-4 text-[15px]">
              <div className="flex justify-between"><dt className="text-body">Buyer pays</dt><dd className="num">₹499.00</dd></div>
              <div className="flex justify-between"><dt className="text-body">Free plan fee ({FREE_FEE_PERCENT}%)</dt><dd className="num">−₹29.94</dd></div>
              <div className="flex justify-between"><dt className="text-body">Creator plan fee ({CREATOR_FEE_PERCENT}%)</dt><dd className="num">−₹19.96</dd></div>
              <div className="flex justify-between border-t border-hairline pt-4 font-semibold"><dt>You keep on Creator</dt><dd className="num text-up">₹479.04</dd></div>
            </dl>
            <p className="mt-6 text-[13px] text-muted">One fee, nothing else. Razorpay&apos;s payment gateway charge is included.</p>
            <Link href="/pricing" className={cx(buttonClass.secondary, "mt-8 w-full")}>See full pricing</Link>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <SectionHead kicker="Questions" title="Things creators ask us first." />
          <Faq
            items={[
              { q: `What is ${site.name}?`, a: `A tool for selling digital files in India. You get a payment page per product, Razorpay checkout, automatic delivery by email, a link-in-bio storefront, free lead magnets to collect emails, and a dashboard for orders, earnings and analytics.` },
              { q: "Who is it for?", a: "Creators, coaches, designers, teachers and anyone with something useful to sell as a file. You don't need a website or any technical setup." },
              { q: "How fast does the buyer get the file?", a: "Usually within seconds. As soon as Razorpay confirms the payment, the download button appears on the thank-you page and the receipt email goes out." },
              { q: "What does it cost?", a: `Starting is free, with a ${FREE_FEE_PERCENT}% all-inclusive fee per sale (payment gateway and GST included). The Creator plan cuts that to ${CREATOR_FEE_PERCENT}% and costs ${plan} a month, ${priceLabels.yearly} a year, or ${priceLabels.lifetime} once for lifetime access, GST included, with unlimited pages and the growth tools.` },
              { q: "How do I get paid?", a: "Every day. We send sales from at least 24 hours earlier to the UPI ID or bank account in your settings, once you have ₹100 or more. Each payout shows in your ledger with its UTR number, so you can match it with your bank statement." },
              { q: "What if a buyer loses the download link?", a: "Access never expires. They enter their email on the download page and we send their links again." },
              { q: "Can I track sales in Meta Ads Manager?", a: "Yes, on the Creator plan. Add your Pixel ID and Conversions API token in settings, for your whole account or per page. We send PageView, ViewContent, InitiateCheckout, Purchase and Lead events from both the browser and the server, with matching event IDs." },
              { q: "Can I collect emails without selling anything?", a: "Yes. Create a lead magnet: a free file people get for their name and email. You can turn on email verification codes, add your own questions, and export the leads as CSV. Free includes one lead magnet; Creator has unlimited." },
              { q: "Do I need a website or a company?", a: "No. Create an account, verify your email, add your UPI ID or bank details for payouts, and publish your page." },
            ]}
          />
        </div>
      </Section>

      <CtaBand
        title="Put your first product online this week."
        sub="Free to start. Your first page can be live in minutes."
        primary={{ href: "/signup", label: "Start for free" }}
        secondary={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
