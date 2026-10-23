import Link from "next/link";
import { cx } from "@/components/ui";

// Switches between editing a page and seeing its payments.
export function PageTabs({ pageId, active }: { pageId: string; active: "edit" | "payments" }) {
  const tabs = [
    { key: "edit", label: "Edit page", href: `/dashboard/pages/${pageId}` },
    { key: "payments", label: "Payments", href: `/dashboard/pages/${pageId}/payments` },
  ] as const;
  return (
    <nav className="flex gap-1 border-b border-hairline" aria-label="Page sections">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cx(
            "-mb-px border-b-2 px-4 py-2.5 text-[15px] font-semibold transition",
            active === t.key ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
