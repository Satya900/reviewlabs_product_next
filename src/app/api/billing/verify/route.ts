import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { verifySubscriptionSignature } from "@/lib/razorpay";
import { fetchSubscription, syncSubscription } from "@/lib/billing";

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

  if (profile.razorpay_subscription_id !== razorpay_subscription_id) {
    return NextResponse.json({ error: "Subscription does not belong to this account" }, { status: 403 });
  }
  if (!verifySubscriptionSignature(razorpay_payment_id, razorpay_subscription_id, razorpay_signature)) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
  }

  try {
    const sub = await fetchSubscription(razorpay_subscription_id);
    await syncSubscription(sub);
    return NextResponse.json({ status: sub.status });
  } catch (e) {
    console.error("[billing/verify]", e);
    return NextResponse.json({ status: "processing" });
  }
}
