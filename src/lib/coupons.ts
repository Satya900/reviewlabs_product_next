import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { creatorHasPlan } from "@/lib/plans-server";

export type Coupon = {
  id: string;
  creator_id: string;
  page_id: string | null;
  code: string;
  discount_type: "percent" | "flat";
  value: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

export type CouponResult =
  | { ok: true; coupon: Coupon; discountPaise: number; finalPaise: number }
  | { ok: false; error: string };

// Razorpay's minimum charge is ₹1.
const MIN_CHARGE_PAISE = 100;

export function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export function discountFor(coupon: Pick<Coupon, "discount_type" | "value">, pricePaise: number) {
  const raw = coupon.discount_type === "percent" ? Math.floor((pricePaise * coupon.value) / 100) : coupon.value;
  return Math.min(raw, pricePaise);
}

// Validates a code for a page and returns the price after discount.
export async function applyCoupon(page: { id: string; creator_id: string; amount_paise: number }, rawCode: string): Promise<CouponResult> {
  const code = normalizeCode(rawCode);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { ok: false, error: "That coupon code isn't valid" };
  // Coupons only work while the seller is on the Creator plan.
  if (!(await creatorHasPlan(page.creator_id))) return { ok: false, error: "That coupon code isn't valid for this product" };

  const { data: coupon } = await createAdminClient()
    .from("coupons")
    .select("*")
    .eq("creator_id", page.creator_id)
    .eq("code", code)
    .maybeSingle<Coupon>();

  if (!coupon || !coupon.active || (coupon.page_id && coupon.page_id !== page.id)) {
    return { ok: false, error: "That coupon code isn't valid for this product" };
  }
  if (coupon.expires_at && new Date(coupon.expires_at) <= new Date()) return { ok: false, error: "That coupon has expired" };
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) return { ok: false, error: "That coupon has been fully used" };

  const discountPaise = discountFor(coupon, page.amount_paise);
  const finalPaise = page.amount_paise - discountPaise;
  if (finalPaise < MIN_CHARGE_PAISE) return { ok: false, error: "That coupon can't be used on this product" };
  return { ok: true, coupon, discountPaise, finalPaise };
}
