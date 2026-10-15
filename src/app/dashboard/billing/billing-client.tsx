"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelCreatorSubscription, startCreatorSubscription } from "./actions";
import { Button, FormMessage, cx } from "@/components/ui";

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

export function UpgradeButton({ interval, label }: { interval: "month" | "year"; label: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function upgrade() {
    setBusy(true);
    setState(null);
    const [ready, res] = await Promise.all([loadRazorpay(), startCreatorSubscription(interval)]);
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
      description: interval === "year" ? "Yearly plan, cancel any time" : res.intro ? "First month at the intro price, then monthly" : "Monthly plan, cancel any time",
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
      <Button loading={busy} variant="hero" onClick={upgrade} disabled={busy} className="w-full">{busy ? "Opening payment" : label}</Button>
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
        {pending && <span className="spinner mr-2 align-[-2px]" aria-hidden />}
        {pending ? "Cancelling" : "Cancel plan"}
      </Button>
      <FormMessage state={state} />
    </div>
  );
}

type PlanChoice = { monthly: string; yearly: string; intro: string | null; saving: string; features: string[] };

// Monthly / annual toggle with the matching price and upgrade button.
export function PlanPicker({ monthly, yearly, intro, saving, features }: PlanChoice) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <span className={interval === "month" ? "font-semibold text-white" : "text-on-dark-soft"}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={interval === "year"}
          aria-label="Bill yearly"
          onClick={() => setInterval(interval === "year" ? "month" : "year")}
          className={cx("relative h-8 w-14 rounded-full transition", interval === "year" ? "bg-primary" : "bg-dark-line")}
        >
          <span className={cx("absolute top-1 size-6 rounded-full bg-white shadow transition-all", interval === "year" ? "left-7" : "left-1")} />
        </button>
        <span className={interval === "year" ? "font-semibold text-white" : "text-on-dark-soft"}>
          Annual <span className="ml-1 rounded-full bg-up/20 px-2 py-0.5 text-[11px] font-semibold text-up">Save {saving}</span>
        </span>
      </div>

      <div className="text-center">
        {interval === "year" ? (
          <>
            <p className="flex items-baseline justify-center gap-2"><span className="display text-[52px]">{yearly}</span><span className="text-on-dark-soft">/ year</span></p>
            <p className="mt-1 text-[14px] text-on-dark-soft">12 months for less than 10 months of monthly.</p>
          </>
        ) : intro ? (
          <>
            <p className="flex items-baseline justify-center gap-2"><span className="display text-[52px]">{intro}</span><span className="text-on-dark-soft">first month</span></p>
            <p className="mt-1 text-[14px] text-on-dark-soft">Then {monthly}/month. Cancel anytime.</p>
          </>
        ) : (
          <>
            <p className="flex items-baseline justify-center gap-2"><span className="display text-[52px]">{monthly}</span><span className="text-on-dark-soft">/ month</span></p>
            <p className="mt-1 text-[14px] text-on-dark-soft">Billed monthly. Cancel anytime.</p>
          </>
        )}
      </div>

      <ul className="space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex gap-3 text-[15px] text-on-dark-soft">
            <span className="mt-0.5 text-primary">✓</span>
            {f}
          </li>
        ))}
      </ul>

      <UpgradeButton
        key={interval}
        interval={interval}
        label={interval === "year" ? `Upgrade for ${yearly}/year` : intro ? `Start for ${intro}` : `Upgrade for ${monthly}/month`}
      />
      <p className="text-center text-[12px] text-on-dark-soft">Secure autopay via Razorpay (UPI or card). You can cancel from this page anytime.</p>
    </div>
  );
}
