import { Suspense } from "react";
import { requireCreator } from "@/lib/auth";
import { VerifiedNotice, VerifyEmailBanner } from "@/components/verify-email-banner";
import { currentTier } from "@/lib/plans";
import { PlanBanner } from "@/components/plan-banner";
import { AppShell } from "@/components/app-shell";

const planLabel = { pro: "Pro plan", creator: "Creator plan", trial: "Free trial", none: "No plan" } as const;

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const profile = await requireCreator();
  const tier = currentTier(profile);
  // No plan: only Plan and billing works (every other page needs a plan).
  const nav = tier === "none" ? [{ href: "/dashboard/billing", label: "Plan and billing" }] : [
    { href: "/dashboard", label: "Overview", exact: true },
    { href: "/dashboard/pages", label: "Payment pages" },
    { href: "/dashboard/lead-magnets", label: "Lead magnets" },
    { href: "/dashboard/storefront", label: "Storefront" },
    { href: "/dashboard/autodm", label: "AutoDM" },
    { href: "/dashboard/email", label: "Email" },
    { href: "/dashboard/orders", label: "Orders" },
    { href: "/dashboard/analytics", label: "Analytics" },
    { href: "/dashboard/coupons", label: "Coupons" },
    { href: "/dashboard/earnings", label: "Earnings" },
    { href: "/dashboard/settings", label: "Settings" },
    { href: "/dashboard/billing", label: "Plan and billing" },
    ...(profile.is_admin ? [{ href: "/admin", label: "Admin panel" }] : []),
  ];
  return (
    <AppShell label={profile.is_admin ? "Admin" : planLabel[tier]} nav={nav} email={profile.email}>
      <Suspense>
        {profile.email_verified_at || profile.is_admin ? <VerifiedNotice /> : <VerifyEmailBanner email={profile.email} />}
      </Suspense>
      {!profile.is_admin && <PlanBanner profile={profile} />}
      {children}
    </AppShell>
  );
}
