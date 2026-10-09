import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay, verifyCheckoutSignature, type RazorpayPayment } from "@/lib/razorpay";
import { recordCapturedPayment, runPostPaymentTasks } from "@/lib/fulfilment";

const schema = z.object({
  orderId: z.uuid(),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// Called by the Checkout success handler. The webhook remains the source of
// truth; this only speeds up the happy path for the buyer.
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, razorpay_order_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.razorpay_order_id !== razorpay_order_id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    const payment = (await razorpay().payments.fetch(razorpay_payment_id)) as unknown as RazorpayPayment;
    if (payment.order_id !== razorpay_order_id) {
      return NextResponse.json({ error: "Payment does not belong to this order" }, { status: 400 });
    }
    if (payment.status === "captured") {
      const result = await recordCapturedPayment(payment);
      if (result?.newly_paid) after(() => runPostPaymentTasks(result.order_id));
      return NextResponse.json({ status: "paid" });
    }
    await admin.rpc("mark_order_attempted", { p_razorpay_order_id: razorpay_order_id, p_failed: false });
    return NextResponse.json({ status: "processing" });
  } catch (e) {
    console.error("[verify]", e);
    // The webhook or reconciliation job will settle the order.
    return NextResponse.json({ status: "processing" });
  }
}
