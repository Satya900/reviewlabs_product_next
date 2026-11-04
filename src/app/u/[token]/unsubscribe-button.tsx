"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function UnsubscribeButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        loading={busy}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch(`/api/unsubscribe/${token}`, { method: "POST" }).catch(() => null);
          if (res?.ok) router.refresh();
          else { setError("Couldn't unsubscribe. Please try again."); setBusy(false); }
        }}
      >
        {busy ? "Unsubscribing" : "Unsubscribe"}
      </Button>
      {error && <p className="text-[13px] text-down">{error}</p>}
    </div>
  );
}
