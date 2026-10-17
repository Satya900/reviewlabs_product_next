import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayoutWebhookSignature } from "@/lib/razorpay";
import { applyPayout, type RazorpayXPayout } from "@/lib/payouts";

type WebhookBody = { event: string; payload: { payout?: { entity: RazorpayXPayout } } };

// RazorpayX payout status updates (processed, reversed, failed, UTR, ...).
export async function POST(request: Request) {
  if (!process.env.RAZORPAYX_WEBHOOK_SECRET) return NextResponse.json({ error: "Payout webhooks aren't configured" }, { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!signature || !verifyPayoutWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const body = JSON.parse(rawBody) as WebhookBody;
  const payout = body.payload.payout?.entity;
  if (!body.event.startsWith("payout.") || !payout) return NextResponse.json({ ok: true, ignored: true });

  const eventId = request.headers.get("x-razorpay-event-id") ?? `${body.event}:${payout.id}:${payout.status}:${payout.utr ?? ""}`;
  const admin = createAdminClient();
  await admin
    .from("webhook_events")
    .upsert({ event_id: eventId, event_type: body.event, payload: body }, { onConflict: "event_id", ignoreDuplicates: true });
  const { data: stored } = await admin.from("webhook_events").select("processed_at").eq("event_id", eventId).single();
  if (stored?.processed_at) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const status = await applyPayout(payout);
    await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("event_id", eventId);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    const message = (e as Error).message;
    console.error(`[webhook:x] ${body.event} ${eventId}:`, message);
    await admin.from("webhook_events").update({ error: message }).eq("event_id", eventId);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
