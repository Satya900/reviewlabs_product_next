"use client";

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
  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:flex-col md:px-3 md:pb-0">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
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
  );
}
