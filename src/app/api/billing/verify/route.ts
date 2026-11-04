import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { verifySubscriptionSignature } from "@/lib/razorpay";
import { fetchSubscription, recordSubscriptionPayment, syncSubscription } from "@/lib/billing";
import { razorpay } from "@/lib/razorpay";
import { clickDataFromHeaders, firstPlanPayment, sendSubscribeEvent } from "@/lib/platform-meta";

const schema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// Called by Checkout after the creator authorises the subscription. Webhooks
// stay the source of truth; this only makes the upgrade feel instant.
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = parsed.data;

  // Their subscription, or the pending Pro subscription of an upgrade.
  if (profile.razorpay_subscription_id !== razorpay_subscription_id && profile.pending_subscription_id !== razorpay_subscription_id) {
    return NextResponse.json({ error: "Subscription does not belong to this account" }, { status: 403 });
  }
  if (!verifySubscriptionSignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature)) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
  }

  try {
    const sub = await fetchSubscription(razorpay_subscription_id);
    // The first charge (or an upgrade's prorated amount) comes back through Checkout; record it.
    const payment = (await razorpay().payments.fetch(razorpay_payment_id)) as unknown as { id: string; amount: number; status: string };
    await recordSubscriptionPayment(sub, payment);
    await syncSubscription(sub);
    // A creator's first plan payment is our ads' purchase. The browser sends
    // the same event with this ID, so Meta counts it once.
    const first = await firstPlanPayment(profile.id);
    if (!first) return NextResponse.json({ status: sub.status });
    const click = clickDataFromHeaders(request.headers);
    after(() => sendSubscribeEvent(profile.id, click).catch((e) => console.warn("[billing/verify] subscribe event:", e)));
    return NextResponse.json({ status: sub.status, event: { id: first.eventId, value: first.value, plan: first.plan } });
  } catch (e) {
    console.error("[billing/verify]", e);
    return NextResponse.json({ status: "processing" });
  }
}
