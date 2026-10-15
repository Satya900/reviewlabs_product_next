"use server";

import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { razorpay } from "@/lib/razorpay";
import { CREATOR_INTRO_PAISE, hasCreatorPlan } from "@/lib/plans";

export type StartResult = { error?: string; subscriptionId?: string; keyId?: string; name?: string; email?: string; intro?: boolean };

const INTRO_DAYS = 30;

// Creates a Razorpay subscription for the Creator plan. The buyer authorises
// the mandate in Razorpay Checkout; the plan turns on once the first charge succeeds.
// First-time monthly subscribers pay the intro price now, and regular monthly
// billing starts after the intro month.
export async function startCreatorSubscription(interval: "month" | "year"): Promise<StartResult> {
  const profile = await requireCreator();
  if (profile.is_admin) return { error: "Admin accounts already have every feature." };
  // Includes "cancelling": a second subscription would charge twice for the overlap.
  if (hasCreatorPlan(profile)) return { error: "You're on the Creator plan until the end of this billing period." };
  if (interval !== "month" && interval !== "year") return { error: "Choose monthly or yearly billing." };

  const admin = createAdminClient();
  // Intro price only for people who have never paid for Creator before.
  const { count: paidBefore } = await admin.from("subscription_payments").select("id", { count: "exact", head: true }).eq("creator_id", profile.id);
  const intro = interval === "month" && !profile.intro_used && !paidBefore;

  try {
    const sub = await razorpay().subscriptions.create({
      plan_id: interval === "year" ? env.razorpayPlanYearlyId() : env.razorpayPlanMonthlyId(),
      total_count: interval === "year" ? 10 : 120, // up to 10 years of renewals
      customer_notify: 1,
      ...(intro
        ? {
            start_at: Math.floor(Date.now() / 1000) + INTRO_DAYS * 86_400,
            addons: [{ item: { name: "Creator plan: first month", amount: CREATOR_INTRO_PAISE, currency: "INR" } }],
          }
        : {}),
      notes: { creator_id: profile.id, product: "reviewlabs_creator", interval, intro: intro ? "yes" : "no" },
    });
    await admin
      .from("profiles")
      .update({ razorpay_subscription_id: sub.id, plan_status: "created", plan_interval: interval })
      .eq("id", profile.id);
    return { subscriptionId: sub.id, keyId: env.razorpayKeyId(), name: profile.name ?? "", email: profile.email, intro };
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
    const sub = (await razorpay().subscriptions.fetch(profile.razorpay_subscription_id)) as unknown as { status: string };
    // During the intro month billing hasn't started, so cancel now; access still
    // runs to the end of the paid month (see syncSubscription).
    await razorpay().subscriptions.cancel(profile.razorpay_subscription_id, sub.status !== "authenticated");
  } catch (e) {
    const err = e as { error?: { description?: string }; message?: string };
    return { error: err.error?.description ?? "Couldn't cancel right now. Please try again." };
  }
  await createAdminClient().from("profiles").update({ plan_status: "cancelling" }).eq("id", profile.id);
  revalidatePath("/dashboard/billing");
  return { ok: "Cancelled. You keep Creator features until the end of this billing period." };
}
