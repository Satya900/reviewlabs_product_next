import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay } from "@/lib/razorpay";
import { env } from "@/lib/env";
import { eventIds, sendInitiateCheckoutEvent } from "@/lib/meta";
import { clientIp } from "@/lib/request";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { applyCoupon } from "@/lib/coupons";
import { creatorHasPlan } from "@/lib/plans-server";
import type { Order, PageField, PaymentPage } from "@/lib/types";

const schema = z.object({
  pageId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{8,16}$/, "Invalid phone number"),
  responses: z.record(z.string(), z.string().max(2000)).default({}),
  fbp: z.string().max(200).optional(),
  fbc: z.string().max(400).optional(),
  sourceUrl: z.url().max(2000).optional(),
  couponCode: z.string().trim().max(40).optional(),
  offerId: z.uuid().optional(),
});

export async function POST(request: Request) {
  // 20 checkout attempts per IP per 10 minutes is plenty for a real buyer.
  if (!(await rateLimit(`checkout:${clientIp(request.headers) ?? "unknown"}`, 20, 600))) {
    return NextResponse.json(tooManyRequests, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;
  const admin = createAdminClient();

  const { data: page } = await admin
    .from("payment_pages")
    .select("*")
    .eq("id", input.pageId)
    .eq("status", "live")
    .maybeSingle<PaymentPage>();
  if (!page) return NextResponse.json({ error: "This page is not available" }, { status: 404 });

  const { data: fields } = await admin.from("page_fields").select("*").eq("page_id", page.id).order("position");

  // Validate custom answers against the page definition; store them by label.
  const responses: Record<string, string> = {};
  for (const field of (fields ?? []) as PageField[]) {
    const value = (input.responses[field.id] ?? "").trim();
    if (!value) {
      if (field.required) return NextResponse.json({ error: `${field.label} is required` }, { status: 400 });
      continue;
    }
    if (field.field_type === "number" && Number.isNaN(Number(value))) {
      return NextResponse.json({ error: `${field.label} must be a number` }, { status: 400 });
    }
    if (field.field_type === "select" && !field.options.includes(value)) {
      return NextResponse.json({ error: `Pick a valid option for ${field.label}` }, { status: 400 });
    }
    responses[field.label] = value;
  }

  // The amount always comes from the database, never from the client.
  let amountPaise = page.amount_paise;
  let discount: { couponId: string; code: string; discountPaise: number } | null = null;
  if (input.couponCode) {
    const result = await applyCoupon(page, input.couponCode);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    amountPaise = result.finalPaise;
    discount = { couponId: result.coupon.id, code: result.coupon.code, discountPaise: result.discountPaise };
  }

  // Additional offer: price always comes from the database, never the browser.
  let offer: { id: string; title: string; price_paise: number } | null = null;
  if (input.offerId) {
    const { data } = await admin
      .from("page_offers")
      .select("id, title, price_paise")
      .eq("id", input.offerId)
      .eq("page_id", page.id)
      .eq("active", true)
      .maybeSingle();
    if (!data || !(await creatorHasPlan(page.creator_id))) {
      return NextResponse.json({ error: "That add-on is no longer available. Please refresh the page." }, { status: 400 });
    }
    offer = data;
    amountPaise += data.price_paise;
  }

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      page_id: page.id,
      creator_id: page.creator_id,
      page_title: page.title,
      buyer_name: input.name,
      buyer_email: input.email.toLowerCase(),
      buyer_phone: input.phone,
      form_responses: responses,
      amount_paise: amountPaise,
      list_price_paise: page.amount_paise,
      discount_paise: discount?.discountPaise ?? 0,
      coupon_id: discount?.couponId ?? null,
      coupon_code: discount?.code ?? null,
      offer_id: offer?.id ?? null,
      offer_title: offer?.title ?? null,
      offer_price_paise: offer?.price_paise ?? 0,
      currency: page.currency,
      tracking: {
        fbp: input.fbp,
        fbc: input.fbc,
        source_url: input.sourceUrl,
        client_ip: clientIp(request.headers),
        user_agent: request.headers.get("user-agent") ?? undefined,
      },
    })
    .select("*")
    .single<Order>();
  if (error || !order) {
    console.error("[checkout] insert order", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  let razorpayOrderId: string;
  try {
    const rzpOrder = await razorpay().orders.create({
      amount: amountPaise,
      currency: page.currency,
      receipt: order.id,
      notes: { order_id: order.id, page_id: page.id, ...(offer ? { offer_id: offer.id } : {}) },
    });
    razorpayOrderId = rzpOrder.id;
  } catch (e) {
    console.error("[checkout] razorpay order", e);
    await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
    return NextResponse.json({ error: "Payment gateway unavailable, please retry" }, { status: 502 });
  }

  await admin.from("orders").update({ razorpay_order_id: razorpayOrderId }).eq("id", order.id);
  after(() => sendInitiateCheckoutEvent(order));

  return NextResponse.json({
    orderId: order.id,
    razorpayOrderId,
    amount: amountPaise,
    currency: page.currency,
    keyId: env.razorpayKeyId(),
    initiateCheckoutEventId: eventIds.initiateCheckout(order.id),
  });
}
