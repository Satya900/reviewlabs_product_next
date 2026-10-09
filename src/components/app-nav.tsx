"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; exact?: boolean };

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
            <span className={cx("size-1.5 rounded-full", active ? "bg-primary" : "bg-transparent")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
