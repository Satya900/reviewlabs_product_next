"use server";

import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { razorpay } from "@/lib/razorpay";
import { hasCreatorPlan } from "@/lib/plans";

export type StartResult = { error?: string; subscriptionId?: string; keyId?: string; name?: string; email?: string };

// Creates a Razorpay subscription for the Creator plan. The buyer authorises
// the mandate in Razorpay Checkout; the plan turns on once the first charge succeeds.
export async function startCreatorSubscription(): Promise<StartResult> {
  const profile = await requireCreator();
  if (profile.is_admin) return { error: "Admin accounts already have every feature." };
  // Includes "cancelling": a second subscription would charge twice for the overlap.
  if (hasCreatorPlan(profile)) return { error: "You're on the Creator plan until the end of this billing period." };

  try {
    const sub = await razorpay().subscriptions.create({
      plan_id: env.razorpayCreatorPlanId(),
      total_count: 120, // up to 10 years of monthly renewals
      customer_notify: 1,
      notes: { creator_id: profile.id, product: "reviewlabs_creator" },
    });
    await createAdminClient()
      .from("profiles")
      .update({ razorpay_subscription_id: sub.id, plan_status: "created" })
      .eq("id", profile.id);
    return { subscriptionId: sub.id, keyId: env.razorpayKeyId(), name: profile.name ?? "", email: profile.email };
  } catch (e) {
    const err = e as { error?: { description?: string }; message?: string };
    console.error("[billing] create subscription", err.error?.description ?? err.message);
    return { error: "We couldn't start the upgrade right now. Please try again." };
  }
}

// Cancels at the end of the paid period, so they keep Creator until then.
export async function cancelCreatorSubscription(): Promise<{ error?: string; ok?: string }> {
  const profile = await requireCreator();
  if (!profile.razorpay_subscription_id || profile.plan !== "creator") return { error: "There's no active subscription to cancel." };
  try {
    await razorpay().subscriptions.cancel(profile.razorpay_subscription_id, true);
  } catch (e) {
    const err = e as { error?: { description?: string }; message?: string };
    return { error: err.error?.description ?? "Couldn't cancel right now. Please try again." };
  }
  await createAdminClient().from("profiles").update({ plan_status: "cancelling" }).eq("id", profile.id);
  revalidatePath("/dashboard/billing");
  return { ok: "Cancelled. You keep Creator features until the end of this billing period." };
}
