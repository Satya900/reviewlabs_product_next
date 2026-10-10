"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeCode } from "@/lib/coupons";
import { rupeesToPaise } from "@/lib/money";
import { hasCreatorPlan } from "@/lib/plans";

export type CouponState = { error?: string; ok?: string } | null;

const schema = z.object({
  code: z.string().transform(normalizeCode).pipe(z.string().regex(/^[A-Z0-9_-]{3,30}$/, "Code: 3 to 30 letters, numbers, _ or -")),
  discount_type: z.enum(["percent", "flat"]),
  value: z.string().trim().min(1, "Enter the discount"),
  page_id: z.union([z.uuid(), z.literal("")]),
  max_uses: z.union([z.coerce.number().int().positive(), z.literal("")]),
  expires_on: z.union([z.iso.date(), z.literal("")]),
});

export async function createCoupon(_prev: CouponState, formData: FormData): Promise<CouponState> {
  const profile = await requireCreator();
  if (!hasCreatorPlan(profile)) return { error: "Coupons are part of the Creator plan." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;

  let value: number;
  if (input.discount_type === "percent") {
    value = Number(input.value);
    if (!Number.isInteger(value) || value < 1 || value > 90) return { error: "Percent off must be a whole number from 1 to 90" };
  } else {
    const paise = rupeesToPaise(input.value);
    if (!paise || paise < 100) return { error: "Amount off must be at least ₹1" };
    value = paise;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("coupons").insert({
    creator_id: profile.id,
    code: input.code,
    discount_type: input.discount_type,
    value,
    page_id: input.page_id || null,
    max_uses: input.max_uses === "" ? null : input.max_uses,
    // End of the chosen day in IST.
    expires_at: input.expires_on ? `${input.expires_on}T23:59:59+05:30` : null,
  });
  if (error) return { error: error.code === "23505" ? "You already have a coupon with that code" : error.message };
  revalidatePath("/dashboard/coupons");
  return { ok: `Coupon ${input.code} created` };
}

export async function setCouponActive(id: string, active: boolean) {
  await requireCreator();
  const supabase = await createClient();
  await supabase.from("coupons").update({ active }).eq("id", id);
  revalidatePath("/dashboard/coupons");
}

export async function deleteCoupon(id: string) {
  await requireCreator();
  const supabase = await createClient();
  // Used coupons stay for the record; they can only be switched off.
  await supabase.from("coupons").delete().eq("id", id).eq("used_count", 0);
  revalidatePath("/dashboard/coupons");
}
