import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, type RazorpayPayment } from "@/lib/razorpay";
import { recordCapturedPayment, runPostPaymentTasks } from "@/lib/fulfilment";
import { grantLifetime, isLifetimePayment, syncSubscription, type RazorpaySubscription } from "@/lib/billing";
import { sendLifetimeEvent, sendSubscribeEvent } from "@/lib/platform-meta";

// Creator who owns a subscription, but only on its first payment, so a renewal
// of a subscription from before tracking existed isn't reported as new.
async function firstPaymentOwner(subscriptionId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { count } = await admin.from("subscription_payments").select("id", { count: "exact", head: true }).eq("razorpay_subscription_id", subscriptionId);
  if ((count ?? 0) > 1) return null;
  const { data } = await admin.from("profiles").select("id").eq("razorpay_subscription_id", subscriptionId).maybeSingle();
  return data?.id ?? null;
}

type RazorpayRefund = { id: string; payment_id: string; amount: number; status: string; notes?: Record<string, string> };

type WebhookBody = {
  event: string;
  payload: {
    payment?: { entity: RazorpayPayment };
    refund?: { entity: RazorpayRefund };
    subscription?: { entity: RazorpaySubscription };
  };
};

export async function POST(request: Request) {
  // Signature must be checked against the exact raw bytes Razorpay sent.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const body = JSON.parse(rawBody) as WebhookBody;
  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    `${body.event}:${body.payload.payment?.entity.id ?? body.payload.refund?.entity.id ?? body.payload.subscription?.entity.id}`;
  const admin = createAdminClient();

  // Razorpay retries deliveries; store each event once and skip processed ones.
  await admin
    .from("webhook_events")
    .upsert({ event_id: eventId, event_type: body.event, payload: body }, { onConflict: "event_id", ignoreDuplicates: true });
  const { data: stored } = await admin.from("webhook_events").select("processed_at").eq("event_id", eventId).single();
  if (stored?.processed_at) return NextResponse.json({ ok: true, duplicate: true });

  try {
    await handleEvent(body);
    await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("event_id", eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = (e as Error).message;
    console.error(`[webhook] ${body.event} ${eventId}:`, message);
    await admin.from("webhook_events").update({ error: message }).eq("event_id", eventId);
    // Non-2xx makes Razorpay retry; all handlers are idempotent.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

async function handleEvent(body: WebhookBody) {
  const admin = createAdminClient();
  const payment = body.payload.payment?.entity;
  const refund = body.payload.refund?.entity;

  switch (body.event) {
    case "payment.captured":
    case "order.paid": {
      if (!payment?.order_id) return;
      // Lifetime Creator plan: platform revenue, not a creator sale.
      if (isLifetimePayment(payment)) {
        if (payment.status === "captured") {
          const granted = await grantLifetime(payment.order_id, payment.id, payment.amount);
          // Backup for when the browser never reached /api/billing/lifetime.
          if (granted?.creator_id) await sendLifetimeEvent(granted.creator_id, payment.order_id, payment.amount).catch(() => {});
        }
        return;
      }
      const result = await recordCapturedPayment(payment);
      if (result?.newly_paid) after(() => runPostPaymentTasks(result.order_id));
      return;
    }
    case "payment.authorized": {
      if (payment?.order_id) {
        await admin.rpc("mark_order_attempted", { p_razorpay_order_id: payment.order_id, p_failed: false });
      }
      return;
    }
    case "payment.failed": {
      if (payment?.order_id) {
        await admin.rpc("mark_order_attempted", { p_razorpay_order_id: payment.order_id, p_failed: true });
      }
      return;
    }
    case "refund.created":
    case "refund.processed":
    case "refund.failed": {
      if (!refund) return;
      const status = body.event === "refund.processed" ? "processed" : body.event === "refund.failed" ? "failed" : "pending";
      const { error } = await admin.rpc("record_refund", {
        p_razorpay_refund_id: refund.id,
        p_razorpay_payment_id: refund.payment_id,
        p_amount_paise: refund.amount,
        p_status: status,
        p_reason: refund.notes?.reason ?? null,
      });
      if (error) throw new Error(error.message);
      return;
    }
    // Creator plan billing. Subscription payments are platform revenue and
    // never touch creator orders or ledgers.
    case "subscription.authenticated":
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed":
    case "subscription.pending":
    case "subscription.halted":
    case "subscription.cancelled":
    case "subscription.completed": {
      const sub = body.payload.subscription?.entity;
      if (!sub) return;
      const pay = body.event === "subscription.charged" ? body.payload.payment?.entity : null;
      await syncSubscription(sub, pay ? { id: pay.id, amount: pay.amount, status: pay.status } : null);
      // Backup for when the browser never reached /api/billing/verify. Keyed by
      // subscription, so renewals don't send it again.
      if (pay && (pay.status === "captured" || pay.status === "authorized")) {
        const owner = await firstPaymentOwner(sub.id);
        if (owner) await sendSubscribeEvent(owner, sub.id, pay.amount).catch(() => {});
      }
      return;
    }
    default:
      return;
  }
}
