"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelCreatorSubscription, startCreatorSubscription, startLifetimePurchase } from "./actions";
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

// One-time payment for lifetime Creator.
export function LifetimeButton({ label, variant = "hero" }: { label: string; variant?: "hero" | "secondary" }) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function buy() {
    setBusy(true);
    setState(null);
    const [ready, res] = await Promise.all([loadRazorpay(), startLifetimePurchase()]);
    if (res.error || !res.orderId) {
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
      order_id: res.orderId,
      amount: res.amount,
      currency: "INR",
      name: "Reviewlabs Creator",
      description: "Lifetime plan, one-time payment",
      prefill: { name: res.name, email: res.email },
      theme: { color: "#0052ff" },
      handler: async (response: Record<string, string>) => {
        setState({ ok: "Payment received. Turning on lifetime Creator…" });
        await fetch("/api/billing/lifetime", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(response) }).catch(() => {});
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
      <Button loading={busy} variant={variant} onClick={buy} className="w-full">{busy ? "Opening payment" : label}</Button>
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

type PlanChoice = { monthly: string; yearly: string; lifetime: string; intro: string | null; saving: string; features: string[] };
type Choice = "month" | "year" | "lifetime";

// Monthly / yearly / lifetime choice with the matching price and button.
export function PlanPicker({ monthly, yearly, lifetime, intro, saving, features }: PlanChoice) {
  const [choice, setChoice] = useState<Choice>("year");
  const options: { value: Choice; label: string; tag?: string }[] = [
    { value: "month", label: "Monthly" },
    { value: "year", label: "Yearly", tag: `Save ${saving}` },
    { value: "lifetime", label: "Lifetime", tag: "Pay once" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-dark-elevated p-1" role="radiogroup" aria-label="Billing">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={choice === o.value}
            onClick={() => setChoice(o.value)}
            className={cx("rounded-xl px-2 py-2.5 text-center transition", choice === o.value ? "bg-primary text-white" : "text-on-dark-soft hover:text-white")}
          >
            <span className="block text-[14px] font-semibold">{o.label}</span>
            {o.tag && <span className={cx("block text-[11px]", choice === o.value ? "text-white/80" : "text-up")}>{o.tag}</span>}
          </button>
        ))}
      </div>

      <div className="text-center">
        {choice === "lifetime" ? (
          <>
            <p className="flex items-baseline justify-center gap-2"><span className="display text-[52px]">{lifetime}</span><span className="text-on-dark-soft">once</span></p>
            <p className="mt-1 text-[14px] text-on-dark-soft">Pay once, GST included. Creator for good. No renewals, ever.</p>
          </>
        ) : choice === "year" ? (
          <>
            <p className="flex items-baseline justify-center gap-2"><span className="display text-[52px]">{yearly}</span><span className="text-on-dark-soft">/ year</span></p>
            <p className="mt-1 text-[14px] text-on-dark-soft">12 months for less than 10 months of monthly. GST included.</p>
          </>
        ) : intro ? (
          <>
            <p className="flex items-baseline justify-center gap-2"><span className="display text-[52px]">{intro}</span><span className="text-on-dark-soft">first month</span></p>
            <p className="mt-1 text-[14px] text-on-dark-soft">Then {monthly}/month. GST included. Cancel anytime.</p>
          </>
        ) : (
          <>
            <p className="flex items-baseline justify-center gap-2"><span className="display text-[52px]">{monthly}</span><span className="text-on-dark-soft">/ month</span></p>
            <p className="mt-1 text-[14px] text-on-dark-soft">Billed monthly, GST included. Cancel anytime.</p>
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

      {choice === "lifetime" ? (
        <LifetimeButton label={`Get lifetime for ${lifetime}`} />
      ) : (
        <UpgradeButton
          key={choice}
          interval={choice}
          label={choice === "year" ? `Upgrade for ${yearly}/year` : intro ? `Start for ${intro}` : `Upgrade for ${monthly}/month`}
        />
      )}
      <p className="text-center text-[12px] text-on-dark-soft">
        {choice === "lifetime" ? "One secure payment via Razorpay (UPI, card or netbanking)." : "Secure autopay via Razorpay (UPI or card). You can cancel from this page anytime."}
      </p>
    </div>
  );
}
