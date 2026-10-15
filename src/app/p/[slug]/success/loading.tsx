import { Spinner } from "@/components/loading";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-24 text-body">
      <Spinner className="size-8 text-primary" />
      <p className="text-[15px]">Confirming your payment</p>
    </div>
  );
}
