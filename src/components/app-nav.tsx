"use client";

import { useEffect, useRef, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; exact?: boolean };

// Dot for the current page; a small spinner while a clicked item loads.
function NavMarker({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <span className="spinner size-3 text-primary" aria-hidden />;
  return <span className={cx("size-1.5 rounded-full", active ? "bg-primary" : "bg-transparent")} />;
}

export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const [more, setMore] = useState(false);
  // On a phone the tabs are one row that scrolls sideways: keep the current one
  // in view, and fade the right edge only while there are tabs past it.
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    const center = () => {
      const tab = el.querySelector<HTMLElement>("[aria-current=page]");
      if (tab && el.scrollWidth > el.clientWidth) el.scrollLeft = tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2;
      update();
    };
    center();
    const resize = new ResizeObserver(center);
    resize.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    return () => {
      resize.disconnect();
      el.removeEventListener("scroll", update);
    };
  }, [pathname, items.length]);
  return (
    <div className="relative md:flex md:min-h-0 md:flex-col">
      <nav ref={nav} className="flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:flex-col md:px-3 md:pb-0">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex h-10 shrink-0 items-center gap-3 rounded-full px-4 text-[14px] font-medium transition",
                active ? "bg-primary-soft text-primary" : "text-body",
              )}
            >
              <NavMarker active={active} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {more && <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-canvas to-transparent md:hidden" />}
    </div>
  );
}
