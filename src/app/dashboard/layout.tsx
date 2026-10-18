import { requireCreator } from "@/lib/auth";
import { hasCreatorPlan } from "@/lib/plans";
import { AppShell } from "@/components/app-shell";
import { PlatformPixel } from "@/components/platform-pixel";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const profile = await requireCreator();
  const nav = [
    { href: "/dashboard", label: "Overview", exact: true },
    { href: "/dashboard/pages", label: "Payment pages" },
    { href: "/dashboard/lead-magnets", label: "Lead magnets" },
    { href: "/dashboard/storefront", label: "Storefront" },
    { href: "/dashboard/orders", label: "Orders" },
    { href: "/dashboard/analytics", label: "Analytics" },
    { href: "/dashboard/coupons", label: "Coupons" },
    { href: "/dashboard/earnings", label: "Earnings" },
    { href: "/dashboard/settings", label: "Settings" },
    { href: "/dashboard/billing", label: "Plan and billing" },
    ...(profile.is_admin ? [{ href: "/admin", label: "Admin panel" }] : []),
  ];
  return (
    <AppShell label={profile.is_admin ? "Admin" : hasCreatorPlan(profile) ? "Creator plan" : "Free plan"} nav={nav} email={profile.email}>
      <PlatformPixel pageViews={false} />
      {children}
    </AppShell>
  );
}
