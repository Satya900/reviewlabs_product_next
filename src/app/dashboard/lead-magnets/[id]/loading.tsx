import { Skeleton } from "@/components/loading";

export default function Loading() {
  return (
    <div className="-m-4 grid min-h-[calc(100vh-2rem)] sm:-m-6 lg:-m-8 lg:grid-cols-[minmax(0,560px)_1fr]" aria-busy aria-label="Loading">
      <div className="space-y-6 bg-canvas px-6 py-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="aspect-[2/1] w-full rounded-2xl" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
      <div className="hidden items-center justify-center bg-[#18191c] lg:flex">
        <div className="w-[360px] space-y-4 rounded-3xl bg-white/5 p-6">
          <div className="skeleton aspect-[2/1] w-full !bg-white/10" />
          <div className="skeleton h-5 w-3/4 !bg-white/10" />
          <div className="skeleton h-11 w-full !bg-white/10" />
          <div className="skeleton h-11 w-full !bg-white/10" />
        </div>
      </div>
    </div>
  );
}
