import type { ReactNode } from "react";
import { CheckList, CtaBand, Icon, PageHero, Section, SectionHead, type IconName } from "@/components/marketing";
import { cx } from "@/components/ui";

export const metadata = { title: "Features" };

function MockFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-3xl border border-hairline bg-canvas p-6 shadow-soft", className)}>{children}</div>;
}

function Group({ icon, kicker, title, sub, items, mock, flip, tone }: { icon: IconName; kicker: string; title: string; sub: string; items: string[]; mock: ReactNode; flip?: boolean; tone?: "soft" }) {
  return (
    <Section tone={tone}>
      <div className={cx("grid items-center gap-14 lg:grid-cols-2", flip && "lg:[&>*:first-child]:order-2")}>
        <div className="space-y-6">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft">
            <Icon name={icon} className="size-6 text-primary" />
          </span>
          <SectionHead kicker={kicker} title={title} sub={sub} />
          <CheckList items={items} />
        </div>
        {mock}
      </div>
    </Section>
  );
}

export default function Features() {
  return (
    <>
      <PageHero
        dark
        kicker="Features"
        title="Everything you need to sell a file and grow an audience."
        sub="Payment pages, a link-in-bio storefront, lead magnets, delivery, tracking and payouts, all in one place and set up in an afternoon."
      />

      <Group
        icon="page"
        kicker="Sell"
        title="A page for every product."
        sub="Each product gets its own link with a cover, description and buy button. It looks clean on a phone, which is where most of your buyers are."
        items={[
          "Rich description with headings, lists and images, with a live preview",
          "Testimonials and an FAQ section to answer buyers before they ask",
          "Custom checkout questions: text, number or dropdown",
          "Your own support email, refund policy and terms on each page",
          "Coupons and a one-tick add-on offer at checkout (Creator)",
        ]}
        mock={
          <MockFrame>
            <div className="h-36 rounded-2xl bg-[linear-gradient(135deg,#0052ff,#7aa5ff)]" />
            <p className="mt-5 text-[18px] font-semibold">Lightroom presets: Monsoon pack</p>
            <p className="mt-1 text-[14px] text-body">12 presets · ZIP · Lifetime access</p>
            <div className="mt-5 space-y-3">
              {["Full name", "Email", "Phone", "Instagram handle (optional)"].map((f) => (
                <div key={f} className="flex h-11 items-center rounded-xl border border-hairline px-4 text-[14px] text-muted">{f}</div>
              ))}
            </div>
            <div className="mt-4 flex h-11 items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-white">Buy now · ₹349</div>
          </MockFrame>
        }
      />

      <Group
        tone="soft"
        flip
        icon="bolt"
        kicker="Deliver"
        title="Files arrive while you sleep."
        sub="The moment Razorpay confirms a payment, the buyer sees a download button and gets an email with the same links. Files up to 10 MB are attached to the email too. You do nothing."
        items={[
          "Lifetime access. Links never expire",
          "Lost the email? Buyers request their links again by email",
          "Short-lived signed downloads, so the real file never leaks",
          "Buyers can reply to the email to reach your support address",
          "A full refund switches access off automatically",
        ]}
        mock={
          <MockFrame>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-[#e6f7ef]"><Icon name="check" className="size-5 text-up" /></span>
              <div>
                <p className="text-[16px] font-semibold">Payment received</p>
                <p className="text-[13px] text-muted">Monsoon pack · ₹349.00</p>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              {["monsoon-presets.zip", "install-guide.pdf"].map((f) => (
                <div key={f} className="flex items-center justify-between rounded-2xl bg-surface-soft px-4 py-3">
                  <span className="flex items-center gap-3 text-[14px]"><Icon name="file" className="size-5 text-primary" />{f}</span>
                  <span className="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold text-white">Download</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-muted">Receipt sent to the buyer&apos;s inbox</p>
          </MockFrame>
        }
      />

      <Group
        icon="store"
        kicker="Storefront"
        title="One link for your bio. Every plan."
        sub="reviewlabs.space/@yourname shows your photo, bio, social links and every product and lead magnet you choose, in the order you want. Made for the link in your Instagram or YouTube bio."
        items={[
          "Pick your handle, upload a photo, add up to nine social links",
          "Feature one product at the top, reorder or hide the rest",
          "Live preview while you edit",
          "Your Meta Pixel tracks storefront visits (Creator)",
          "No Reviewlabs badge on the Creator plan",
        ]}
        mock={
          <MockFrame className="mx-auto w-full max-w-sm">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0052ff,#7aa5ff)] text-[24px] font-semibold text-white">R</div>
            <p className="mt-3 text-center text-[17px] font-semibold">Rohan Fitness</p>
            <p className="text-center text-[13px] text-muted">@rohanfit · Home workouts that fit a busy day</p>
            <div className="mt-4 space-y-2">
              {[["12-week home workout plan", "₹499"], ["Meal prep guide", "₹199"], ["Free 7-day starter plan", "Free"]].map(([t, p]) => (
                <div key={t} className="flex items-center gap-3 rounded-2xl border border-hairline p-3">
                  <span className="size-10 shrink-0 rounded-xl bg-[linear-gradient(135deg,#0052ff,#7aa5ff)]" />
                  <span className="flex-1 text-[14px] font-medium">{t}</span>
                  <span className={p === "Free" ? "rounded-full bg-[#e6f7ef] px-2 py-0.5 text-[12px] font-semibold text-up" : "num text-[14px]"}>{p}</span>
                </div>
              ))}
            </div>
          </MockFrame>
        }
      />

      <Group
        tone="soft"
        flip
        icon="magnet"
        kicker="Lead magnets"
        title="Grow a list, then sell to it."
        sub="Give away a checklist, template or mini guide in exchange for a name and email. People who ask for your free stuff are the easiest people to sell to next."
        items={[
          "Your own questions, plus optional phone number",
          "Email verification codes keep fake emails out",
          "Free files delivered instantly and by email",
          "Send people to your WhatsApp group or a paid product afterwards",
          "Responses, conversion rate and CSV export on every plan",
        ]}
        mock={
          <div className="rounded-3xl bg-[linear-gradient(160deg,#ff8a00_0%,#ff3d6e_55%,#8a1fa8_100%)] p-8">
            <div className="mx-auto max-w-xs overflow-hidden rounded-3xl bg-canvas shadow-float">
              <div className="h-24 bg-[linear-gradient(135deg,#ffd6e0,#c7d7ff)]" />
              <div className="space-y-3 p-5">
                <p className="text-[16px] font-semibold">Free 7-day starter plan</p>
                {["What's your name?", "Your email", "Your fitness level"].map((f) => (
                  <div key={f} className="flex h-10 items-center rounded-xl border border-hairline px-3 text-[13px] text-muted">{f}</div>
                ))}
                <div className="flex h-10 items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-white">Get it now</div>
              </div>
            </div>
          </div>
        }
      />

      <Group
        icon="target"
        kicker="Grow"
        title="See what sells, then sell more of it."
        sub="On the Creator plan: track every page from first view to paid order, run discount codes for launches, and give your Meta ads the purchase data they need."
        items={[
          "Page views, checkouts, sales and conversion per page",
          "Coupons: percent or flat, with expiry dates and use limits",
          "Add-on offer at checkout, with its own files",
          "Meta Pixel plus Conversions API, for your account or per page",
          "Test events with your own test code before you spend",
        ]}
        mock={
          <MockFrame>
            <div className="grid grid-cols-3 gap-3">
              {[["Views", "2,184"], ["Checkouts", "312"], ["Sales", "141"]].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-surface-soft p-3">
                  <p className="text-[12px] text-muted">{k}</p>
                  <p className="num mt-1 text-[18px]">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex h-28 items-end gap-1.5">
              {[30, 42, 38, 55, 48, 62, 58, 70, 66, 84, 76, 100].map((h, i) => (
                <span key={i} className={cx("flex-1 rounded-t", i > 8 ? "bg-primary" : "bg-surface-strong")} style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-dashed border-hairline px-4 py-3">
              <span className="num text-[14px]">LAUNCH20</span>
              <span className="text-[13px] text-body">20% off · 38 of 100 used</span>
            </div>
          </MockFrame>
        }
      />

      <Group
        tone="soft"
        flip
        icon="ledger"
        kicker="Get paid"
        title="Earnings you can actually check."
        sub="Every sale, fee, refund and payout is a separate line, and your balance is their total. When we pay you, the UTR number is right there."
        items={[
          "Payouts to your UPI ID or bank account",
          "One all-inclusive fee per sale (6% Free, 4% Creator), gateway included",
          "Download orders as CSV for your accountant (Creator)",
          "Refunds handled for you and recorded in the ledger",
        ]}
        mock={
          <MockFrame>
            <p className="text-[14px] text-body">Balance owed to you</p>
            <p className="num mt-1 text-[32px]">₹8,940.50</p>
            <ul className="mt-5 divide-y divide-hairline-soft">
              {[["Sale", "+₹349.00", true], ["Fees 4% (includes payment gateway)", "−₹13.96", false], ["Refund", "−₹349.00", false], ["Payout · UTR 6610…", "−₹5,000.00", false]].map(([k, v, up]) => (
                <li key={String(k) + String(v)} className="flex justify-between py-3 text-[14px]">
                  <span>{k}</span>
                  <span className={cx("num", up ? "text-up" : "text-ink")}>{v}</span>
                </li>
              ))}
            </ul>
          </MockFrame>
        }
      />

      <Section>
        <SectionHead center kicker="Under the hood" title="The boring parts, done carefully." sub="You won't see these, but they are why buyers get their files and your numbers add up." />
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["lock", "Payments verified by signature", "Every Razorpay payment is checked on our server before an order counts."],
            ["spark", "Missed updates recovered", "A background check asks Razorpay about unfinished orders, so a closed tab never loses a sale."],
            ["ledger", "A ledger nobody can edit", "Corrections are new lines, never rewrites, so your history stays honest."],
            ["mail", "Emails sent once", "Retries never send the same buyer two emails or report two purchases to Meta."],
            ["bank", "Payout records with UTR", "Each payout is logged against the reference your bank shows."],
            ["upi", "Verified accounts", "Every creator verifies their email before they can sell, and limits are enforced in the database."],
          ].map(([icon, title, body]) => (
            <div key={title} className="rounded-3xl border border-hairline p-6">
              <Icon name={icon as IconName} className="size-6 text-primary" />
              <p className="mt-4 text-[16px] font-semibold">{title}</p>
              <p className="mt-1 text-[15px] text-body">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand title="Ready when you are." sub="Tell us what you sell and we will set you up." primary={{ href: "/signup", label: "Start for free" }} secondary={{ href: "/pricing", label: "See pricing" }} />
    </>
  );
}
