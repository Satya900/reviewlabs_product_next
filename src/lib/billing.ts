import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay } from "@/lib/razorpay";

// The subset of Razorpay's subscription entity we use.
export type RazorpaySubscription = {
  id: string;
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired" | "paused";
  current_end?: number | null;
  ended_at?: number | null;
  notes?: Record<string, string> | unknown[];
};

const toIso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

async function creatorForSubscription(sub: RazorpaySubscription) {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, razorpay_subscription_id, plan_status").eq("razorpay_subscription_id", sub.id).maybeSingle();
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
  }

  switch (sub.status) {
    case "active":
      await admin
        .from("profiles")
        .update({
          plan: "creator",
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
    case "halted":
    case "cancelled":
    case "completed":
    case "expired": {
      const status = sub.status === "completed" ? "expired" : sub.status;
      await admin.rpc("downgrade_to_free", { p_creator_id: owner.id, p_status: status });
      return;
    }
    default:
      return; // created / authenticated: waiting for the first charge
  }
}

export async function fetchSubscription(id: string): Promise<RazorpaySubscription> {
  return (await razorpay().subscriptions.fetch(id)) as unknown as RazorpaySubscription;
}
