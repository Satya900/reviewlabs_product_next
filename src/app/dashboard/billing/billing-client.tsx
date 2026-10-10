"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelCreatorSubscription, startCreatorSubscription } from "./actions";
import { Button, FormMessage } from "@/components/ui";

type RazorpayInstance = { open: () => void; on: (event: string, cb: (res: { error: { description: string } }) => void) => void };

function loadRazorpay(): Promise<boolean> {
  const w = window as unknown as { Razorpay?: unknown };
  if (w.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function UpgradeButton({ label = "Upgrade to Creator" }: { label?: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function upgrade() {
    setBusy(true);
    setState(null);
    const [ready, res] = await Promise.all([loadRazorpay(), startCreatorSubscription()]);
    if (res.error || !res.subscriptionId) {
      setState({ error: res.error ?? "Something went wrong" });
      setBusy(false);
      return;
    }
    const RZP = (window as unknown as { Razorpay?: new (o: Record<string, unknown>) => RazorpayInstance }).Razorpay;
    if (!ready || !RZP) {
      setState({ error: "Could not load the payment window. Check your connection and try again." });
      setBusy(false);
      return;
    }
    const rzp = new RZP({
      key: res.keyId,
      subscription_id: res.subscriptionId,
      name: "Reviewlabs Creator",
      description: "Monthly plan, cancel any time",
      prefill: { name: res.name, email: res.email },
      theme: { color: "#0052ff" },
      handler: async (response: Record<string, string>) => {
        setState({ ok: "Payment received. Turning on your Creator plan…" });
        await fetch("/api/billing/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(response) }).catch(() => {});
        router.refresh();
        setBusy(false);
      },
      modal: { ondismiss: () => setBusy(false) },
    });
    rzp.on("payment.failed", (r) => setState({ error: r.error?.description ?? "Payment failed. You can try again." }));
    rzp.open();
  }

  return (
    <div className="space-y-3">
      <Button variant="hero" onClick={upgrade} disabled={busy} className="w-full sm:w-auto">{busy ? "Opening payment" : label}</Button>
      <FormMessage state={state} />
    </div>
  );
}

export function CancelButton() {
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (confirm("Cancel your Creator plan? You keep the features until the end of this billing period.")) {
            start(async () => setState(await cancelCreatorSubscription()));
          }
        }}
      >
        {pending ? "Cancelling" : "Cancel plan"}
      </Button>
      <FormMessage state={state} />
    </div>
  );
}
