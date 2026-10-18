import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay, verifyCheckoutSignature, type RazorpayPayment } from "@/lib/razorpay";
import { grantLifetime } from "@/lib/billing";
import { platformEventIds, sendLifetimeEvent, trackingFromRequest } from "@/lib/platform-meta";

const schema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// Called by Checkout after a lifetime payment. The webhook is the backup.
export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  const { data: purchase } = await createAdminClient().from("lifetime_purchases").select("creator_id").eq("razorpay_order_id", razorpay_order_id).maybeSingle();
  if (!purchase || purchase.creator_id !== profile.id) return NextResponse.json({ error: "Order does not belong to this account" }, { status: 403 });
  if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });

  try {
    const payment = (await razorpay().payments.fetch(razorpay_payment_id)) as unknown as RazorpayPayment;
    if (payment.order_id !== razorpay_order_id) return NextResponse.json({ error: "Payment does not match order" }, { status: 400 });
    if (payment.status !== "captured") return NextResponse.json({ status: "processing" });
    await grantLifetime(razorpay_order_id, payment.id, payment.amount);
    const tracking = trackingFromRequest(request);
    after(() => sendLifetimeEvent(profile.id, razorpay_order_id, payment.amount, tracking).catch((e) => console.warn("[billing/lifetime] purchase event:", e)));
    // The browser sends the same event with this ID for deduplication.
    return NextResponse.json({ status: "active", event: { id: platformEventIds.lifetime(razorpay_order_id), value: payment.amount / 100 } });
  } catch (e) {
    console.error("[billing/lifetime]", e);
    return NextResponse.json({ status: "processing" });
  }
}
