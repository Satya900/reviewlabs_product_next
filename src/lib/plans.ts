import { site } from "./site.ts";

// Plan rules shared by server and UI. The database enforces the same rules
// (creator_plan_tier and friends), so the UI is never the only guard.
//
// No free plan. New accounts get a 7-day trial at Creator level with limits:
// one product page and one lead magnet (TRIAL_LIMITS, enforced by the
// database). Creator unlocks unlimited selling; Pro adds the growth tools
// (AutoDM, email broadcasts, coupons, add-on offer, advanced analytics, no
// branding). Without a plan or trial the creator's store is offline. No
// platform fee on sales; Razorpay's charge is passed on at cost.

export type Tier = "creator" | "pro";
export type Interval = "month" | "year";
// What a creator can use right now. "trial" = Creator features within TRIAL_LIMITS.
export type CurrentTier = Tier | "trial" | "none";

export const PLAN_PRICES: Record<Tier, Record<Interval, number>> = {
  creator: { month: site.creatorMonthlyPaise, year: site.creatorYearlyPaise },
  pro: { month: site.proMonthlyPaise, year: site.proYearlyPaise },
};
export const TRIAL_DAYS = site.trialDays;
// What the trial includes (the database enforces the same numbers, migration 0035).
export const TRIAL_LIMITS = { pages: 1, leadMagnets: 1 } as const;
// Razorpay's charge, about 2% plus 18% GST, passed on at cost.
export const GATEWAY_FEE_LABEL = "about 2.36%";

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
export const priceLabel = (tier: Tier, interval: Interval) => rupees(PLAN_PRICES[tier][interval]);
export const yearlySaving = (tier: Tier) => rupees(PLAN_PRICES[tier].month * 12 - PLAN_PRICES[tier].year);
export const planName = (tier: Tier) => (tier === "pro" ? "Pro" : "Creator");

const GRACE_MS = 3 * 86_400_000;

export type PlanFields = {
  is_admin: boolean;
  plan: string;
  plan_status: string;
  plan_current_period_end: string | null;
  trial_ends_at?: string | null;
};

// Mirrors public.creator_plan_tier in SQL.
export function currentTier(p: PlanFields, now = Date.now()): CurrentTier {
  if (p.is_admin) return "pro";
  const paid =
    (p.plan === "creator" || p.plan === "pro") &&
    ["active", "past_due", "cancelling"].includes(p.plan_status) &&
    (!p.plan_current_period_end || new Date(p.plan_current_period_end).getTime() > now - GRACE_MS);
  if (paid) return p.plan as Tier;
  if (p.trial_ends_at && new Date(p.trial_ends_at).getTime() > now) return "trial";
  return "none";
}

// Selling features and a live store: any paid plan or the trial.
export function hasCreatorPlan(p: PlanFields, now = Date.now()): boolean {
  return currentTier(p, now) !== "none";
}

// The Pro features (AutoDM, email broadcasts, coupons, add-on offer, advanced
// analytics, no branding): Pro only, not the trial.
export function hasProPlan(p: PlanFields, now = Date.now()): boolean {
  return currentTier(p, now) === "pro";
}

// Never had a plan or a trial (an abandoned checkout still counts as new).
export function isNewAccount(p: PlanFields): boolean {
  return !p.is_admin && !p.trial_ends_at && p.plan === "free" && (p.plan_status === "none" || p.plan_status === "created");
}

// Whole days left in the trial (rounded up), or null when not on a trial.
export function trialDaysLeft(p: PlanFields, now = Date.now()): number | null {
  if (currentTier(p, now) !== "trial" || !p.trial_ends_at) return null;
  return Math.max(1, Math.ceil((new Date(p.trial_ends_at).getTime() - now) / 86_400_000));
}

// Who can upgrade in one click: Creator on an active monthly or yearly
// subscription (not lifetime, not cancelling, not granted by an admin).
export function canUpgradeInOneClick(p: { plan: string; plan_status: string; plan_interval: string | null; razorpay_subscription_id: string | null; is_admin: boolean }): boolean {
  if (p.is_admin || p.plan !== "creator" || p.plan_status !== "active" || !p.razorpay_subscription_id) return false;
  return p.plan_interval === "month" || p.plan_interval === "year";
}

// Creator → Pro mid-period: pay the price difference for the days left, in
// whole rupees (at least ₹1). Pro then renews at full price on the same date
// Creator would have, so the billing date never moves.
export function upgradeQuote(interval: Interval, periodEnd: Date, now = Date.now()): { paise: number; daysLeft: number } {
  const periodMs = (interval === "year" ? 365 : 30) * 86_400_000;
  const left = Math.min(Math.max(periodEnd.getTime() - now, 0), periodMs);
  const diff = PLAN_PRICES.pro[interval] - PLAN_PRICES.creator[interval];
  const paise = Math.max(100, Math.ceil((diff * left) / periodMs / 100) * 100);
  return { paise, daysLeft: Math.ceil(left / 86_400_000) };
}

// Platform fee a creator pays per sale: 0% unless they have a custom deal.
// Mirrors public.creator_fee_bps.
export function platformFeePercent(p: { commission_bps?: number | null }): number {
  return p.commission_bps ? p.commission_bps / 100 : 0;
}

export type PremiumFeature = "coupons" | "analytics" | "offer" | "autodm" | "branding" | "email";

// Pro-only features (Stan-style: Creator sells, Pro grows). Shown in UpgradeCard.
export const premiumCopy: Record<PremiumFeature, { title: string; body: string; tier: Tier }> = {
  coupons: { tier: "pro", title: "Coupons", body: "Run launch discounts and limited-time offers with percent or flat coupon codes." },
  analytics: { tier: "pro", title: "Advanced analytics", body: "See conversion for every page, where buyers drop off, and which channels bring visits and sales: Instagram, WhatsApp, YouTube, AutoDM and more." },
  offer: { tier: "pro", title: "Add-on offer", body: "Add a one-click bonus at checkout so buyers can add it to their order. A simple way to raise every order's value." },
  autodm: { tier: "pro", title: "AutoDM", body: "When someone comments a keyword on your post or reel, they get a DM with your link, automatically." },
  email: { tier: "pro", title: "Email broadcasts", body: "Email everyone who bought from you or signed up for a freebie: launches, offers and new products, up to 5,000 emails a month." },
  branding: { tier: "pro", title: "Remove Reviewlabs branding", body: "Your storefront and product pages show only your brand, without the \"Made with Reviewlabs\" badge." },
};

// Creator: everything you need to sell.
export const creatorFeatures = [
  "Unlimited product pages and lead magnets",
  "0% platform fee on every sale",
  "UPI, card and netbanking checkout",
  "Instant delivery and lifetime download links",
  "Link-in-bio storefront at reviewlabs.space/@you",
  "Sales dashboard: views, sales and revenue",
  "Orders, CSV export and GST invoices",
  "Payouts to your bank on request",
];

// Pro: the tools that grow sales.
export const proFeatures = [
  "Everything in Creator",
  "AutoDM: comment a keyword, get the link by DM",
  "Email broadcasts to your buyers and subscribers (5,000 a month)",
  "Coupons and discount codes",
  "Add-on offer (order bump) at checkout",
  "Advanced analytics: conversion, drop-off and traffic sources",
  "No \"Made with Reviewlabs\" badge",
  "First access to email automations and affiliates",
];

// Side-by-side comparison on the pricing page. true = included, false = not included.
export type PlanCell = boolean | string;
export const planMatrix: { group: string; rows: { feature: string; creator: PlanCell; pro: PlanCell }[] }[] = [
  {
    group: "Price",
    rows: [
      { feature: "Monthly (GST included)", creator: `${priceLabel("creator", "month")}/month`, pro: `${priceLabel("pro", "month")}/month` },
      { feature: "Yearly (2 months free)", creator: `${priceLabel("creator", "year")}/year`, pro: `${priceLabel("pro", "year")}/year` },
      { feature: "Platform fee per sale", creator: "0%", pro: "0%" },
      { feature: "Payment gateway charge (Razorpay, at cost)", creator: GATEWAY_FEE_LABEL, pro: GATEWAY_FEE_LABEL },
    ],
  },
  {
    group: "Sell",
    rows: [
      { feature: "Product pages and lead magnets", creator: "Unlimited", pro: "Unlimited" },
      { feature: "UPI, cards and netbanking via Razorpay", creator: true, pro: true },
      { feature: "Files and links (Notion, Drive, Canva, groups) as products", creator: true, pro: true },
      { feature: "Custom checkout questions, testimonials and FAQ", creator: true, pro: true },
      { feature: "Instant delivery and lifetime download links", creator: true, pro: true },
      { feature: "Link-in-bio storefront at reviewlabs.space/@you", creator: true, pro: true },
      { feature: "Payments follow-up: failed and abandoned checkouts", creator: true, pro: true },
    ],
  },
  {
    group: "Grow",
    rows: [
      { feature: "AutoDM: keyword comments get your link by DM", creator: false, pro: true },
      { feature: "Public replies under comments", creator: false, pro: true },
      { feature: "Email broadcasts to buyers and subscribers", creator: false, pro: "5,000/month" },
      { feature: "Coupons and discount codes", creator: false, pro: true },
      { feature: "Add-on offer (order bump) at checkout", creator: false, pro: true },
      { feature: "Remove \"Made with Reviewlabs\" badge", creator: false, pro: true },
    ],
  },
  {
    group: "Track and get paid",
    rows: [
      { feature: "Sales dashboard: views, sales, revenue per day", creator: true, pro: true },
      { feature: "Conversion and drop-off for every page", creator: false, pro: true },
      { feature: "Traffic sources: Instagram, WhatsApp, YouTube, AutoDM…", creator: false, pro: true },
      { feature: "AutoDM stats: DMs sent and link clicks", creator: false, pro: true },
      { feature: "Orders, earnings ledger and CSV export", creator: true, pro: true },
      { feature: "GST invoice for every plan payment", creator: true, pro: true },
      { feature: "Payouts to your bank on request (from ₹500), with UTR", creator: true, pro: true },
    ],
  },
];
