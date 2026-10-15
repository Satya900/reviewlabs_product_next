"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, inputClass, textareaClass, cx } from "@/components/ui";
import { getMetaCookies, trackPixel } from "@/components/meta-pixel";
import { formatPaise } from "@/lib/money";

type CheckoutField = { id: string; label: string; type: "text" | "textarea" | "number" | "select"; required: boolean; options: string[] };
type Props = {
  page: { id: string; slug: string; title: string; amountPaise: number; currency: string; buttonLabel: string };
  fields: CheckoutField[];
  pixelId: string | null;
  // Editor preview: looks identical but can't take payments.
  preview?: boolean;
  // Shown in the consent line under the pay button.
  sellerName?: string;
  // Optional add-on (order bump) the buyer can tick.
  offer?: { id: string; headline: string; title: string; description: string; imageUrl: string | null; pricePaise: number; compareAtPaise: number | null } | null;
};

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, cb: (res: { error: { description: string } }) => void) => void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpay(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutForm({ page, fields, pixelId, preview, offer, sellerName }: Props) {
  const router = useRouter();
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discountPaise: number; finalPaise: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [offerSelected, setOfferSelected] = useState(false);
  const mainPrice = coupon?.finalPaise ?? page.amountPaise;
  const payable = mainPrice + (offer && offerSelected ? offer.pricePaise : 0);

  async function applyCouponCode() {
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    setCouponError(null);
    const res = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageId: page.id, code: couponInput }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) setCoupon(data);
    else setCouponError(data.error ?? "Could not check that code");
    setCheckingCoupon(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (preview) return;
    setBusy(true);
    setError(null);

    const [sdkReady, res] = await Promise.all([
      loadRazorpay(),
      fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageId: page.id, ...buyer, responses, couponCode: coupon?.code, offerId: offer && offerSelected ? offer.id : undefined, sourceUrl: window.location.href, ...getMetaCookies() }),
      }),
    ]);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    if (!sdkReady || !window.Razorpay) {
      setError("Could not load the payment window. Check your connection and try again.");
      setBusy(false);
      return;
    }

    trackPixel(
      pixelId,
      "InitiateCheckout",
      { content_ids: [page.id], content_name: page.title, content_type: "product", value: data.amount / 100, currency: page.currency, num_items: 1 },
      data.initiateCheckoutEventId,
    );

    const successUrl = `/p/${page.slug}/success?order=${data.orderId}`;
    const rzp = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      order_id: data.razorpayOrderId,
      name: page.title,
      prefill: { name: buyer.name, email: buyer.email, contact: buyer.phone },
      notes: { order_id: data.orderId },
      theme: { color: "#0052ff" },
      handler: async (response: RazorpayResponse) => {
        // Even if this call fails, the success page waits for the webhook.
        await fetch("/api/checkout/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId: data.orderId, ...response }),
        }).catch(() => {});
        router.push(successUrl);
      },
      modal: { ondismiss: () => setBusy(false) },
    });
    rzp.on("payment.failed", (r) => setError(r.error?.description ?? "Payment failed. You can try again."));
    rzp.open();
  }

  return (
    <div className="rounded-3xl bg-canvas p-6 shadow-soft ring-1 ring-hairline sm:p-8">
      <p className="text-[20px] font-semibold">Checkout</p>
      <p className="mt-1 text-[14px] text-muted">Your files arrive by email right after payment.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <fieldset disabled={preview} className="contents">
        <Field label="Full name">
          <input required value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} className={inputClass} autoComplete="name" />
        </Field>
        <Field label="Email" hint="Your files will be sent here">
          <input type="email" required value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} className={inputClass} autoComplete="email" />
        </Field>
        <Field label="Phone">
          <input type="tel" required value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} className={inputClass} autoComplete="tel" placeholder="98765 43210" />
        </Field>
        {fields.map((f) => (
          <Field key={f.id} label={f.required ? f.label : `${f.label} (optional)`}>
            {f.type === "textarea" ? (
              <textarea required={f.required} rows={3} value={responses[f.id] ?? ""} onChange={(e) => setResponses({ ...responses, [f.id]: e.target.value })} className={textareaClass} />
            ) : f.type === "select" ? (
              <select required={f.required} value={responses[f.id] ?? ""} onChange={(e) => setResponses({ ...responses, [f.id]: e.target.value })} className={inputClass}>
                <option value="">Select</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={f.type === "number" ? "number" : "text"} required={f.required} value={responses[f.id] ?? ""} onChange={(e) => setResponses({ ...responses, [f.id]: e.target.value })} className={inputClass} />
            )}
          </Field>
        ))}
        <div className="rounded-2xl bg-surface-soft p-3">
          {coupon ? (
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span>
                <b className="num">{coupon.code}</b> applied. You save <span className="num text-up">{formatPaise(coupon.discountPaise)}</span>
              </span>
              <button type="button" onClick={() => { setCoupon(null); setCouponInput(""); }} className="link">Remove</button>
            </div>
          ) : couponOpen ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCouponCode(); } }}
                  placeholder="Coupon code"
                  className={inputClass}
                  autoCapitalize="characters"
                />
                <Button type="button" variant="secondary" onClick={applyCouponCode} loading={checkingCoupon}>
                  {checkingCoupon ? "Checking" : "Apply"}
                </Button>
              </div>
              {couponError && <p className="text-[13px] text-down">{couponError}</p>}
            </div>
          ) : (
            <button type="button" onClick={() => setCouponOpen(true)} className="link text-[14px]">Have a coupon code?</button>
          )}
        </div>
        {offer && (
          <label
            className={cx(
              "block cursor-pointer rounded-2xl border-2 border-dashed p-4 transition",
              offerSelected ? "border-primary bg-primary-soft" : "border-hairline bg-canvas hover:border-primary/60",
            )}
          >
            <span className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={offerSelected}
                onChange={(e) => setOfferSelected(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-bold uppercase tracking-wide text-primary">{offer.headline}</span>
                  <span className="num shrink-0 text-[15px] font-semibold">{formatPaise(offer.pricePaise)}</span>
                </span>
                <span className="mt-2 flex gap-3">
                  {offer.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={offer.imageUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                  )}
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-snug">
                      {offer.title}
                      {offer.compareAtPaise && offer.compareAtPaise > offer.pricePaise && (
                        <s className="num ml-2 text-[13px] font-normal text-muted">{formatPaise(offer.compareAtPaise)}</s>
                      )}
                    </span>
                    {offer.description && <span className="mt-0.5 block text-[13px] leading-snug text-body">{offer.description}</span>}
                  </span>
                </span>
              </span>
            </span>
          </label>
        )}
        {(coupon || (offer && offerSelected)) && (
          <div className="space-y-1 text-[14px]">
            <p className="flex justify-between text-body">
              <span>{page.title}</span>
              <span className="num">{coupon && <s className="mr-2 text-muted">{formatPaise(page.amountPaise)}</s>}{formatPaise(mainPrice)}</span>
            </p>
            {offer && offerSelected && (
              <p className="flex justify-between text-body"><span>{offer.title}</span><span className="num">{formatPaise(offer.pricePaise)}</span></p>
            )}
            <p className="flex items-baseline justify-between border-t border-hairline pt-2 text-[15px]">
              <span className="font-semibold">Total</span>
              <b className="num text-[20px]">{formatPaise(payable)}</b>
            </p>
          </div>
        )}
        {error && <p className="text-[14px] font-medium text-down">{error}</p>}
        <Button type="submit" variant="hero" className="w-full" loading={busy}>
          {busy ? "Opening payment" : `${page.buttonLabel}: ${formatPaise(payable)}`}
        </Button>
        </fieldset>
        <p className="text-center text-[12px] leading-relaxed text-muted">
          By paying, you agree to share the details above with {sellerName ?? "the seller"} (owner of this page) and Reviewlabs, and to the{" "}
          <a href="/terms" target="_blank" className="underline">terms</a> and{" "}
          <a href="/refund-policy" target="_blank" className="underline">refund policy</a>.
        </p>
        {preview && <p className="text-center text-[12px] text-muted">Preview only. Checkout works on your live page.</p>}
      </form>
    </div>
  );
}
