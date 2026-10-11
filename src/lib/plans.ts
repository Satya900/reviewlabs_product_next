import { site } from "@/lib/site";

// Plan rules shared by server and UI. The database enforces the same rules
// (creator_has_plan, the page-limit trigger), so the UI is never the only guard.

export const CREATOR_PRICE_PAISE = site.creatorPlanPaise;
export const COMMISSION_PERCENT = 2;
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
  "Coupons and discount codes",
  "Page analytics: views, checkouts, sales",
  "Meta Pixel and Conversions API, per account or per page",
  "CSV export of orders",
  "Additional offer (order bump) at checkout",
];

export const freeFeatures = [
  "One product page",
  "UPI, card and netbanking checkout",
  "Instant file delivery with lifetime access",
  "Orders, earnings ledger and payouts",
];
