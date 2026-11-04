import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay, type RazorpayPayment } from "@/lib/razorpay";
import { recordCapturedPayment, runPostPaymentTasks } from "@/lib/fulfilment";
import { isAuthorizedCron } from "@/lib/cron";
import { fetchSubscription, grantLifetime, syncSubscription } from "@/lib/billing";
import { syncOpenPayouts } from "@/lib/payouts";
import { syncAllAccounts } from "@/lib/autodm-runner";
import { sendTrialEmails } from "@/lib/trial-emails";
import { sendInvoiceEmails } from "@/lib/invoices";
import { processBroadcasts } from "@/lib/broadcasts";
import { env } from "@/lib/env";

export const maxDuration = 60;

// Catches anything a missed webhook or a crashed request left behind.
// Reported to Sentry as a cron monitor: it alerts when a run fails, or when
// runs stop arriving (e.g. the Supabase pg_cron job or its secret broke).
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await Sentry.withMonitor("reconcile", reconcile, {
    schedule: { type: "crontab", value: "*/15 * * * *" },
    checkinMargin: 10,
    maxRuntime: 2,
    timezone: "UTC",
  });
  return NextResponse.json(summary);
}

async function reconcile() {
  const admin = createAdminClient();
  const now = Date.now();
  const summary = { checked: 0, recovered: 0, refundsSynced: 0, plansChecked: 0, postPaymentRetried: 0, payoutsSynced: 0, autodmSent: 0, trialEmails: 0, invoicesIssued: 0, invoicesEmailed: 0, broadcastEmails: 0, errors: 0 };

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

  // 3. Paid orders whose receipt didn't go out.
  const { data: unsentReceipts } = await admin
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .is("receipt_sent_at", null)
    .lt("paid_at", new Date(now - 5 * 60_000).toISOString())
    .limit(50);
  for (const { id: orderId } of unsentReceipts ?? []) {
    summary.postPaymentRetried++;
    await runPostPaymentTasks(orderId);
  }

  // 4. Paid plans past their paid period (missed renewal or cancel webhook):
  //    ask Razorpay for the real state.
  const { data: lapsed } = await admin
    .from("profiles")
    .select("id, razorpay_subscription_id")
    .in("plan", ["creator", "pro"])
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

  // 7. Instagram comments a webhook missed (AutoDM).
  if (env.autodmEnabled()) {
    try {
      const dm = await syncAllAccounts(20_000);
      summary.autodmSent = dm.sent;
      summary.errors += dm.errors;
    } catch (e) {
      summary.errors++;
      console.error("[reconcile] autodm:", e);
    }
  }

  // 8. Free trial ending soon or ended: one email each.
  try {
    const t = await sendTrialEmails();
    summary.trialEmails = t.reminders + t.ended;
  } catch (e) {
    summary.errors++;
    console.error("[reconcile] trial emails:", e);
  }

  // 9. GST invoices: plan payments still without one (e.g. paid before our
  //    GSTIN was set), then any invoice not yet emailed.
  try {
    const { data: issued, error } = await admin.rpc("issue_missing_invoices", { p_limit: 100 });
    if (error) throw new Error(error.message);
    summary.invoicesIssued = (issued as number) ?? 0;
    summary.invoicesEmailed = await sendInvoiceEmails();
  } catch (e) {
    summary.errors++;
    console.error("[reconcile] invoices:", e);
  }

  // 10. Email broadcasts still queued (e.g. held back by the daily cap).
  try {
    summary.broadcastEmails = (await processBroadcasts(15_000)).sent;
  } catch (e) {
    summary.errors++;
    console.error("[reconcile] broadcasts:", e);
  }

  // 11. Housekeeping: rate-limit windows older than a day are useless.
  await admin.from("rate_limits").delete().lt("window_start", new Date(now - 86_400_000).toISOString());

  return summary;
}
