import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay } from "@/lib/razorpay";
import { emailInvoicesSoon } from "@/lib/invoices";

// The subset of Razorpay's subscription entity we use.
export type RazorpaySubscription = {
  id: string;
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired" | "paused";
  current_end?: number | null;
  start_at?: number | null;
  ended_at?: number | null;
  notes?: Record<string, string> | unknown[];
};

const toIso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

function noteValue(sub: RazorpaySubscription, key: string): string | undefined {
  return sub.notes && !Array.isArray(sub.notes) ? sub.notes[key] : undefined;
}

// Creator or Pro. Subscriptions from before Pro existed are Creator.
const tierOf = (sub: RazorpaySubscription): "creator" | "pro" => (noteValue(sub, "tier") === "pro" ? "pro" : "creator");

// Records a plan payment that arrives through Checkout (the first charge).
export async function recordSubscriptionPayment(sub: RazorpaySubscription, payment: { id: string; amount: number; status: string }) {
  const owner = await creatorForSubscription(sub);
  if (!owner || (payment.status !== "captured" && payment.status !== "authorized")) return;
  await createAdminClient().from("subscription_payments").upsert(
    {
      creator_id: owner.id,
      razorpay_subscription_id: sub.id,
      razorpay_payment_id: payment.id,
      amount_paise: payment.amount,
      status: payment.status,
      period_end: toIso(sub.current_end ?? sub.start_at),
      raw: payment,
    },
    { onConflict: "razorpay_payment_id" },
  );
  emailInvoicesSoon(); // the database issued the GST invoice with the payment
}

async function creatorForSubscription(sub: RazorpaySubscription) {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, razorpay_subscription_id, plan_status, plan_current_period_end").eq("razorpay_subscription_id", sub.id).maybeSingle();
  return data;
}

// Applies a subscription's current state to the creator who owns it.
// Events for an old subscription the creator has since replaced are ignored.
export async function syncSubscription(sub: RazorpaySubscription, payment?: { id: string; amount: number; status: string } | null) {
  const owner = await creatorForSubscription(sub);
  if (!owner) return;
  const admin = createAdminClient();

  if (payment && (payment.status === "captured" || payment.status === "authorized")) {
    await admin.from("subscription_payments").upsert(
      {
        creator_id: owner.id,
        razorpay_subscription_id: sub.id,
        razorpay_payment_id: payment.id,
        amount_paise: payment.amount,
        status: payment.status,
        period_end: toIso(sub.current_end),
        raw: payment,
      },
      { onConflict: "razorpay_payment_id" },
    );
    emailInvoicesSoon();
  }

  switch (sub.status) {
    case "active":
      await admin
        .from("profiles")
        .update({
          plan: tierOf(sub),
          // Keep "cancelling" if they already asked to cancel at period end.
          plan_status: owner.plan_status === "cancelling" ? "cancelling" : "active",
          plan_current_period_end: toIso(sub.current_end),
        })
        .eq("id", owner.id);
      return;
    case "pending":
      // Razorpay is retrying the renewal; access continues during the grace period.
      await admin.from("profiles").update({ plan_status: "past_due" }).eq("id", owner.id);
      return;
    case "authenticated": {
      // Subscribed during the trial: autopay is set up and billing starts at
      // start_at, the end of the trial. The plan runs until then. (Older
      // subscriptions did the same for the ₹99 intro month.)
      const startsLater = sub.start_at && sub.start_at * 1000 > Date.now();
      const deferred = noteValue(sub, "after_trial") === "yes" || noteValue(sub, "intro") === "yes";
      if (!startsLater || !deferred) return;
      await admin
        .from("profiles")
        .update({
          plan: tierOf(sub),
          plan_status: owner.plan_status === "cancelling" ? "cancelling" : "active",
          plan_current_period_end: toIso(sub.start_at),
        })
        .eq("id", owner.id);
      return;
    }
    case "cancelled": {
      // Cancelled before the paid time ran out (e.g. before billing started):
      // keep the plan until then; the reconcile job ends it afterwards.
      const paidUntil = owner.plan_current_period_end ? new Date(owner.plan_current_period_end).getTime() : 0;
      if (owner.plan_status === "cancelling" && paidUntil > Date.now()) return;
      await admin.rpc("downgrade_to_free", { p_creator_id: owner.id, p_status: "cancelled" });
      return;
    }
    case "halted":
    case "completed":
    case "expired": {
      const status = sub.status === "completed" ? "expired" : sub.status;
      await admin.rpc("downgrade_to_free", { p_creator_id: owner.id, p_status: status });
      return;
    }
    default:
      return; // created: waiting for the first charge
  }
}

export async function fetchSubscription(id: string): Promise<RazorpaySubscription> {
  return (await razorpay().subscriptions.fetch(id)) as unknown as RazorpaySubscription;
}

// Lifetime plan: a one-time order. Marks it paid, gives Creator for good and
// cancels any subscription the creator had so they are never charged again.
export async function grantLifetime(orderId: string, paymentId: string, amountPaise: number) {
  const { data, error } = await createAdminClient()
    .rpc("grant_lifetime", { p_razorpay_order_id: orderId, p_razorpay_payment_id: paymentId, p_amount_paise: amountPaise })
    .maybeSingle<{ creator_id: string; newly_granted: boolean; old_subscription_id: string | null }>();
  if (error) throw new Error(`grant_lifetime failed: ${error.message}`);
  if (data?.newly_granted) emailInvoicesSoon();
  if (data?.newly_granted && data.old_subscription_id) {
    try {
      await razorpay().subscriptions.cancel(data.old_subscription_id, false);
    } catch (e) {
      // Already cancelled or completed is fine; anything else needs a look.
      const err = e as { error?: { description?: string }; message?: string };
      console.error(`[billing] cancel ${data.old_subscription_id} after lifetime:`, err.error?.description ?? err.message);
    }
  }
  return data;
}

export function isLifetimePayment(payment: { notes?: Record<string, string> | unknown[] }) {
  return !!payment.notes && !Array.isArray(payment.notes) && payment.notes.product === "reviewlabs_lifetime";
}
