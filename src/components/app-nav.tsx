"use client";

import { useEffect, useRef, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/top-nav";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; exact?: boolean };

// Dot for the current page; a small spinner while a clicked item loads.
function NavMarker({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <span className="spinner size-3 text-primary" aria-hidden />;
  return <span className={cx("size-1.5 shrink-0 rounded-full", active ? "bg-primary" : "bg-transparent")} />;
}

function isActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// Sidebar on desktop.
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex min-h-0 flex-col gap-1 overflow-y-auto px-3">
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx("flex h-10 shrink-0 items-center gap-3 rounded-full px-4 text-[14px] font-medium transition", active ? "bg-primary-soft text-primary" : "text-body")}
          >
            <NavMarker active={active} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Phones: a top bar with a menu button that slides the navigation in from the right.
export function MobileNav({ items, label, email }: { items: NavItem[]; label: string; email: string }) {
  const pathname = usePathname();
  // Open on the page it was opened on, so going to another page closes it
  // (and the clicked item shows its spinner until then).
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const current = items.find((item) => isActive(item, pathname));

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    closeButton.current?.focus();
    document.addEventListener("keydown", close);
    const button = menuButton.current;
    return () => {
      root.style.overflow = overflow;
      document.removeEventListener("keydown", close);
      button?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-hairline bg-canvas/90 px-5 backdrop-blur md:hidden">
        <Logo />
        <button
          ref={menuButton}
          type="button"
          onClick={() => setOpenOn(pathname)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-menu"
          className="flex h-10 items-center gap-2 rounded-full bg-surface-strong pl-4 pr-3 text-[14px] font-semibold text-ink active:scale-[0.98]"
        >
          <span className="max-w-[120px] truncate max-[359px]:hidden">{current?.label ?? "Menu"}</span>
          <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div
        aria-hidden
        onClick={() => setOpenOn(null)}
        className={cx("fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] transition-opacity duration-300 md:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
      />
      <div
        id="app-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={cx(
          "fixed inset-y-0 right-0 z-50 flex w-[86vw] max-w-[340px] flex-col rounded-l-3xl bg-canvas shadow-2xl transition-transform duration-300 ease-out md:hidden",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-[max(16px,env(safe-area-inset-top))]">
          <span className="rounded-full bg-primary-soft px-3 py-1 text-[12px] font-semibold uppercase tracking-wider text-primary">{label}</span>
          <button
            ref={closeButton}
            type="button"
            onClick={() => setOpenOn(null)}
            aria-label="Close menu"
            className="flex size-10 items-center justify-center rounded-full bg-surface-strong text-ink active:scale-[0.96]"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-2">
          {items.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => active && setOpenOn(null)}
                className={cx(
                  "flex h-12 shrink-0 items-center gap-3 rounded-2xl px-4 text-[16px] font-medium transition active:bg-surface-soft",
                  active ? "bg-primary-soft text-primary" : "text-ink",
                )}
              >
                <NavMarker active={active} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action="/auth/signout" method="post" className="border-t border-hairline px-5 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <p className="truncate text-[13px] text-body">{email}</p>
          <button className="mt-3 h-11 w-full rounded-full border border-hairline text-[15px] font-semibold text-ink active:bg-surface-soft">Sign out</button>
        </form>
      </div>
    </>
  );
}
