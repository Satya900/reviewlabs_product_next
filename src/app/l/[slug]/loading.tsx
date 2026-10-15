import { Skeleton } from "@/components/loading";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#0033cc_0%,#0052ff_40%,#7aa5ff_100%)] px-4" aria-busy aria-label="Loading">
      <div className="w-full max-w-[440px] overflow-hidden rounded-3xl bg-canvas">
        <Skeleton className="aspect-[2/1] w-full rounded-none" />
        <div className="space-y-4 p-8">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </main>
  );
}
