import "server-only";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, sendEmail } from "@/lib/email";
import { formatPaise } from "@/lib/money";

// Creator payouts through RazorpayX. The ledger is debited before anything is
// sent (start_payout), every request carries the payout id as its idempotency
// key, and RazorpayX's status comes back through finish_payout, which puts the
// money back on the balance if a payout fails.

export const PAYOUT_MIN_PAISE = 10_000; // ₹100
export const PAYOUT_HOLD_HOURS = 24; // keep in sync with creator_balances.available_paise
const UPI_MAX_PAISE = 1_00_000_00; // ₹1,00,000 per UPI payout
const IMPS_MAX_PAISE = 5_00_000_00; // ₹5,00,000 per IMPS payout, NEFT above

type PayoutProfile = {
  id: string;
  email: string;
  name: string | null;
  payout_upi: string | null;
  payout_account_name: string | null;
  payout_account_number: string | null;
  payout_ifsc: string | null;
};

type Destination = {
  method: "upi" | "bank_transfer";
  mode: "UPI" | "IMPS" | "NEFT";
  label: string;
  maxPaise: number;
  fundAccount: Record<string, unknown>;
};

export type RazorpayXPayout = {
  id: string;
  status: string;
  amount: number;
  utr?: string | null;
  fees?: number | null;
  reference_id?: string | null;
  failure_reason?: string | null;
  status_details?: { description?: string | null; reason?: string | null } | null;
  notes?: Record<string, string> | unknown[];
};

class RazorpayXError extends Error {
  constructor(message: string, readonly status: number, readonly definitive: boolean) {
    super(message);
  }
}

export function payoutsEnabled() {
  return Boolean(env.razorpayxAccountNumber() && process.env.RAZORPAYX_KEY_ID && process.env.RAZORPAYX_KEY_SECRET);
}

async function razorpayx<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const auth = Buffer.from(`${env.razorpayxKeyId()}:${env.razorpayxKeySecret()}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/json",
        ...(init.idempotencyKey ? { "X-Payout-Idempotency": init.idempotencyKey } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new RazorpayXError(`RazorpayX unreachable: ${(e as Error).message}`, 0, false);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string; code?: string } };
  if (!res.ok) {
    // 400 means RazorpayX looked at the request and refused it (bad IFSC, bad
    // UPI ID, ...). Anything else (auth, rate limit, outage) may succeed later.
    const definitive = res.status === 400;
    throw new RazorpayXError(data.error?.description ?? `RazorpayX error ${res.status}`, res.status, definitive);
  }
  return data;
}

// Names RazorpayX accepts: letters, digits, spaces and a little punctuation.
function cleanName(value: string | null | undefined, max: number) {
  return (value ?? "").normalize("NFKD").replace(/[^\p{L}\p{N} .'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function maskUpi(vpa: string) {
  const [user, handle] = vpa.split("@");
  return `UPI ${user.slice(0, 2)}***@${handle}`;
}

// UPI if the creator added one (instant and cheapest), otherwise IMPS/NEFT to their bank.
export function destinationFor(p: PayoutProfile): Destination | null {
  const contactName = cleanName(p.name || p.payout_account_name, 50);
  const contact = {
    name: contactName.length >= 3 ? contactName : "Reviewlabs creator",
    email: p.email,
    type: "vendor",
    reference_id: p.id,
  };
  if (p.payout_upi) {
    return {
      method: "upi",
      mode: "UPI",
      label: maskUpi(p.payout_upi),
      maxPaise: UPI_MAX_PAISE,
      fundAccount: { account_type: "vpa", vpa: { address: p.payout_upi }, contact },
    };
  }
  const holder = cleanName(p.payout_account_name, 120);
  if (p.payout_account_number && p.payout_ifsc && holder.length >= 4) {
    return {
      method: "bank_transfer",
      mode: "IMPS",
      label: `A/c ••${p.payout_account_number.slice(-4)} (${p.payout_ifsc})`,
      maxPaise: 10_00_00_000_00, // NEFT has no practical cap for us
      fundAccount: {
        account_type: "bank_account",
        bank_account: { name: holder, ifsc: p.payout_ifsc, account_number: p.payout_account_number },
        contact,
      },
    };
  }
  return null;
}

type PayoutRow = {
  id: string;
  creator_id: string;
  amount_paise: number;
  mode: string;
  fund_account: Record<string, unknown>;
  razorpay_payout_id: string | null;
  attempts: number;
};

export type PayResult = { ok: true; payoutId: string; amountPaise: number; status: string } | { ok: false; reason: string };

// Pays the creator's available balance (up to maxPaise). Used by the daily run
// and by the admin "Pay now" button.
export async function payCreator(creatorId: string, opts: { createdBy?: string | null; maxPaise?: number; minPaise?: number } = {}): Promise<PayResult> {
  if (!payoutsEnabled()) return { ok: false, reason: "RazorpayX isn't set up (RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET or RAZORPAYX_ACCOUNT_NUMBER is empty)." };
  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("id, email, name, payout_upi, payout_account_name, payout_account_number, payout_ifsc, payouts_paused")
    .eq("id", creatorId)
    .maybeSingle();
  if (!profile) return { ok: false, reason: "Creator not found." };
  if (profile.payouts_paused) return { ok: false, reason: "Payouts are paused for this creator." };
  const dest = destinationFor(profile);
  if (!dest) return { ok: false, reason: "No valid UPI ID or bank account saved." };

  // UPI is capped per payout; a bank account takes bigger amounts over IMPS/NEFT.
  const max = Math.min(opts.maxPaise ?? Number.MAX_SAFE_INTEGER, dest.maxPaise);
  const { data, error } = await db
    .rpc("start_payout", {
      p_creator_id: creatorId,
      p_min_paise: opts.minPaise ?? PAYOUT_MIN_PAISE,
      p_max_paise: Math.min(max, 2_147_483_647),
      p_method: dest.method,
      p_mode: dest.mode,
      p_destination_label: dest.label,
      p_fund_account: dest.fundAccount,
      p_created_by: opts.createdBy ?? null,
    })
    .maybeSingle<{ payout_id: string; amount_paise: number }>();
  if (error) throw new Error(`start_payout failed: ${error.message}`);
  if (!data) return { ok: false, reason: `Nothing to pay: under ${formatPaise(opts.minPaise ?? PAYOUT_MIN_PAISE)} available, or a payout is already on its way.` };

  const mode = dest.mode === "IMPS" && data.amount_paise > IMPS_MAX_PAISE ? "NEFT" : dest.mode;
  if (mode !== dest.mode) await db.from("payouts").update({ mode }).eq("id", data.payout_id);
  const status = await sendPayout({
    id: data.payout_id,
    creator_id: creatorId,
    amount_paise: data.amount_paise,
    mode,
    fund_account: dest.fundAccount,
    razorpay_payout_id: null,
    attempts: 0,
  });
  return { ok: true, payoutId: data.payout_id, amountPaise: data.amount_paise, status };
}

// Sends (or re-sends) a payout. Safe to repeat: RazorpayX returns the original
// payout for a repeated idempotency key.
async function sendPayout(row: PayoutRow): Promise<string> {
  const db = createAdminClient();
  try {
    const payout = await razorpayx<RazorpayXPayout>("/payouts", {
      method: "POST",
      idempotencyKey: row.id,
      body: {
        account_number: env.razorpayxAccountNumber(),
        amount: row.amount_paise,
        currency: "INR",
        mode: row.mode,
        purpose: "payout",
        fund_account: row.fund_account,
        // Waits for funds instead of failing if the RazorpayX balance is low.
        queue_if_low_balance: true,
        reference_id: row.id,
        narration: "Reviewlabs payout",
        notes: { payout_id: row.id, creator_id: row.creator_id },
      },
    });
    return await applyPayout(payout, row.id);
  } catch (e) {
    const err = e as RazorpayXError;
    if (err instanceof RazorpayXError && err.definitive) {
      return (await finish(row.id, "failed", null, null, err.message, null)) ?? "failed";
    }
    // Unknown outcome: keep it queued; syncOpenPayouts looks it up and retries.
    await db.from("payouts").update({ attempts: row.attempts + 1, last_error: err.message }).eq("id", row.id);
    console.error(`[payouts] send ${row.id}:`, err.message);
    return "queued";
  }
}

async function finish(id: string, status: string, rzpId: string | null, utr: string | null, reason: string | null, fees: number | null) {
  const { data, error } = await createAdminClient().rpc("finish_payout", {
    p_payout_id: id,
    p_status: status,
    p_razorpay_payout_id: rzpId,
    p_utr: utr,
    p_failure_reason: reason,
    p_fees_paise: fees,
  });
  if (error) throw new Error(`finish_payout failed: ${error.message}`);
  if (data === "processed" || data === "failed" || data === "reversed" || data === "cancelled") await notifyCreator(id);
  return data as string | null;
}

// Applies a RazorpayX payout entity (API response or webhook) to our payout.
export async function applyPayout(payout: RazorpayXPayout, ourId?: string): Promise<string> {
  const notes = payout.notes && !Array.isArray(payout.notes) ? payout.notes : {};
  const id = ourId ?? payout.reference_id ?? notes.payout_id;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return "ignored"; // a payout made outside Reviewlabs
  // status_details can still describe an earlier state ("queued for low balance",
  // "processed" on a later reversal), so only trust it when it explains a failure.
  const staleDetail = ["low_balance", "payout_processed"].includes(payout.status_details?.reason ?? "");
  const details = staleDetail ? null : payout.status_details?.description;
  const reason = details || payout.failure_reason || (payout.status === "cancelled" ? "Cancelled in RazorpayX" : null);
  return (await finish(id, payout.status, payout.id, payout.utr ?? null, reason, payout.fees ?? null)) ?? "ignored";
}

// Emails the creator once per final status (a sent payout can later be reversed).
async function notifyCreator(payoutId: string) {
  const db = createAdminClient();
  const { data: current } = await db.from("payouts").select("status, notified_status").eq("id", payoutId).maybeSingle();
  if (!current || !["processed", "failed", "reversed", "cancelled"].includes(current.status) || current.notified_status === current.status) return;
  // Claim it atomically so two webhooks can't both send the email.
  let claim = db
    .from("payouts")
    .update({ notified_at: new Date().toISOString(), notified_status: current.status })
    .eq("id", payoutId)
    .eq("status", current.status);
  claim = current.notified_status === null ? claim.is("notified_status", null) : claim.eq("notified_status", current.notified_status);
  const { data: po } = await claim.select("amount_paise, status, utr, destination_label, failure_reason, creator_id").maybeSingle();
  if (!po) return;
  const { data: creator } = await db.from("profiles").select("email, name").eq("id", po.creator_id).maybeSingle();
  if (!creator?.email) return;
  const amount = formatPaise(po.amount_paise);
  const sent = po.status === "processed";
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const lines = sent
    ? [`We sent ${amount} to your ${po.destination_label}.`, po.utr ? `Bank reference (UTR): ${po.utr}` : "", "It usually shows in your account within minutes."]
    : [
        `Your payout of ${amount} to ${po.destination_label} didn't go through${po.failure_reason ? `: ${po.failure_reason}` : "."}`,
        "The money is back in your Reviewlabs balance. Check your UPI ID or bank details in Settings, and we'll send it again in the next daily payout.",
      ];
  const settingsUrl = `${env.appUrl()}/dashboard/settings`;
  try {
    await sendEmail({
      to: creator.email,
      subject: sent ? `${amount} is on its way to you` : `Your ${amount} payout needs attention`,
      html: `<div style="background:#f7f7f7;padding:32px 12px;"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dee1e6;border-radius:24px;padding:32px;font-family:${font};color:#0a0b0d;">
  <p style="margin:0;font-size:14px;color:#7c828a;">Reviewlabs payouts</p>
  <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.15;font-weight:400;letter-spacing:-0.6px;">${sent ? `${amount} sent` : "Payout didn't go through"}</h1>
  ${lines.filter(Boolean).map((l) => `<p style="margin:10px 0 0 0;font-size:16px;line-height:1.5;color:#5b616e;">${escapeHtml(l)}</p>`).join("")}
  ${sent ? "" : `<p style="margin:20px 0 0 0;"><a href="${settingsUrl}" style="display:inline-block;background:#0052ff;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:100px;">Check payout details</a></p>`}
</div></div>`,
      text: [...lines.filter(Boolean), sent ? "" : settingsUrl].filter(Boolean).join("\n\n"),
    });
  } catch (e) {
    console.error(`[payouts] notify ${payoutId}:`, (e as Error).message);
  }
}

// Brings open payouts up to date: re-sends ones whose request never got an
// answer, and asks RazorpayX about ones still processing (missed webhooks).
export async function syncOpenPayouts(limit = 50) {
  if (!payoutsEnabled()) return { synced: 0, errors: 0 };
  const db = createAdminClient();
  const summary = { synced: 0, errors: 0 };
  const { data: open } = await db
    .from("payouts")
    .select("id, creator_id, amount_paise, mode, fund_account, razorpay_payout_id, attempts")
    .eq("provider", "razorpayx")
    .in("status", ["queued", "processing"])
    .lt("updated_at", new Date(Date.now() - 2 * 60_000).toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  for (const row of (open ?? []) as PayoutRow[]) {
    try {
      if (row.razorpay_payout_id) {
        await applyPayout(await razorpayx<RazorpayXPayout>(`/payouts/${row.razorpay_payout_id}`), row.id);
      } else {
        // Did RazorpayX create it before the connection dropped?
        const found = await razorpayx<{ items: RazorpayXPayout[] }>(
          `/payouts?account_number=${encodeURIComponent(env.razorpayxAccountNumber()!)}&reference_id=${row.id}`,
        );
        if (found.items?.length) await applyPayout(found.items[0], row.id);
        else await sendPayout(row);
      }
      summary.synced++;
    } catch (e) {
      summary.errors++;
      console.error(`[payouts] sync ${row.id}:`, (e as Error).message);
    }
  }
  return summary;
}

// The daily automatic run: pays every creator whose available balance is at
// least the minimum. Creators whose last payout failed are skipped until they
// change their payout details.
export async function runDailyPayouts(limit = 100) {
  const summary = { paid: 0, skipped: 0, errors: 0, totalPaise: 0 };
  if (!payoutsEnabled()) {
    // Manual mode (RazorpayX not connected yet): remind the admins who is due today.
    await emailDueListToAdmins();
    return { ...summary, disabled: true, manual: true };
  }
  if (!env.autoPayouts()) return { ...summary, disabled: true };
  const db = createAdminClient();

  const { data: due } = await db
    .from("creator_balances")
    .select("creator_id, available_paise")
    .gte("available_paise", PAYOUT_MIN_PAISE)
    .order("available_paise", { ascending: false })
    .limit(limit);
  const ids = (due ?? []).map((d) => d.creator_id as string);
  if (!ids.length) return summary;

  const [{ data: profiles }, { data: recent }] = await Promise.all([
    db.from("profiles").select("id, is_admin, payouts_paused, payout_details_updated_at").in("id", ids),
    db.from("payouts").select("creator_id, status, updated_at").eq("provider", "razorpayx").in("creator_id", ids).order("created_at", { ascending: false }),
  ]);
  const lastPayout = new Map<string, { status: string; updated_at: string }>();
  for (const p of recent ?? []) if (!lastPayout.has(p.creator_id)) lastPayout.set(p.creator_id, p);

  for (const p of profiles ?? []) {
    const last = lastPayout.get(p.id);
    const failedOnDetails =
      last && ["failed", "reversed", "cancelled"].includes(last.status) &&
      (!p.payout_details_updated_at || new Date(p.payout_details_updated_at) < new Date(last.updated_at));
    if (p.is_admin || p.payouts_paused || failedOnDetails) {
      summary.skipped++;
      continue;
    }
    try {
      const result = await payCreator(p.id);
      if (result.ok) {
        summary.paid++;
        summary.totalPaise += result.amountPaise;
      } else {
        summary.skipped++;
      }
    } catch (e) {
      summary.errors++;
      console.error(`[payouts] daily ${p.id}:`, (e as Error).message);
    }
  }
  return summary;
}

// ---------------------------------------------------------------- manual mode
// Until RazorpayX is connected, an admin pays from their bank or UPI app and
// records the UTR here. Same 24-hour hold, minimum and ledger as automatic payouts.

export type DuePayout = {
  creatorId: string;
  email: string;
  name: string | null;
  availablePaise: number;
  destination: Destination | null;
  upi: string | null;
  accountName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
};

export async function listDuePayouts(): Promise<DuePayout[]> {
  const db = createAdminClient();
  const { data: due } = await db
    .from("creator_balances")
    .select("creator_id, available_paise")
    .gte("available_paise", PAYOUT_MIN_PAISE)
    .order("available_paise", { ascending: false })
    .limit(500);
  const ids = (due ?? []).map((d) => d.creator_id as string);
  if (!ids.length) return [];
  const { data: profiles } = await db
    .from("profiles")
    .select("id, email, name, is_admin, payouts_paused, payout_upi, payout_account_name, payout_account_number, payout_ifsc")
    .in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (due ?? []).flatMap((d) => {
    const p = byId.get(d.creator_id);
    if (!p || p.is_admin || p.payouts_paused) return [];
    return [{
      creatorId: p.id,
      email: p.email,
      name: p.name,
      availablePaise: Number(d.available_paise),
      destination: destinationFor(p),
      upi: p.payout_upi,
      accountName: p.payout_account_name,
      accountNumber: p.payout_account_number,
      ifsc: p.payout_ifsc,
    }];
  });
}

// Records a payout the admin already sent by hand, then emails the creator.
export async function recordManualPayout(creatorId: string, amountPaise: number, utr: string, adminId: string): Promise<PayResult> {
  const db = createAdminClient();
  const [{ data: balance }, { data: profile }] = await Promise.all([
    db.from("creator_balances").select("available_paise").eq("creator_id", creatorId).maybeSingle(),
    db.from("profiles").select("id, email, name, payout_upi, payout_account_name, payout_account_number, payout_ifsc").eq("id", creatorId).maybeSingle(),
  ]);
  if (!profile) return { ok: false, reason: "Creator not found." };
  const available = Number(balance?.available_paise ?? 0);
  if (amountPaise > available) return { ok: false, reason: `Only ${formatPaise(available)} is available to pay (sales from the last 24 hours are on hold).` };
  const dest = destinationFor(profile);
  const { data: payoutId, error } = await db.rpc("record_payout", {
    p_creator_id: creatorId,
    p_amount_paise: amountPaise,
    p_method: dest?.method ?? "other",
    p_reference: utr,
    p_note: null,
    p_created_by: adminId,
  });
  if (error) throw new Error(`record_payout failed: ${error.message}`);
  await db.from("payouts").update({ utr, destination_label: dest?.label ?? null, mode: dest?.mode ?? null, processed_at: new Date().toISOString() }).eq("id", payoutId);
  await notifyCreator(payoutId as string);
  return { ok: true, payoutId: payoutId as string, amountPaise, status: "processed" };
}

async function emailDueListToAdmins() {
  const due = await listDuePayouts();
  if (!due.length) return;
  const db = createAdminClient();
  const { data: admins } = await db.from("profiles").select("email").eq("is_admin", true);
  const total = due.reduce((sum, d) => sum + d.availablePaise, 0);
  const url = `${env.appUrl()}/admin/payouts`;
  const lines = due.map((d) => `${formatPaise(d.availablePaise)} to ${d.name || d.email}: ${d.destination?.label ?? "no payout details yet"}`);
  for (const admin of admins ?? []) {
    try {
      await sendEmail({
        to: admin.email,
        subject: `Payouts due today: ${formatPaise(total)} to ${due.length} creator${due.length === 1 ? "" : "s"}`,
        html: `<div style="font-family:-apple-system,system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;max-width:560px;margin:auto;color:#0a0b0d;padding:24px">
  <p style="margin:0 0 12px">These creators have money ready to pay today (sales older than 24 hours):</p>
  <ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
  <p><a href="${url}" style="color:#0052ff;font-weight:600">Open payouts</a> to copy their details, download the bank CSV and mark each one paid with its UTR.</p></div>`,
        text: [`Payouts due today (${formatPaise(total)}):`, ...lines, `Open payouts: ${url}`].join("\n"),
      });
    } catch (e) {
      console.error("[payouts] admin reminder:", (e as Error).message);
    }
  }
}
