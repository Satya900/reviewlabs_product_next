import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass, cx } from "@/components/ui";

type Tone = "light" | "soft" | "dark";

export function Section({ tone = "light", className, children, id }: { tone?: Tone; className?: string; children: ReactNode; id?: string }) {
  return (
    <section
      id={id}
      className={cx(
        tone === "dark" && "bg-dark text-white",
        tone === "soft" && "bg-surface-soft",
        tone === "light" && "bg-canvas",
        "px-5 py-16 sm:px-8 md:py-24",
        className,
      )}
    >
      <div className="mx-auto max-w-[1200px]">{children}</div>
    </section>
  );
}

export function Kicker({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-wider",
        dark ? "bg-dark-elevated text-on-dark-soft" : "bg-surface-strong text-ink",
      )}
    >
      {children}
    </span>
  );
}

export function SectionHead({
  kicker,
  title,
  sub,
  center,
  dark,
}: {
  kicker?: string;
  title: ReactNode;
  sub?: ReactNode;
  center?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={cx("max-w-3xl space-y-4", center && "mx-auto text-center")}>
      {kicker && <Kicker dark={dark}>{kicker}</Kicker>}
      <h2 className="display text-[36px] sm:text-[44px] md:text-[52px]">{title}</h2>
      {sub && <p className={cx("text-[17px] sm:text-[18px]", dark ? "text-on-dark-soft" : "text-body")}>{sub}</p>}
    </div>
  );
}

export function FeatureCard({ icon, title, children, dark, badge }: { icon?: IconName; title: string; children: ReactNode; dark?: boolean; badge?: string }) {
  return (
    <article className={cx("rounded-3xl p-8", dark ? "bg-dark-elevated" : "border border-hairline bg-canvas")}>
      {icon && (
        <span className={cx("mb-6 flex size-12 items-center justify-center rounded-full", dark ? "bg-dark" : "bg-primary-soft")}>
          <Icon name={icon} className="size-6 text-primary" />
        </span>
      )}
      <h3 className="flex flex-wrap items-center gap-2 text-[18px] font-semibold">
        {title}
        {badge && <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[12px] font-semibold text-primary">{badge}</span>}
      </h3>
      <div className={cx("mt-2 text-[16px]", dark ? "text-on-dark-soft" : "text-body")}>{children}</div>
    </article>
  );
}

export type IconName =
  | "page"
  | "bolt"
  | "infinity"
  | "upi"
  | "target"
  | "ledger"
  | "tag"
  | "chart"
  | "file"
  | "lock"
  | "mail"
  | "bank"
  | "spark"
  | "check"
  | "store"
  | "magnet"
  | "star"
  | "gift";

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const paths: Record<IconName, ReactNode> = {
    page: <><rect x="4" y="3" width="16" height="18" rx="3" {...p} /><path d="M8 8h8M8 12h8M8 16h5" {...p} /></>,
    bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" {...p} />,
    infinity: <path d="M7 15c-2.2 0-4-1.3-4-3s1.8-3 4-3c4 0 6 6 10 6 2.2 0 4-1.3 4-3s-1.8-3-4-3c-4 0-6 6-10 6z" {...p} />,
    upi: <><rect x="3" y="5" width="18" height="14" rx="3" {...p} /><path d="M3 10h18M7 15h4" {...p} /></>,
    target: <><circle cx="12" cy="12" r="8" {...p} /><circle cx="12" cy="12" r="4" {...p} /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>,
    ledger: <><path d="M5 4h14v16H5z" {...p} /><path d="M9 8h6M9 12h6M9 16h3" {...p} /></>,
    tag: <><path d="M3 12V4h8l10 10-8 8z" {...p} /><circle cx="7.5" cy="7.5" r="1.5" {...p} /></>,
    chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...p} />,
    file: <><path d="M6 2h8l5 5v15H6z" {...p} /><path d="M14 2v5h5" {...p} /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" {...p} /><path d="M8 10V7a4 4 0 0 1 8 0v3" {...p} /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="3" {...p} /><path d="m4 7 8 6 8-6" {...p} /></>,
    bank: <><path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" {...p} /></>,
    spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" {...p} />,
    check: <path d="m5 12 4.5 4.5L19 7" {...p} />,
    store: <><path d="M4 9 5.5 4h13L20 9" {...p} /><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9" {...p} /><path d="M5 11v9h14v-9M10 20v-5h4v5" {...p} /></>,
    magnet: <><path d="M6 4v8a6 6 0 0 0 12 0V4" {...p} /><path d="M6 4h3v8a3 3 0 0 0 6 0V4h3M6 8h3M15 8h3" {...p} /></>,
    star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" {...p} />,
    gift: <><rect x="3" y="8" width="18" height="5" rx="1" {...p} /><path d="M5 13v8h14v-8M12 8v13M12 8C10 4 6.5 4.5 7 7c.3 1.2 2.5 1 5 1M12 8c2-4 5.5-3.5 5-1-.3 1.2-2.5 1-5 1" {...p} /></>,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function CheckList({ items, dark }: { items: ReactNode[]; dark?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-[16px]">
          <span className={cx("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", dark ? "bg-dark" : "bg-primary-soft")}>
            <Icon name="check" className="size-4 text-primary" />
          </span>
          <span className={dark ? "text-on-dark-soft" : "text-body"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Steps({ items, dark }: { items: { title: string; body: ReactNode }[]; dark?: boolean }) {
  return (
    <ol className="grid gap-6 md:grid-cols-3">
      {items.map((item, i) => (
        <li key={item.title} className={cx("rounded-3xl p-8", dark ? "bg-dark-elevated" : "border border-hairline bg-canvas")}>
          <span className="num text-[14px] text-primary">0{i + 1}</span>
          <h3 className="mt-4 text-[20px] font-semibold">{item.title}</h3>
          <div className={cx("mt-2 text-[16px]", dark ? "text-on-dark-soft" : "text-body")}>{item.body}</div>
        </li>
      ))}
    </ol>
  );
}

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  return (
    <div className="divide-y divide-hairline border-y border-hairline">
      {items.map((f) => (
        <details key={f.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[18px] font-semibold [&::-webkit-details-marker]:hidden">
            {f.q}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-strong text-[20px] leading-none transition group-open:rotate-45">+</span>
          </summary>
          <div className="mt-3 max-w-3xl text-[16px] text-body">{f.a}</div>
        </details>
      ))}
    </div>
  );
}

export function CtaBand({ title, sub, primary, secondary }: { title: ReactNode; sub?: ReactNode; primary: { href: string; label: string }; secondary?: { href: string; label: string } }) {
  return (
    <Section tone="dark" className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]" />
      <div className="relative mx-auto max-w-3xl space-y-6 text-center">
        <h2 className="display text-[40px] sm:text-[52px]">{title}</h2>
        {sub && <p className="text-[18px] text-on-dark-soft">{sub}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={primary.href} className={buttonClass.hero}>{primary.label}</Link>
          {secondary && <Link href={secondary.href} className={cx(buttonClass.outlineDark, "h-14 px-8")}>{secondary.label}</Link>}
        </div>
      </div>
    </Section>
  );
}

// Page-level hero for inner pages.
export function PageHero({ kicker, title, sub, dark, children }: { kicker?: string; title: ReactNode; sub?: ReactNode; dark?: boolean; children?: ReactNode }) {
  return (
    <Section tone={dark ? "dark" : "light"} className={cx("relative overflow-hidden", dark ? "md:py-28" : "pb-8 md:pb-12")}>
      {dark && <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full bg-primary/30 blur-[140px]" />}
      <div className="relative max-w-3xl space-y-5">
        {kicker && <Kicker dark={dark}>{kicker}</Kicker>}
        <h1 className="display text-[44px] sm:text-[56px] md:text-[64px]">{title}</h1>
        {sub && <p className={cx("text-[18px] sm:text-[20px]", dark ? "text-on-dark-soft" : "text-body")}>{sub}</p>}
        {children}
      </div>
    </Section>
  );
}
