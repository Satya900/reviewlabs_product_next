import { site } from "@/lib/site";

// Plan rules shared by server and UI. The database enforces the same rules
// (creator_has_plan, the page-limit trigger), so the UI is never the only guard.

export const CREATOR_PRICE_PAISE = site.creatorPlanPaise; // monthly
export const CREATOR_YEARLY_PAISE = site.creatorYearlyPaise;
export const CREATOR_INTRO_PAISE = site.creatorIntroPaise; // first month, first-time subscribers
export const CREATOR_LIFETIME_PAISE = site.creatorLifetimePaise; // one-time
// All-inclusive fee per sale (covers Razorpay's charge and GST). Mirrors public.creator_fee_bps.
export const FREE_FEE_PERCENT = 6;
export const CREATOR_FEE_PERCENT = 4;
export const YEARLY_SAVING_PAISE = CREATOR_PRICE_PAISE * 12 - CREATOR_YEARLY_PAISE;

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
export const priceLabels = {
  monthly: rupees(CREATOR_PRICE_PAISE),
  yearly: rupees(CREATOR_YEARLY_PAISE),
  intro: rupees(CREATOR_INTRO_PAISE),
  saving: rupees(YEARLY_SAVING_PAISE),
  lifetime: rupees(CREATOR_LIFETIME_PAISE),
};

// Fee rate a creator pays per sale right now.
export function feePercentFor(p: PlanFields & { commission_bps?: number | null }): number {
  if (p.commission_bps !== null && p.commission_bps !== undefined) return p.commission_bps / 100;
  return hasCreatorPlan(p) ? CREATOR_FEE_PERCENT : FREE_FEE_PERCENT;
}
export const FREE_PAGE_LIMIT = 1;
const GRACE_MS = 3 * 86_400_000;

type PlanFields = {
  is_admin: boolean;
  plan: string;
  plan_status: string;
  plan_current_period_end: string | null;
};

// Mirrors public.creator_has_plan in SQL.
export function hasCreatorPlan(p: PlanFields, now = Date.now()): boolean {
  if (p.is_admin) return true;
  if (p.plan !== "creator") return false;
  if (!["active", "past_due", "cancelling"].includes(p.plan_status)) return false;
  return !p.plan_current_period_end || new Date(p.plan_current_period_end).getTime() > now - GRACE_MS;
}

export type PremiumFeature = "coupons" | "analytics" | "meta" | "csv" | "pages" | "offer";

export const premiumCopy: Record<PremiumFeature, { title: string; body: string }> = {
  pages: { title: "More product pages", body: "The Free plan includes one product page. Creator gives you unlimited pages." },
  coupons: { title: "Coupons", body: "Run launch discounts and limited-time offers with percent or flat coupons." },
  analytics: { title: "Analytics", body: "See views, checkouts, sales and conversion for every page." },
  meta: { title: "Meta Pixel and Conversions API", body: "Send every view, checkout and purchase to Meta so your ads optimise for real sales." },
  csv: { title: "CSV export", body: "Download all your orders as a spreadsheet for your accountant." },
  offer: { title: "Additional offer", body: "Add a one-click bonus at checkout so buyers can add it to their order. A simple way to raise every order's value." },
};

export const creatorFeatures = [
  "Unlimited product pages and lead magnets",
  "Lower fees: 4% per sale instead of 6%",
  "Coupons and discount codes",
  "Additional offer (order bump) at checkout",
  "Analytics: views, checkouts, sales and conversion",
  "Meta Pixel and Conversions API, per account or per page",
  "CSV export of orders",
  "Storefront without Reviewlabs branding",
];

export const freeFeatures = [
  "One product page and one lead magnet",
  "UPI, card and netbanking checkout",
  "Instant delivery, files attached to the email",
  "Lifetime download links for buyers",
  "Link-in-bio storefront at reviewlabs.space/@you",
  "Testimonials, FAQ and your own policies on pages",
  "Daily payouts to UPI or bank",
];

// Side-by-side comparison on the pricing page. true = included, false = not included.
export type PlanCell = boolean | string;
export const planMatrix: { group: string; rows: { feature: string; free: PlanCell; creator: PlanCell }[] }[] = [
  {
    group: "Fees",
    rows: [
      { feature: "Price (GST included)", free: "₹0", creator: `${priceLabels.monthly}/month, ${priceLabels.yearly}/year or ${priceLabels.lifetime} once` },
      { feature: "Fee per sale, payment gateway and GST included", free: `${FREE_FEE_PERCENT}%`, creator: `${CREATOR_FEE_PERCENT}%` },
      { feature: "Setup fees or hidden charges", free: "None", creator: "None" },
    ],
  },
  {
    group: "Sell",
    rows: [
      { feature: "Product pages", free: "1", creator: "Unlimited" },
      { feature: "UPI, cards and netbanking via Razorpay", free: true, creator: true },
      { feature: "Rich description with images, cover and live preview", free: true, creator: true },
      { feature: "Custom checkout questions", free: true, creator: true },
      { feature: "Testimonials and FAQ sections", free: true, creator: true },
      { feature: "Your own support email, refund policy and terms per page", free: true, creator: true },
      { feature: "Coupons and discount codes", free: false, creator: true },
      { feature: "Additional offer (order bump) at checkout", free: false, creator: true },
    ],
  },
  {
    group: "Deliver",
    rows: [
      { feature: "Instant download after payment", free: true, creator: true },
      { feature: "Files attached to the email (up to 10 MB)", free: true, creator: true },
      { feature: "Lifetime access, links resent on request", free: true, creator: true },
    ],
  },
  {
    group: "Grow your audience",
    rows: [
      { feature: "Link-in-bio storefront at reviewlabs.space/@you", free: true, creator: true },
      { feature: "Reviewlabs branding on storefront and lead magnets", free: "Shown", creator: "Hidden" },
      { feature: "Lead magnets (free downloads for an email)", free: "1", creator: "Unlimited" },
      { feature: "Email verification codes on lead magnets", free: true, creator: true },
      { feature: "Lead responses with CSV export", free: true, creator: true },
    ],
  },
  {
    group: "Track",
    rows: [
      { feature: "Orders and earnings ledger", free: true, creator: true },
      { feature: "Analytics: views, checkouts, sales, conversion", free: false, creator: true },
      { feature: "Meta Pixel and Conversions API (Purchase and Lead events)", free: false, creator: true },
      { feature: "Separate pixel per product page", free: false, creator: true },
      { feature: "CSV export of orders", free: false, creator: true },
    ],
  },
  {
    group: "Get paid",
    rows: [
      { feature: "Daily payouts to your UPI ID or bank account, with UTR", free: true, creator: true },
      { feature: "Refunds handled and recorded for you", free: true, creator: true },
    ],
  },
];
