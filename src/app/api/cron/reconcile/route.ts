import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay, type RazorpayPayment } from "@/lib/razorpay";
import { recordCapturedPayment, runPostPaymentTasks } from "@/lib/fulfilment";
import { isAuthorizedCron } from "@/lib/cron";
import { fetchSubscription, grantLifetime, syncSubscription } from "@/lib/billing";
import { syncOpenPayouts } from "@/lib/payouts";

export const maxDuration = 60;

// Catches anything a missed webhook or a crashed request left behind.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const now = Date.now();
  const summary = { checked: 0, recovered: 0, refundsSynced: 0, plansChecked: 0, postPaymentRetried: 0, payoutsSynced: 0, errors: 0 };

  // 1. Unpaid orders 10 minutes to 3 days old: ask Razorpay what happened.
  const { data: pending } = await admin
    .from("orders")
    .select("id, razorpay_order_id")
    .in("status", ["created", "attempted", "failed"])
    .not("razorpay_order_id", "is", null)
    .lt("created_at", new Date(now - 10 * 60_000).toISOString())
    .gt("created_at", new Date(now - 3 * 86_400_000).toISOString())
    .order("created_at", { ascending: true })
    .limit(50);

  for (const order of pending ?? []) {
    summary.checked++;
    try {
      const { items } = await razorpay().orders.fetchPayments(order.razorpay_order_id!);
      const captured = (items as unknown as RazorpayPayment[]).find((p) => p.status === "captured");
      if (captured) {
        const result = await recordCapturedPayment(captured);
        if (result?.newly_paid) {
          summary.recovered++;
          await runPostPaymentTasks(result.order_id);
        }
      }
    } catch (e) {
      summary.errors++;
      console.error(`[reconcile] order ${order.id}:`, e);
    }
  }

  // 2. Refunds from the last 3 days (incl. ones issued in the Razorpay dashboard)
  //    whose webhook never arrived. record_refund is idempotent and ignores
  //    payments that aren't ours.
  const from = Math.floor((now - 3 * 86_400_000) / 1000);
  for (let skip = 0; skip < 500; skip += 100) {
    let items: { id: string; payment_id: string; amount: number; status: string; notes?: Record<string, string> | unknown[] }[];
    try {
      const page = await razorpay().refunds.all({ from, count: 100, skip });
      items = page.items as unknown as typeof items;
    } catch (e) {
      summary.errors++;
      console.error("[reconcile] list refunds:", e);
      break;
    }
    for (const refund of items) {
      const notes = Array.isArray(refund.notes) ? {} : (refund.notes ?? {});
      const { error } = await admin.rpc("record_refund", {
        p_razorpay_refund_id: refund.id,
        p_razorpay_payment_id: refund.payment_id,
        p_amount_paise: refund.amount,
        p_status: refund.status,
        p_reason: (notes as Record<string, string>).reason ?? null,
      });
      if (error) {
        summary.errors++;
        console.error(`[reconcile] refund ${refund.id}:`, error.message);
      } else {
        summary.refundsSynced++;
      }
    }
    if (items.length < 100) break;
  }

  // 3. Paid orders whose receipt or Meta Purchase event didn't go out.
  const { data: unsentReceipts } = await admin
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .is("receipt_sent_at", null)
    .lt("paid_at", new Date(now - 5 * 60_000).toISOString())
    .limit(50);
  const { data: failedEvents } = await admin
    .from("meta_events")
    .select("order_id")
    .eq("event_name", "Purchase")
    .eq("status", "failed")
    .lt("attempts", 5)
    .limit(50);

  const retry = new Set<string>([
    ...(unsentReceipts ?? []).map((o) => o.id as string),
    ...(failedEvents ?? []).map((e) => e.order_id as string).filter(Boolean),
  ]);
  for (const orderId of retry) {
    summary.postPaymentRetried++;
    await runPostPaymentTasks(orderId);
  }

  // 4. Creator plans past their paid period (missed renewal or cancel webhook):
  //    ask Razorpay for the real state.
  const { data: lapsed } = await admin
    .from("profiles")
    .select("id, razorpay_subscription_id")
    .eq("plan", "creator")
    .eq("is_admin", false)
    .lt("plan_current_period_end", new Date(now - 3600_000).toISOString())
    .limit(50);
  for (const p of lapsed ?? []) {
    summary.plansChecked++;
    try {
      if (p.razorpay_subscription_id) {
        await syncSubscription(await fetchSubscription(p.razorpay_subscription_id));
      } else {
        // A plan granted by an admin without a subscription has simply run out.
        await admin.rpc("downgrade_to_free", { p_creator_id: p.id, p_status: "expired" });
      }
    } catch (e) {
      summary.errors++;
      console.error(`[reconcile] plan ${p.id}:`, e);
    }
  }

  // 5. Lifetime payments whose confirmation never arrived.
  const { data: lifetime } = await admin
    .from("lifetime_purchases")
    .select("razorpay_order_id")
    .eq("status", "created")
    .lt("created_at", new Date(now - 10 * 60_000).toISOString())
    .gt("created_at", new Date(now - 3 * 86_400_000).toISOString())
    .limit(50);
  for (const lp of lifetime ?? []) {
    try {
      const { items } = await razorpay().orders.fetchPayments(lp.razorpay_order_id);
      const captured = (items as unknown as RazorpayPayment[]).find((p) => p.status === "captured");
      if (captured && (await grantLifetime(lp.razorpay_order_id, captured.id, captured.amount))?.newly_granted) summary.recovered++;
    } catch (e) {
      summary.errors++;
      console.error(`[reconcile] lifetime ${lp.razorpay_order_id}:`, e);
    }
  }

  // 6. Creator payouts still queued or processing (missed RazorpayX webhooks).
  try {
    const payouts = await syncOpenPayouts();
    summary.payoutsSynced = payouts.synced;
    summary.errors += payouts.errors;
  } catch (e) {
    summary.errors++;
    console.error("[reconcile] payouts:", e);
  }

  // 7. Housekeeping: rate-limit windows older than a day are useless.
  await admin.from("rate_limits").delete().lt("window_start", new Date(now - 86_400_000).toISOString());

  return NextResponse.json(summary);
}
