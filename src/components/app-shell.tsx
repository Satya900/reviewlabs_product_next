import type { ReactNode } from "react";
import { Logo } from "@/components/top-nav";
import { AppNav, MobileNav, type NavItem } from "@/components/app-nav";

export function AppShell({ label, nav, email, children }: { label: string; nav: NavItem[]; email: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-soft md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-hairline bg-canvas md:flex">
        <div className="flex items-center justify-between px-6 py-5">
          <Logo />
        </div>
        <p className="px-7 pb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">{label}</p>
        <AppNav items={nav} />
        <form action="/auth/signout" method="post" className="mt-auto border-t border-hairline p-5">
          <p className="truncate text-[13px] text-body">{email}</p>
          <button className="link mt-1 text-[14px]">Sign out</button>
        </form>
      </aside>
      <div className="min-w-0 flex-1">
        <MobileNav items={nav} label={label} email={email} />
        <main className="mx-auto max-w-[1360px] space-y-6 p-5 md:p-10">{children}</main>
      </div>
    </div>
  );
}
