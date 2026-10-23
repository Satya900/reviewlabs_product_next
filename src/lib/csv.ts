import { STAGE_LABEL, type Stage } from "@/lib/follow-up";
import type { Order } from "@/lib/types";

// Quote every cell and neutralise spreadsheet formulas (CSV injection).
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const istFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const rupees = (paise: number | null | undefined) => (paise === null || paise === undefined ? "" : (paise / 100).toFixed(2));

export function ordersToCsv(orders: (Order & { creator_email?: string })[], includeCreator = false): string {
  const header = [
    "Date (IST)",
    "Order ID",
    ...(includeCreator ? ["Creator"] : []),
    "Product",
    "Buyer name",
    "Buyer email",
    "Buyer phone",
    "List price (INR)",
    "Coupon",
    "Discount (INR)",
    "Add-on",
    "Add-on price (INR)",
    "Paid (INR)",
    "Status",
    "Razorpay payment ID",
    "Paid at (IST)",
    "Checkout answers",
  ];
  const rows = orders.map((o) => [
    istFmt.format(new Date(o.created_at)),
    o.id,
    ...(includeCreator ? [o.creator_email ?? o.creator_id] : []),
    o.page_title,
    o.buyer_name,
    o.buyer_email,
    o.buyer_phone,
    rupees(o.list_price_paise ?? o.amount_paise),
    o.coupon_code ?? "",
    rupees(o.discount_paise ?? 0),
    o.offer_title ?? "",
    o.offer_title ? rupees(o.offer_price_paise ?? 0) : "",
    rupees(o.amount_paise),
    ("stage" in o && typeof o.stage === "string" ? STAGE_LABEL[o.stage as Stage] ?? o.status : o.status),
    o.razorpay_payment_id ?? "",
    o.paid_at ? istFmt.format(new Date(o.paid_at)) : "",
    Object.entries(o.form_responses ?? {}).map(([k, v]) => `${k}: ${v}`).join("; "),
  ]);
  // BOM so Excel opens UTF-8 (₹, Indian names) correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function rowsToCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
