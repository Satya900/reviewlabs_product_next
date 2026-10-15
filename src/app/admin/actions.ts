"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay } from "@/lib/razorpay";
import { rupeesToPaise } from "@/lib/money";

export type ActionState = { error?: string; ok?: string } | null;

const payoutSchema = z.object({
  creator_id: z.uuid(),
  amount: z.string(),
  method: z.enum(["upi", "bank_transfer", "other"]),
  reference: z.string().trim().max(100),
  note: z.string().trim().max(500),
});

export async function recordPayout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = payoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const amount = rupeesToPaise(parsed.data.amount);
  if (!amount || amount <= 0) return { error: "Enter a valid amount" };
  if (!parsed.data.reference) return { error: "Add the UTR / reference so this payout can be traced" };

  const { error } = await createAdminClient().rpc("record_payout", {
    p_creator_id: parsed.data.creator_id,
    p_amount_paise: amount,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference,
    p_note: parsed.data.note || null,
    p_created_by: admin.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/creators/${parsed.data.creator_id}`);
  revalidatePath("/admin");
  return { ok: "Payout recorded" };
}

const adjustmentSchema = z.object({
  creator_id: z.uuid(),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Amount like 100 or -49.50"),
  description: z.string().trim().min(3, "Explain the adjustment").max(300),
});

export async function addAdjustment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = adjustmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const negative = parsed.data.amount.startsWith("-");
  const paise = rupeesToPaise(parsed.data.amount.replace(/^-/, ""));
  if (!paise) return { error: "Amount can't be zero" };

  const { error } = await createAdminClient().from("ledger_entries").insert({
    creator_id: parsed.data.creator_id,
    entry_type: "adjustment",
    amount_paise: negative ? -paise : paise,
    description: parsed.data.description,
    idempotency_key: `adj:${crypto.randomUUID()}`,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/creators/${parsed.data.creator_id}`);
  return { ok: "Adjustment added" };
}

const grantSchema = z.object({ creator_id: z.uuid(), days: z.coerce.number().int().min(1).max(3650) });

// Gives a creator the Creator plan without a Razorpay subscription (comps, partners).
export async function grantCreatorPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = grantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter the number of days" };
  const until = new Date(Date.now() + parsed.data.days * 86_400_000).toISOString();
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ plan: "creator", plan_status: "active", plan_current_period_end: until })
    .eq("id", parsed.data.creator_id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/creators/${parsed.data.creator_id}`);
  revalidatePath("/admin");
  return { ok: `Creator plan active until ${until.slice(0, 10)}` };
}

const feeSchema = z.object({ creator_id: z.uuid(), fee: z.string().trim() });

// Custom plan deals: a fixed fee rate for one creator. Empty = standard 6% / 4%.
export async function setCreatorFee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = feeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid input" };
  let bps: number | null = null;
  if (parsed.data.fee) {
    const pct = Number(parsed.data.fee);
    if (!Number.isFinite(pct) || pct < 0 || pct > 50) return { error: "Enter a fee between 0 and 50" };
    bps = Math.round(pct * 100);
  }
  const { error } = await createAdminClient().from("profiles").update({ commission_bps: bps }).eq("id", parsed.data.creator_id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/creators/${parsed.data.creator_id}`);
  return { ok: bps === null ? "Back to standard fees (6% Free / 4% Creator)" : `Custom fee set to ${bps / 100}% per sale` };
}

export async function revokeCreatorPlan(creatorId: string): Promise<ActionState> {
  await requireAdmin();
  const { error } = await createAdminClient().rpc("downgrade_to_free", { p_creator_id: creatorId, p_status: "cancelled" });
  if (error) return { error: error.message };
  revalidatePath(`/admin/creators/${creatorId}`);
  revalidatePath("/admin");
  return { ok: "Moved to Free. Pages beyond the oldest live one are now drafts." };
}

const refundSchema = z.object({
  order_id: z.uuid(),
  amount: z.string().optional(),
  reason: z.string().trim().max(200).optional(),
});

export async function refundOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = refundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid input" };
  const db = createAdminClient();

  const { data: order } = await db
    .from("orders")
    .select("id, amount_paise, status, razorpay_payment_id, refunds(amount_paise, status)")
    .eq("id", parsed.data.order_id)
    .single();
  if (!order?.razorpay_payment_id || !["paid", "partially_refunded"].includes(order.status)) {
    return { error: "Only paid orders can be refunded" };
  }

  const alreadyRefunded = (order.refunds ?? [])
    .filter((r: { status: string }) => r.status !== "failed")
    .reduce((sum: number, r: { amount_paise: number }) => sum + r.amount_paise, 0);
  const refundable = order.amount_paise - alreadyRefunded;
  const amount = parsed.data.amount ? rupeesToPaise(parsed.data.amount) : refundable;
  if (!amount || amount <= 0 || amount > refundable) return { error: `You can refund up to ₹${(refundable / 100).toFixed(2)}` };

  try {
    const refund = await razorpay().payments.refund(order.razorpay_payment_id, {
      amount,
      notes: { reason: parsed.data.reason || "Refund by admin", order_id: order.id },
    });
    // Ledger is written when the refund is processed (here or via webhook).
    const { error } = await db.rpc("record_refund", {
      p_razorpay_refund_id: refund.id,
      p_razorpay_payment_id: order.razorpay_payment_id,
      p_amount_paise: refund.amount ?? amount,
      p_status: refund.status === "processed" ? "processed" : "pending",
      p_reason: parsed.data.reason || null,
    });
    if (error) return { error: `Refund created at Razorpay (${refund.id}) but not recorded: ${error.message}. The webhook will retry.` };
  } catch (e) {
    const err = e as { error?: { description?: string }; message?: string };
    return { error: err.error?.description ?? err.message ?? "Refund failed" };
  }
  revalidatePath("/admin/orders");
  return { ok: "Refund initiated" };
}
