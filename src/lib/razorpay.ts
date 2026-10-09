import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "@/lib/env";

let instance: Razorpay | null = null;

export function razorpay(): Razorpay {
  instance ??= new Razorpay({ key_id: env.razorpayKeyId(), key_secret: env.razorpayKeySecret() });
  return instance;
}

function safeEqualHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Checkout handler signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", env.razorpayKeySecret())
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

// Webhook signature: HMAC_SHA256(raw body, webhook secret)
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret()).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

// The subset of Razorpay's payment entity we rely on.
export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string;
  fee?: number | null;
  tax?: number | null;
  email?: string;
  contact?: string;
};
