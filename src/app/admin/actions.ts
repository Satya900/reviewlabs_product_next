"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { razorpay } from "@/lib/razorpay";
import { formatPaise, rupeesToPaise } from "@/lib/money";
import { payCreator, recordManualPayout } from "@/lib/payouts";
import { emailCreatorRejected } from "@/lib/payout-requests";
import { sendVerificationEmail } from "@/lib/email-verification";

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

// Sends the creator's available balance (or a smaller amount) through RazorpayX now.
export async function payCreatorNow(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const creatorId = z.uuid().safeParse(formData.get("creator_id"));
  if (!creatorId.success) return { error: "Invalid creator" };
  const raw = String(formData.get("amount") ?? "").trim();
  const max = raw ? rupeesToPaise(raw) : undefined;
  if (raw && (!max || max < 100)) return { error: "Enter at least ₹1, or leave it empty to pay the full available balance" };
  try {
    const result = await payCreator(creatorId.data, { createdBy: admin.id, maxPaise: max ?? undefined, minPaise: 100 });
    revalidatePath(`/admin/creators/${creatorId.data}`);
    revalidatePath("/admin/payouts");
    if (!result.ok) return { error: result.reason };
    if (result.status === "failed" || result.status === "cancelled") return { error: "RazorpayX refused this payout. The reason is in the payouts list and the money is back on the balance." };
    return { ok: `${formatPaise(result.amountPaise)} ${result.status === "processed" ? "sent" : `payout created (${result.status})`}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ---------------------------------------------------------------- payout requests

const approveSchema = z.object({
  request_id: z.uuid(),
  utr: z.string().trim().min(6, "Paste the UTR / transaction reference from your bank or UPI app").max(40),
});

// Manual mode: the admin sent the requested amount from their bank or UPI app,
// then approves the request with the UTR. Records the payout in the ledger and
// emails the creator.
export async function approvePayoutRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = approveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const db = createAdminClient();
  // Claim it first so a double click can't record the payout twice.
  const { data: request } = await db
    .from("payout_requests")
    .update({ status: "paid", utr: parsed.data.utr, decided_by: admin.id, decided_at: new Date().toISOString() })
    .eq("id", parsed.data.request_id)
    .eq("status", "pending")
    .select("id, creator_id, amount_paise")
    .maybeSingle();
  if (!request) return { error: "This request was already handled or cancelled." };
  const release = () => db.from("payout_requests").update({ status: "pending", utr: null, decided_by: null, decided_at: null }).eq("id", request.id);
  try {
    const result = await recordManualPayout(request.creator_id, request.amount_paise, parsed.data.utr, admin.id);
    if (!result.ok) {
      await release();
      return { error: result.reason };
    }
    await db.from("payout_requests").update({ payout_id: result.payoutId }).eq("id", request.id);
  } catch (e) {
    await release();
    return { error: (e as Error).message };
  }
  revalidatePath("/admin/payouts");
  revalidatePath(`/admin/creators/${request.creator_id}`);
  return { ok: `Approved and recorded ${formatPaise(request.amount_paise)}. The creator has been emailed.` };
}

const rejectSchema = z.object({
  request_id: z.uuid(),
  reason: z.string().trim().min(5, "Tell the creator why, so they can fix it").max(300),
});

export async function rejectPayoutRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = rejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const db = createAdminClient();
  const { data: request } = await db
    .from("payout_requests")
    .update({ status: "rejected", reject_reason: parsed.data.reason, decided_by: admin.id, decided_at: new Date().toISOString() })
    .eq("id", parsed.data.request_id)
    .eq("status", "pending")
    .select("creator_id, amount_paise")
    .maybeSingle();
  if (!request) return { error: "This request was already handled or cancelled." };
  const { data: creator } = await db.from("profiles").select("email").eq("id", request.creator_id).maybeSingle();
  if (creator) await emailCreatorRejected(creator, request.amount_paise, parsed.data.reason);
  revalidatePath("/admin/payouts");
  revalidatePath(`/admin/creators/${request.creator_id}`);
  return { ok: "Request rejected. The creator has been emailed the reason." };
}

export async function setPayoutsPaused(creatorId: string, paused: boolean): Promise<ActionState> {
  await requireAdmin();
  const { error } = await createAdminClient().from("profiles").update({ payouts_paused: paused }).eq("id", creatorId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/creators/${creatorId}`);
  return { ok: paused ? "Payouts paused for this creator" : "Payouts resumed" };
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

// ---------------------------------------------------------------- creator accounts

const createCreatorSchema = z.object({
  name: z.string().trim().min(1, "Enter their name").max(80),
  email: z.email("Enter a valid email").max(200).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters"),
  verification: z.enum(["send", "verified", "later"]),
});

export type CreateCreatorState = { error?: string; ok?: string; creatorId?: string; email?: string } | null;

// An admin sets up an account and shares the login details with the creator.
// They sign in straight away; their email is verified as chosen below.
export async function createCreatorAccount(_prev: CreateCreatorState, formData: FormData): Promise<CreateCreatorState> {
  const admin = await requireAdmin();
  const parsed = createCreatorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, email, password, verification } = parsed.data;

  const db = createAdminClient();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (error || !data.user) {
    if (error?.code === "email_exists" || /already been registered|already exists/i.test(error?.message ?? "")) {
      return { error: "An account with this email already exists." };
    }
    return { error: error?.message ?? "Couldn't create the account" };
  }
  const id = data.user.id;
  if (verification === "verified") {
    await db.from("profiles").update({ email_verified_at: new Date().toISOString() }).eq("id", id);
  } else if (verification === "send") {
    try {
      await sendVerificationEmail({ id, email, name });
    } catch (e) {
      console.error("[admin] verification email", (e as Error).message);
      return { ok: "Account created, but the verification email didn't send. They can send it again from the banner in their dashboard.", creatorId: id, email };
    }
  }
  console.info(`[admin] ${admin.email} created creator account ${id}`);
  revalidatePath("/admin");
  return { ok: "Account created", creatorId: id, email };
}

export async function markEmailVerified(creatorId: string): Promise<ActionState> {
  await requireAdmin();
  if (!z.uuid().safeParse(creatorId).success) return { error: "Invalid creator" };
  const { error } = await createAdminClient().from("profiles").update({ email_verified_at: new Date().toISOString() }).eq("id", creatorId).is("email_verified_at", null);
  if (error) return { error: error.message };
  revalidatePath(`/admin/creators/${creatorId}`);
  revalidatePath("/admin");
  return { ok: "Email marked as verified" };
}

export async function resendCreatorVerification(creatorId: string): Promise<ActionState> {
  await requireAdmin();
  if (!z.uuid().safeParse(creatorId).success) return { error: "Invalid creator" };
  const { data: p } = await createAdminClient().from("profiles").select("id, email, name, email_verified_at").eq("id", creatorId).maybeSingle();
  if (!p) return { error: "Creator not found" };
  if (p.email_verified_at) return { ok: "Already verified" };
  try {
    await sendVerificationEmail(p);
  } catch (e) {
    return { error: (e as Error).message };
  }
  return { ok: `Verification link sent to ${p.email}` };
}
