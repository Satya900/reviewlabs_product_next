"use server";

import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { razorpay } from "@/lib/razorpay";
import { currentTier, planName, type Interval, type Tier } from "@/lib/plans";

export type StartResult = { error?: string; subscriptionId?: string; keyId?: string; name?: string; email?: string; startsAfterTrial?: boolean };

// Creates a Razorpay subscription for Creator or Pro. The creator authorises
// the mandate in Razorpay Checkout. During the trial, billing starts when the
// trial ends, so no trial days are lost; otherwise the first charge is now.
export async function startSubscription(tier: Tier, interval: Interval): Promise<StartResult> {
  const profile = await requireCreator();
  if (profile.is_admin) return { error: "Admin accounts already have every feature." };
  if ((tier !== "creator" && tier !== "pro") || (interval !== "month" && interval !== "year")) return { error: "Choose a plan and billing period." };
  const now = currentTier(profile);
  if (profile.plan_interval === "lifetime" && now === "creator") return { error: "You have lifetime Creator. To add AutoDM, write to us and we'll set up Pro for you." };
  // Includes "cancelling": a second subscription would charge twice for the overlap.
  if (now === "creator" || now === "pro") {
    return { error: `You're on ${planName(now)} until the end of this billing period. To switch plans, write to us and we'll move you over.` };
  }

  // Start billing at the end of the trial if more than an hour of it is left.
  const trialEnd = profile.trial_ends_at ? Math.floor(new Date(profile.trial_ends_at).getTime() / 1000) : 0;
  const startsAfterTrial = now === "trial" && trialEnd - Date.now() / 1000 > 3600;

  try {
    const sub = await razorpay().subscriptions.create({
      plan_id: env.razorpayPlanId(tier, interval),
      total_count: interval === "year" ? 10 : 120, // up to 10 years of renewals
      customer_notify: 1,
      ...(startsAfterTrial ? { start_at: trialEnd } : {}),
      notes: { creator_id: profile.id, product: "reviewlabs_plan", tier, interval, after_trial: startsAfterTrial ? "yes" : "no" },
    });
    await createAdminClient()
      .from("profiles")
      .update({ razorpay_subscription_id: sub.id, plan_status: "created", plan_interval: interval })
      .eq("id", profile.id);
    return { subscriptionId: sub.id, keyId: env.razorpayKeyId(), name: profile.name ?? "", email: profile.email, startsAfterTrial };
  } catch (e) {
    const err = e as { error?: { description?: string }; message?: string };
    console.error("[billing] create subscription", err.error?.description ?? err.message);
    return { error: "We couldn't start the subscription right now. Please try again." };
  }
}

// Cancels at the end of the paid period, so they keep their plan until then.
export async function cancelSubscription(): Promise<{ error?: string; ok?: string }> {
  const profile = await requireCreator();
  if (!profile.razorpay_subscription_id || (profile.plan !== "creator" && profile.plan !== "pro")) return { error: "There's no active subscription to cancel." };
  try {
    const sub = (await razorpay().subscriptions.fetch(profile.razorpay_subscription_id)) as unknown as { status: string };
    // Billing hasn't started yet (subscribed during the trial): cancel now.
    // Access still runs to the end of the trial (see syncSubscription).
    await razorpay().subscriptions.cancel(profile.razorpay_subscription_id, sub.status !== "authenticated");
  } catch (e) {
    const err = e as { error?: { description?: string }; message?: string };
    return { error: err.error?.description ?? "Couldn't cancel right now. Please try again." };
  }
  await createAdminClient().from("profiles").update({ plan_status: "cancelling" }).eq("id", profile.id);
  revalidatePath("/dashboard/billing");
  return { ok: `Cancelled. You keep ${planName(profile.plan as Tier)} until the end of this billing period.` };
}
