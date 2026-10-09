import { requireCreator } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const profile = await requireCreator();
  const nav = [
    { href: "/dashboard", label: "Overview", exact: true },
    { href: "/dashboard/pages", label: "Payment pages" },
    { href: "/dashboard/orders", label: "Orders" },
    { href: "/dashboard/analytics", label: "Analytics" },
    { href: "/dashboard/coupons", label: "Coupons" },
    { href: "/dashboard/earnings", label: "Earnings" },
    { href: "/dashboard/settings", label: "Settings" },
    ...(profile.is_admin ? [{ href: "/admin", label: "Admin panel" }] : []),
  ];
  return (
    <AppShell label="Creator dashboard" nav={nav} email={profile.email}>
      {children}
    </AppShell>
  );
}
