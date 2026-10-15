import { Skeleton } from "@/components/loading";

export default function Loading() {
  return (
    <div className="mx-auto grid max-w-[1100px] gap-8 md:grid-cols-[1fr_400px]" aria-busy aria-label="Loading">
      <div className="space-y-5">
        <Skeleton className="aspect-[16/10] w-full rounded-3xl" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="space-y-4 rounded-3xl border border-hairline bg-canvas p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-14 w-full rounded-full" />
      </div>
    </div>
  );
}
