// Payments list and buyer follow-ups. Pure (no app imports) so it can be unit
// tested. Stages come from the order_attempts view (migration 0021).

export type Stage = "paid" | "refunded" | "paid_later" | "retried" | "failed" | "abandoned";

export const STAGE_LABEL: Record<Stage, string> = {
  paid: "Paid",
  refunded: "Refunded",
  paid_later: "Paid later",
  retried: "Tried again",
  failed: "Payment failed",
  abandoned: "Left at checkout",
};

// Badge colour keys understood by <Badge>.
export const STAGE_BADGE: Record<Stage, string> = {
  paid: "processed",
  refunded: "refunded",
  paid_later: "live",
  retried: "archived",
  failed: "failed",
  abandoned: "pending",
};

export const PAYMENT_FILTERS = [
  { key: "all", label: "All", stages: null },
  { key: "paid", label: "Successful", stages: ["paid"] },
  { key: "not_completed", label: "Not completed", stages: ["abandoned"] },
  { key: "failed", label: "Failed", stages: ["failed"] },
  { key: "refunded", label: "Refunded", stages: ["refunded"] },
] as const satisfies readonly { key: string; label: string; stages: readonly Stage[] | null }[];

export type PaymentFilterKey = (typeof PAYMENT_FILTERS)[number]["key"];

export function paymentFilter(key: string | undefined) {
  return PAYMENT_FILTERS.find((f) => f.key === key) ?? PAYMENT_FILTERS[0];
}

// For the PostgREST "or" filter: keep letters, digits, @ . + - _ and spaces only.
export function cleanSearch(value: string | undefined): string {
  return (value ?? "").replace(/[^\p{L}\p{M}\p{N}@.+\-_ ]/gu, "").trim().slice(0, 80);
}

// YYYY-MM-DD in India time → ISO bounds for created_at. Invalid dates are ignored.
export function istDayStart(day: string | undefined): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function istDayEnd(day: string | undefined): string | null {
  const start = istDayStart(day);
  return start ? new Date(new Date(start).getTime() + 86_400_000).toISOString() : null;
}

// Digits for wa.me: Indian 10-digit numbers get the 91 country code.
export function whatsappNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.length > 1 ? first : "there";
}

// The message the creator sends; they can edit it before sending.
export function followUpMessage(stage: Stage, buyerName: string, product: string, link: string): string {
  const hi = `Hi ${firstName(buyerName)},`;
  switch (stage) {
    case "abandoned":
      return `${hi} I noticed you started checking out "${product}" but didn't finish. Can I help with anything? You can complete it here: ${link}`;
    case "failed":
      return `${hi} your payment for "${product}" didn't go through. You can try again here: ${link}. Reply if you need any help!`;
    case "paid":
    case "paid_later":
      return `${hi} thank you for buying "${product}"! Did you get your download? Reply if you need anything.`;
    case "refunded":
      return `${hi} your refund for "${product}" has been processed. Let me know if there's anything else I can help with.`;
    default:
      return `${hi} thanks for your interest in "${product}". You can find it here: ${link}`;
  }
}

export function followUpLinks(o: { stage: Stage; buyer_name: string; buyer_email: string; buyer_phone: string; page_title: string }, productUrl: string) {
  const text = followUpMessage(o.stage, o.buyer_name, o.page_title, productUrl);
  const wa = whatsappNumber(o.buyer_phone);
  const subject = o.stage === "abandoned" || o.stage === "failed" ? `Your order for ${o.page_title}` : o.page_title;
  return {
    whatsapp: wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : null,
    email: `mailto:${encodeURIComponent(o.buyer_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
  };
}

// Reads the list's URL parameters (they come straight from the address bar).
export function browserParams(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : "";
  };
  const page = Number.parseInt(one("page"), 10);
  const product = one("product");
  return {
    filter: paymentFilter(one("filter")).key as PaymentFilterKey,
    q: cleanSearch(one("q")),
    from: istDayStart(one("from")) ? one("from") : "",
    to: istDayStart(one("to")) ? one("to") : "",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
    product: /^[0-9a-f-]{36}$/i.test(product) ? product : "",
  };
}
