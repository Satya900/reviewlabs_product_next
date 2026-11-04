"use server";

import { revalidatePath } from "next/cache";
import { requireCreator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { razorpay } from "@/lib/razorpay";
import { canUpgradeInOneClick, currentTier, planName, upgradeQuote, type Interval, type Tier } from "@/lib/plans";
import { isValidGstin, stateName } from "@/lib/gst";

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

// Name, state, address and optional GSTIN printed on the creator's GST invoices.
// Applies to invoices issued from now on; issued invoices never change.
export async function saveBillingDetails(_prev: { error?: string; ok?: string } | null, formData: FormData): Promise<{ error?: string; ok?: string }> {
  const profile = await requireCreator();
  const text = (k: string, max: number) => String(formData.get(k) ?? "").trim().slice(0, max);
  const name = text("billing_name", 200);
  const gstin = text("billing_gstin", 15).toUpperCase();
  const address = text("billing_address", 500);
  let stateCode = text("billing_state_code", 2);
  if (!name) return { error: "Enter the name for your invoices." };
  if (gstin) {
    if (!isValidGstin(gstin)) return { error: "That GSTIN doesn't look right. Check it on your GST certificate." };
    stateCode = gstin.slice(0, 2); // a GSTIN's state is its first two digits
  }
  if (!stateName(stateCode)) return { error: "Choose your state." };
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ billing_name: name, billing_gstin: gstin || null, billing_state_code: stateCode, billing_address: address || null })
    .eq("id", profile.id);
  if (error) return { error: "Couldn't save right now. Please try again." };
  revalidatePath("/dashboard/billing");
  return { ok: gstin ? "Saved. New invoices will include your GSTIN." : "Saved." };
}

export type UpgradeResult = { error?: string; subscriptionId?: string; keyId?: string; name?: string; email?: string; amountPaise?: number; startsOn?: string };

// Creator → Pro now. A new Pro subscription starts when the Creator period
// ends; the prorated difference is charged upfront when the creator approves
// it in Checkout. Their Creator subscription stops renewing once that's done.
export async function startUpgrade(): Promise<UpgradeResult> {
  const profile = await requireCreator();
  if (!canUpgradeInOneClick(profile)) return { error: "Upgrading in one click needs an active monthly or yearly Creator plan. Write to us and we'll move you to Pro." };
  const interval = profile.plan_interval as Interval;
  try {
    const current = (await razorpay().subscriptions.fetch(profile.razorpay_subscription_id!)) as unknown as { status: string; current_end: number | null };
    if (current.status !== "active" || !current.current_end) return { error: "Your Creator plan isn't active right now. Please try again later or write to us." };
    // Razorpay needs the new start in the future; a renewal minutes away is about to charge anyway.
    if (current.current_end * 1000 - Date.now() < 30 * 60_000) return { error: "Your Creator plan renews in the next few minutes. Please try again in an hour." };
    const quote = upgradeQuote(interval, new Date(current.current_end * 1000));

    // A previous upgrade the creator didn't finish: drop it first.
    if (profile.pending_subscription_id) {
      await razorpay().subscriptions.cancel(profile.pending_subscription_id, false).catch(() => null);
    }
    const sub = await razorpay().subscriptions.create({
      plan_id: env.razorpayPlanId("pro", interval),
      total_count: interval === "year" ? 10 : 120,
      customer_notify: 1,
      start_at: current.current_end,
      addons: [{ item: { name: "Upgrade to Pro (prorated)", amount: quote.paise, currency: "INR" } }],
      notes: { creator_id: profile.id, product: "reviewlabs_plan", tier: "pro", interval, upgrade: "yes", from_subscription: profile.razorpay_subscription_id! },
    } as never) as unknown as { id: string };
    await createAdminClient().from("profiles").update({ pending_subscription_id: sub.id }).eq("id", profile.id);
    return {
      subscriptionId: sub.id,
      keyId: env.razorpayKeyId(),
      name: profile.name ?? "",
      email: profile.email,
      amountPaise: quote.paise,
      startsOn: new Date(current.current_end * 1000).toISOString(),
    };
  } catch (e) {
    const err = e as { error?: { description?: string }; message?: string };
    console.error("[billing] start upgrade", err.error?.description ?? err.message);
    return { error: "We couldn't start the upgrade right now. Please try again." };
  }
}
