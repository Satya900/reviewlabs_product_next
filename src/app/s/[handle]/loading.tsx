import { Skeleton } from "@/components/loading";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#eef3ff_0%,#f7f7f7_45%)]" aria-busy aria-label="Loading">
      <div className="mx-auto w-full max-w-[560px] space-y-4 px-5 pt-10">
        <Skeleton className="mx-auto size-24 rounded-full" />
        <Skeleton className="mx-auto h-7 w-48" />
        <Skeleton className="mx-auto h-4 w-64" />
        <Skeleton className="mt-8 aspect-[16/9] w-full rounded-3xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    </main>
  );
}
