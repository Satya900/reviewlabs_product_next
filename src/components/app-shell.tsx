import type { ReactNode } from "react";
import { Logo } from "@/components/top-nav";
import { AppNav, type NavItem } from "@/components/app-nav";

export function AppShell({ label, nav, email, children }: { label: string; nav: NavItem[]; email: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-soft md:flex-row">
      <aside className="border-b border-hairline bg-canvas md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-6 py-5">
          <Logo />
        </div>
        <p className="hidden px-7 pb-2 text-[12px] font-semibold uppercase tracking-wider text-muted md:block">{label}</p>
        <AppNav items={nav} />
        <form action="/auth/signout" method="post" className="mt-auto hidden border-t border-hairline p-5 md:block">
          <p className="truncate text-[13px] text-body">{email}</p>
          <button className="link mt-1 text-[14px]">Sign out</button>
        </form>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-end gap-3 px-5 pt-4 md:hidden">
          <span className="truncate text-[13px] text-body">{email}</span>
          <form action="/auth/signout" method="post"><button className="link text-[14px]">Sign out</button></form>
        </div>
        <main className="mx-auto max-w-[1120px] space-y-6 p-5 md:p-10">{children}</main>
      </div>
    </div>
  );
}
