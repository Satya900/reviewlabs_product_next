"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelSubscription, saveBillingDetails, startSubscription } from "./actions";
import { Button, Field, FormMessage, cx, inputClass, textareaClass } from "@/components/ui";
import { GST_STATES } from "@/lib/gst";
import type { Interval, Tier } from "@/lib/plans";

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

function SubscribeButton({ tier, interval, label, variant }: { tier: Tier; interval: Interval; label: string; variant: "hero" | "secondary" }) {
  const router = useRouter();
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const name = tier === "pro" ? "Pro" : "Creator";

  async function subscribe() {
    setBusy(true);
    setState(null);
    const [ready, res] = await Promise.all([loadRazorpay(), startSubscription(tier, interval)]);
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
      name: `Reviewlabs ${name}`,
      description: `${interval === "year" ? "Yearly" : "Monthly"} plan${res.startsAfterTrial ? ", billing starts when your trial ends" : ""}. Cancel any time.`,
      prefill: { name: res.name, email: res.email },
      theme: { color: "#0052ff" },
      handler: async (response: Record<string, string>) => {
        setState({ ok: `Done. Turning on ${name}…` });
        await fetch("/api/billing/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(response) }).catch(() => null);
        router.refresh();
        setBusy(false);
      },
      modal: { ondismiss: () => setBusy(false) },
    });
    rzp.on("payment.failed", (r) => setState({ error: r.error?.description ?? "Payment failed. You can try again." }));
    rzp.open();
  }

  return (
    <div className="space-y-2">
      <Button loading={busy} variant={variant} onClick={subscribe} disabled={busy} className="w-full">{busy ? "Opening payment" : label}</Button>
      <FormMessage state={state} />
    </div>
  );
}

export function CancelButton({ planLabel }: { planLabel: string }) {
  const [state, setState] = useState<{ error?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (confirm(`Cancel your ${planLabel} plan? You keep it until the end of this billing period.`)) {
            start(async () => setState(await cancelSubscription()));
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

export type PlanCard = { tier: Tier; prices: Record<Interval, string>; saving: string; features: string[] };

// Creator and Pro side by side, with one monthly / yearly switch for both.
export function PlanPicker({ plans, inTrial }: { plans: PlanCard[]; inTrial: boolean }) {
  const [interval, setInterval] = useState<Interval>("year");
  return (
    <div className="space-y-6">
      <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-1 rounded-2xl bg-surface-strong p-1" role="radiogroup" aria-label="Billing">
        {(["month", "year"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={interval === v}
            onClick={() => setInterval(v)}
            className={cx("rounded-xl px-2 py-2.5 text-center transition", interval === v ? "bg-canvas text-ink shadow-soft" : "text-body")}
          >
            <span className="block text-[14px] font-semibold">{v === "month" ? "Monthly" : "Yearly"}</span>
            <span className="block text-[11px] text-up">{v === "year" ? "2 months free" : " "}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {plans.map((p) => {
          const pro = p.tier === "pro";
          return (
            <section key={p.tier} className={cx("relative overflow-hidden rounded-3xl p-8", pro ? "bg-dark text-white" : "border border-hairline bg-canvas")}>
              {pro && <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-60 rounded-full bg-primary/40 blur-[90px]" />}
              <div className="relative space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-[22px] font-semibold">{pro ? "Pro" : "Creator"}</p>
                  {pro && <span className="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold">AutoDM</span>}
                </div>
                <div>
                  <p className="flex items-baseline gap-2"><span className="display text-[44px]">{p.prices[interval]}</span><span className={pro ? "text-on-dark-soft" : "text-body"}>/ {interval === "year" ? "year" : "month"}</span></p>
                  <p className={cx("mt-1 text-[13px]", pro ? "text-on-dark-soft" : "text-muted")}>
                    GST included. {interval === "year" ? `You save ${p.saving}. ` : ""}0% platform fee on sales.
                  </p>
                </div>
                <ul className="space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className={cx("flex gap-3 text-[15px]", pro ? "text-on-dark-soft" : "text-body")}>
                      <span className="mt-0.5 text-primary">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <SubscribeButton key={interval} tier={p.tier} interval={interval} variant={pro ? "hero" : "secondary"} label={`Choose ${pro ? "Pro" : "Creator"}`} />
              </div>
            </section>
          );
        })}
      </div>
      <p className="text-center text-[13px] text-muted">
        Secure autopay via Razorpay (UPI or card). {inTrial ? "Billing starts when your free trial ends, so you don't lose any trial days. " : ""}Cancel from this page anytime.
      </p>
    </div>
  );
}

export type BillingDetails = { name: string; gstin: string; stateCode: string; address: string };

// Details printed on GST invoices. A GSTIN sets the state automatically.
export function BillingDetailsForm({ initial }: { initial: BillingDetails }) {
  const [state, action, pending] = useActionState(saveBillingDetails, null);
  const [gstin, setGstin] = useState(initial.gstin);
  const gstState = /^[0-9]{2}/.test(gstin) ? gstin.slice(0, 2) : null;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name on invoice" hint="Your name or your business's legal name.">
        <input name="billing_name" defaultValue={initial.name} required maxLength={200} className={inputClass} />
      </Field>
      <Field label="GSTIN (optional)" hint="Add it to get a B2B invoice and claim input tax credit.">
        <input name="billing_gstin" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15))} placeholder="22AAAAA0000A1Z5" className={cx(inputClass, "num")} />
      </Field>
      <Field label="State" hint={gstState ? "Set from your GSTIN." : undefined}>
        {gstState ? (
          <input readOnly value={GST_STATES.find((s) => s.code === gstState)?.name ?? "Check your GSTIN"} className={cx(inputClass, "bg-surface-soft")} />
        ) : (
          <select name="billing_state_code" defaultValue={initial.stateCode} required className={inputClass}>
            <option value="">Choose your state</option>
            {GST_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        )}
      </Field>
      <Field label="Address (optional)">
        <textarea name="billing_address" defaultValue={initial.address} rows={2} maxLength={500} className={textareaClass} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button loading={pending} type="submit" variant="secondary" disabled={pending}>{pending ? "Saving" : "Save details"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
