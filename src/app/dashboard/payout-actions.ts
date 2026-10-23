"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireCreator } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { rupeesToPaise } from "@/lib/money";
import { bankDetailsError, cleanHolderName, normalizeAccountNumber, normalizeIfsc, payoutAmountError } from "@/lib/bank-details";
import { emailAdminsNewRequest, lookupIfsc, type IfscInfo } from "@/lib/payout-requests";

export type PayoutActionState = { error?: string; ok?: string } | null;

export async function checkIfsc(ifsc: string): Promise<{ info?: IfscInfo; error?: string }> {
  await requireCreator();
  try {
    const info = await lookupIfsc(ifsc);
    return info ? { info } : { error: "We couldn't find this IFSC. Check it on your cheque or passbook." };
  } catch {
    return {}; // Directory unreachable: don't block, the format was already checked.
  }
}

// Saves the bank account payouts go to, with the cancelled cheque the creator
// uploaded to payout-documents/<their id>/cheque/. Replaces any earlier details.
export async function saveBankDetails(input: {
  accountName: string;
  accountNumber: string;
  confirmAccountNumber: string;
  ifsc: string;
  chequePath: string;
}): Promise<PayoutActionState> {
  const profile = await requireCreator();
  if (!(await rateLimit(`bank-details:${profile.id}`, 10, 3600))) return { error: "Too many attempts. Please try again in an hour." };
  const problem = bankDetailsError(input);
  if (problem) return { error: problem };

  const folder = `${profile.id}/cheque/`;
  const path = String(input.chequePath ?? "");
  if (!path.startsWith(folder) || path.includes("..") || path.length > 300) return { error: "Upload the cancelled cheque again." };
  const db = createAdminClient();
  const name = path.slice(folder.length);
  const { data: found } = await db.storage.from("payout-documents").list(folder.slice(0, -1), { search: name, limit: 1 });
  if (!found?.some((f) => f.name === name)) return { error: "Upload the cancelled cheque again." };

  const { count: pending } = await db.from("payout_requests").select("id", { count: "exact", head: true }).eq("creator_id", profile.id).eq("status", "pending");
  if (pending) return { error: "You have a payout request in review. Cancel it in Earnings before changing your bank account." };

  let bankName: string | null = null;
  try {
    const info = await lookupIfsc(input.ifsc);
    if (!info) return { error: "We couldn't find this IFSC. Check it on your cheque or passbook." };
    bankName = [info.bank, info.branch].filter(Boolean).join(", ") || null;
  } catch {
    // Directory unreachable: keep the well-formed IFSC, the admin checks the cheque anyway.
  }

  const { error } = await db
    .from("profiles")
    .update({
      payout_account_name: cleanHolderName(input.accountName),
      payout_account_number: normalizeAccountNumber(input.accountNumber),
      payout_ifsc: normalizeIfsc(input.ifsc),
      payout_bank_name: bankName,
      payout_cheque_path: path,
      payout_bank_submitted_at: new Date().toISOString(),
      // Payouts go to this verified bank account only.
      payout_upi: null,
    })
    .eq("id", profile.id);
  if (error) {
    console.error("[bank-details]", error.message);
    return { error: "We couldn't save your bank details. Please try again." };
  }
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/earnings");
  return { ok: "Bank details saved" };
}

export async function requestPayout(_prev: PayoutActionState, formData: FormData): Promise<PayoutActionState> {
  const profile = await requireCreator();
  if (!profile.email_verified_at) return { error: "Verify your email first. Use the link at the top of the page." };
  if (!profile.payout_bank_submitted_at || !profile.payout_account_number || !profile.payout_ifsc || !profile.payout_cheque_path) {
    return { error: "Add your bank account and cancelled cheque in Settings before requesting a payout." };
  }
  if (profile.payouts_paused) return { error: "Payouts are paused on your account. Please contact support." };
  if (!(await rateLimit(`payout-request:${profile.id}`, 10, 3600))) return { error: "Too many attempts. Please try again in an hour." };

  const db = createAdminClient();
  const { data: balance } = await db.from("creator_balances").select("available_paise").eq("creator_id", profile.id).maybeSingle();
  const available = Math.max(Number(balance?.available_paise ?? 0), 0);
  const amount = rupeesToPaise(String(formData.get("amount") ?? "").replace(/[₹,\s]/g, ""));
  const problem = payoutAmountError(amount, available);
  if (problem) return { error: problem };

  const request = {
    creator_id: profile.id,
    amount_paise: amount!,
    account_name: profile.payout_account_name ?? profile.name ?? "",
    account_number: profile.payout_account_number,
    ifsc: profile.payout_ifsc,
    bank_name: profile.payout_bank_name,
    cheque_path: profile.payout_cheque_path,
  };
  const { error } = await db.from("payout_requests").insert(request);
  if (error) {
    if (error.code === "23505") return { error: "You already have a payout request in review." };
    console.error("[payout-request]", error.message);
    return { error: "We couldn't send your request. Please try again." };
  }
  after(() => emailAdminsNewRequest(request, profile));
  revalidatePath("/dashboard/earnings");
  return { ok: "Payout requested. We'll email you when it's sent." };
}

export async function cancelPayoutRequest(id: string): Promise<PayoutActionState> {
  const profile = await requireCreator();
  const { data } = await createAdminClient()
    .from("payout_requests")
    .update({ status: "cancelled", decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("creator_id", profile.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  revalidatePath("/dashboard/earnings");
  return data ? { ok: "Request cancelled" } : { error: "This request can't be cancelled any more." };
}
