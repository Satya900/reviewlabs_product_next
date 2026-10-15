import { Skeleton } from "@/components/loading";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5 rounded-3xl border border-hairline bg-canvas p-6">
          <Skeleton className="h-12 w-full" />
          <div className="flex items-center gap-4"><Skeleton className="size-[72px] rounded-full" /><Skeleton className="h-10 w-32 rounded-full" /></div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-4 rounded-[32px] border-8 border-ink p-6">
          <Skeleton className="mx-auto size-24 rounded-full" />
          <Skeleton className="mx-auto h-6 w-40" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
