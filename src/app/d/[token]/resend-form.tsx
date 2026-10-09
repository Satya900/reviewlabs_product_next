"use client";

import { useState } from "react";
import { Button, inputClass } from "@/components/ui";

export function ResendForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    const res = await fetch("/api/download/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }

  if (state === "done") {
    return <p className="text-[15px] font-medium text-up">If we found purchases for {email}, the links are on their way.</p>;
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
      <Button type="submit" className="h-12 shrink-0" disabled={state === "sending"}>{state === "sending" ? "Sending" : "Send"}</Button>
      {state === "error" && <p className="text-[13px] text-down">Something went wrong. Try again in a few minutes.</p>}
    </form>
  );
}
