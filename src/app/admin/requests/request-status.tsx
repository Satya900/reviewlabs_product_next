"use client";

import { useTransition } from "react";
import { setRequestStatus } from "./actions";
import { cx } from "@/components/ui";

export function RequestStatus({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      {(["new", "contacted", "closed"] as const).map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending || s === status}
          onClick={() => start(() => setRequestStatus(id, s))}
          className={cx("rounded-full px-3 py-1 text-[13px] font-medium capitalize", s === status ? "bg-primary text-white" : "bg-surface-strong text-ink")}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
