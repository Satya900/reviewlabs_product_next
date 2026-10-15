import { site } from "@/lib/site";

// Plan rules shared by server and UI. The database enforces the same rules
// (creator_has_plan, the page-limit trigger), so the UI is never the only guard.

export const CREATOR_PRICE_PAISE = site.creatorPlanPaise; // monthly
export const CREATOR_YEARLY_PAISE = site.creatorYearlyPaise;
export const CREATOR_INTRO_PAISE = site.creatorIntroPaise; // first month, first-time subscribers
// All-inclusive fee per sale (covers Razorpay's charge). Mirrors public.creator_fee_bps.
export const FREE_FEE_PERCENT = 6;
export const CREATOR_FEE_PERCENT = 4;
export const YEARLY_SAVING_PAISE = CREATOR_PRICE_PAISE * 12 - CREATOR_YEARLY_PAISE;

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
export const priceLabels = {
  monthly: rupees(CREATOR_PRICE_PAISE),
  yearly: rupees(CREATOR_YEARLY_PAISE),
  intro: rupees(CREATOR_INTRO_PAISE),
  saving: rupees(YEARLY_SAVING_PAISE),
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
  "Unlimited product pages",
  "Unlimited lead magnets",
  "Coupons and discount codes",
  "Page analytics: views, checkouts, sales",
  "Meta Pixel and Conversions API, per account or per page",
  "CSV export of orders",
  "Additional offer (order bump) at checkout",
  "Lower fees: 4% per sale instead of 6%",
];

export const freeFeatures = [
  "One product page",
  "UPI, card and netbanking checkout",
  "Instant file delivery with lifetime access",
  "Orders, earnings ledger and payouts",
  "Link-in-bio storefront at reviewlabs.space/@you",
  "One lead magnet to collect emails",
];
