import { cx } from "@/components/ui";

type Point = { day: string; value: number };

const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// Single-series daily bars. Hovering a bar shows its exact value; the table
// below the charts carries every number for anyone who can't use hover.
export function DayBars({ title, points, format = String }: { title: string; points: Point[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((s, p) => s + p.value, 0);
  const first = points[0]?.day;
  const last = points[points.length - 1]?.day;
  return (
    <figure className="rounded-3xl border border-hairline bg-canvas p-6">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-[16px] font-semibold">{title}</span>
        <span className="text-[13px] text-muted">Total <span className="num text-ink">{format(total)}</span></span>
      </figcaption>
      <div className="relative mt-8 flex h-40 items-end gap-[2px] border-b border-hairline" role="img" aria-label={`${title}: total ${format(total)}`}>
        <span className="num absolute -top-6 left-0 text-[11px] text-muted">{format(max)}</span>
        <span aria-hidden className="absolute inset-x-0 top-0 border-t border-dashed border-hairline-soft" />
        {points.map((p) => (
          <div key={p.day} className="group relative flex h-full flex-1 items-end">
            <div
              className={cx("w-full rounded-t-[4px] bg-primary transition group-hover:bg-primary-active", p.value === 0 && "opacity-0")}
              style={{ height: `${(p.value / max) * 100}%`, minHeight: p.value > 0 ? 3 : 0 }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl bg-dark px-2.5 py-1.5 text-[12px] text-white shadow-soft group-hover:block">
              {dayLabel.format(new Date(p.day))} · <span className="num">{format(p.value)}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-muted">
        <span>{first && dayLabel.format(new Date(first))}</span>
        <span>{last && dayLabel.format(new Date(last))}</span>
      </div>
    </figure>
  );
}
