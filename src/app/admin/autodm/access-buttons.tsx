"use client";

import { useState, useTransition } from "react";
import { Button, FormMessage } from "@/components/ui";
import { decideAutodmAccess } from "../actions";

export function AccessButtons({ creatorId, status }: { creatorId: string; status: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const act = (s: "invited" | "declined") => start(async () => setState(await decideAutodmAccess(creatorId, s)));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "invited" && <Button type="button" disabled={pending} onClick={() => act("invited")}>Mark invited</Button>}
      {status === "pending" && <Button type="button" variant="secondary" disabled={pending} onClick={() => act("declined")}>Decline</Button>}
      <FormMessage state={state} />
    </div>
  );
}
