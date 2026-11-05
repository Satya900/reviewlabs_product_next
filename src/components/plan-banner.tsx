import Link from "next/link";
import type { Profile } from "@/lib/auth";
import { TRIAL_LIMITS, currentTier, isNewAccount, trialDaysLeft } from "@/lib/plans";

// Top of every dashboard page: trial days left, or that the store is offline.
export function PlanBanner({ profile }: { profile: Profile }) {
  const tier = currentTier(profile);
  if (tier === "trial") {
    const days = trialDaysLeft(profile) ?? 0;
    return (
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[14px] ${days <= 2 ? "bg-[#fff7e0]" : "bg-primary-soft"} text-ink`}>
        <span><b>Free trial: {days} day{days === 1 ? "" : "s"} left.</b> Make {TRIAL_LIMITS.pages} product page and {TRIAL_LIMITS.leadMagnets} lead magnet and start selling. A plan unlocks unlimited pages and Pro tools.</span>
        <Link href="/dashboard/billing" className="font-semibold text-primary">Choose a plan →</Link>
      </div>
    );
  }
  // A new account that never had a plan sees the plan picker; nothing is offline yet.
  if (tier === "none" && !isNewAccount(profile)) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#fdecee] px-4 py-3 text-[14px] text-ink">
        <span><b>Your store is offline.</b> Buyers can&apos;t open your pages until you choose a plan. Nothing has been deleted.</span>
        <Link href="/dashboard/billing" className="font-semibold text-down">Choose a plan →</Link>
      </div>
    );
  }
  return null;
}
