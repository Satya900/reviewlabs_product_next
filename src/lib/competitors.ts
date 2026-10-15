// Public facts about competitors used on /compare pages.
// Only fill a value after checking it on the competitor's own site, and update
// `checkedOn`. Rows with a null value are hidden, so nothing unverified is shown.

export const superprofile = {
  checkedOn: "15 October 2026",
  pricingUrl: "https://superprofile.bio/pricing",
  // Confirmed on superprofile.bio (India comparison page and pricing page).
  indiaSellingNeedsPaidPlan: true,
  payouts: "Next day (T+1), automatic",
  globalCreatorPrice: "$29/month ($4.99 first month)",
  // Fill these after checking the INR pricing page from India, e.g. "₹499/month".
  indiaCreatorPrice: null as string | null,
  // e.g. "5% per sale". Say whether gateway charges are extra if their page says so.
  indiaFeePerSale: null as string | null,
};
