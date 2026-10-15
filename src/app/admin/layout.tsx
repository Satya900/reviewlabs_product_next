import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireAdmin();
  const nav = [
    { href: "/admin", label: "Creators", exact: true },
    { href: "/admin/orders", label: "All orders" },
    { href: "/admin/requests", label: "Requests" },
    { href: "/dashboard", label: "Back to dashboard", exact: true },
  ];
  return (
    <AppShell label="Admin panel" nav={nav} email={profile.email}>
      {children}
    </AppShell>
  );
}
