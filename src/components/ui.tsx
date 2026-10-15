import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const inputClass =
  "h-12 w-full rounded-xl border border-hairline bg-canvas px-4 text-[16px] text-ink outline-none transition placeholder:text-muted-soft focus:border-2 focus:border-primary focus:px-[15px] disabled:bg-surface-soft";

export const textareaClass = cx(inputClass, "h-auto py-3 focus:py-[11px]");

const pill =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[16px] font-semibold leading-none transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

export const buttonClass = {
  primary: cx(pill, "bg-primary text-white active:bg-primary-active"),
  secondary: cx(pill, "bg-surface-strong text-ink"),
  danger: cx(pill, "bg-surface-strong text-down"),
  dark: cx(pill, "bg-dark-elevated text-white"),
  outlineDark: cx(pill, "border border-white/70 text-white"),
  ghost: cx(pill, "px-2 text-primary"),
  hero: cx(pill, "h-14 px-8 bg-primary text-white active:bg-primary-active"),
};

export function Button({
  variant = "primary",
  className,
  loading,
  disabled,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof buttonClass; loading?: boolean }) {
  return (
    <button className={cx(buttonClass[variant], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[14px] font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="block text-[13px] text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-3xl border border-hairline bg-canvas p-6", className)}>{children}</div>;
}

export function Panel({ title, aside, className, children }: { title: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cx("rounded-3xl border border-hairline bg-canvas", className)}>
      <div className="flex items-center justify-between gap-3 px-6 pt-5">
        <h2 className="text-[18px] font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="px-6 pb-6 pt-4">{children}</div>
    </section>
  );
}

const statusStyle: Record<string, string> = {
  live: "text-up",
  paid: "text-up",
  processed: "text-up",
  failed: "text-down",
  refunded: "text-down",
  partially_refunded: "text-accent-yellow",
  attempted: "text-accent-yellow",
  pending: "text-accent-yellow",
};

export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-strong px-3 py-1 text-[12px] font-semibold capitalize text-ink">
      <span className={cx("size-1.5 rounded-full bg-current", statusStyle[status] ?? "text-muted")} />
      {label ?? status.replace("_", " ")}
    </span>
  );
}

export function FormMessage({ state }: { state: { error?: string; ok?: string } | null | undefined }) {
  if (!state) return null;
  if (state.error) return <p className="text-[14px] font-medium text-down">{state.error}</p>;
  if (state.ok) return <p className="text-[14px] font-medium text-up">{state.ok}</p>;
  return null;
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="space-y-1">
      <h1 className="display text-[32px] sm:text-[36px]">{children}</h1>
      {sub && <p className="max-w-2xl text-[15px] text-body">{sub}</p>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-hairline bg-canvas p-6">
      <p className="text-[14px] text-body">{label}</p>
      <p className="num mt-2 text-[28px] tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "good" | "bad"; children: ReactNode }) {
  const tones = {
    info: "bg-primary-soft text-ink",
    warn: "bg-[#fff7e0] text-ink",
    good: "bg-[#e6f7ef] text-ink",
    bad: "bg-[#fdecee] text-ink",
  };
  return <div className={cx("rounded-2xl px-4 py-3 text-[14px]", tones[tone])}>{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-3xl border border-dashed border-hairline px-6 py-10 text-center text-[15px] text-body">{children}</div>;
}

export const tableClass = {
  wrap: "overflow-x-auto rounded-3xl border border-hairline bg-canvas",
  table: "w-full text-left text-[14px]",
  th: "border-b border-hairline px-5 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted",
  td: "border-b border-hairline-soft px-5 py-4 align-top",
};
