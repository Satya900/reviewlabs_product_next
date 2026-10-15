import { Skeleton } from "@/components/loading";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy aria-label="Loading">
      <div className="h-[260px] rounded-[32px] bg-[linear-gradient(160deg,#0033cc_0%,#0052ff_45%,#3d7bff_100%)] opacity-90" />
      <div className="relative z-10 -mt-28 grid gap-4 px-2 sm:px-6 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-4 rounded-3xl border border-hairline bg-canvas p-5 shadow-soft">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="flex gap-2"><Skeleton className="h-11 w-36 rounded-full" /><Skeleton className="h-11 w-28 rounded-full" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="overflow-hidden rounded-3xl border border-hairline bg-canvas">
            <Skeleton className="aspect-[2/1] w-full rounded-none" />
            <div className="space-y-3 p-5"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-20" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
