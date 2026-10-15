import { cx } from "@/components/ui";

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("spinner", className)} role="status" aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

// Generic dashboard page: title, stat cards and a list.
export function DashboardSkeleton({ cards = 3, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {cards > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: cards }, (_, i) => (
            <div key={i} className="space-y-3 rounded-3xl border border-hairline bg-canvas p-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      )}
      <div className="rounded-3xl border border-hairline bg-canvas">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-hairline-soft px-5 py-4 last:border-0">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
