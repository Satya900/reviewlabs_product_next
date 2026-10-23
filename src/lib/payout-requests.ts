import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/email";
import { formatPaise } from "@/lib/money";
import { isValidIfsc, maskAccountNumber, normalizeIfsc } from "@/lib/bank-details";

export type PayoutRequest = {
  id: string;
  creator_id: string;
  amount_paise: number;
  status: "pending" | "paid" | "rejected" | "cancelled";
  account_name: string;
  account_number: string;
  ifsc: string;
  bank_name: string | null;
  cheque_path: string;
  payout_id: string | null;
  utr: string | null;
  reject_reason: string | null;
  decided_at: string | null;
  created_at: string;
};

export type IfscInfo = { bank: string; branch: string; city: string };

// Razorpay's free public IFSC directory. Null when the code doesn't exist;
// throws when the directory can't be reached, so callers can still accept a
// well-formed code instead of blocking the creator.
export async function lookupIfsc(ifsc: string): Promise<IfscInfo | null> {
  const code = normalizeIfsc(ifsc);
  if (!isValidIfsc(code)) return null;
  const res = await fetch(`https://ifsc.razorpay.com/${code}`, { signal: AbortSignal.timeout(5000), cache: "force-cache" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`IFSC lookup ${res.status}`);
  const data = (await res.json()) as { BANK?: string; BRANCH?: string; CITY?: string };
  return { bank: String(data.BANK ?? "").slice(0, 100), branch: String(data.BRANCH ?? "").slice(0, 100), city: String(data.CITY ?? "").slice(0, 60) };
}

// Short-lived link for an admin to view a cheque.
export async function chequeUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await createAdminClient().storage.from("payout-documents").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function card(kicker: string, title: string, lines: string[], button?: { href: string; label: string }) {
  return `<div style="background:#f7f7f7;padding:32px 12px;"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dee1e6;border-radius:24px;padding:32px;font-family:${font};color:#0a0b0d;">
  <p style="margin:0;font-size:14px;color:#7c828a;">${escapeHtml(kicker)}</p>
  <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.15;font-weight:400;letter-spacing:-0.6px;">${escapeHtml(title)}</h1>
  ${lines.map((l) => `<p style="margin:10px 0 0 0;font-size:16px;line-height:1.5;color:#5b616e;">${escapeHtml(l)}</p>`).join("")}
  ${button ? `<p style="margin:20px 0 0 0;"><a href="${button.href}" style="display:inline-block;background:#0052ff;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:100px;">${escapeHtml(button.label)}</a></p>` : ""}
</div></div>`;
}

export async function emailAdminsNewRequest(request: Pick<PayoutRequest, "amount_paise" | "account_number" | "bank_name" | "ifsc">, creator: { name: string | null; email: string }) {
  const { data: admins } = await createAdminClient().from("profiles").select("email").eq("is_admin", true);
  const amount = formatPaise(request.amount_paise);
  const who = creator.name ? `${creator.name} (${creator.email})` : creator.email;
  const url = `${env.appUrl()}/admin/payouts`;
  const lines = [`${who} asked for a payout of ${amount}.`, `To: ${request.bank_name ?? request.ifsc}, account ${maskAccountNumber(request.account_number)}.`, "Check their cancelled cheque, pay it, then approve the request with the UTR."];
  for (const admin of admins ?? []) {
    try {
      await sendEmail({
        to: admin.email,
        subject: `Payout request: ${amount} from ${creator.name || creator.email}`,
        html: card("Reviewlabs admin", `${amount} payout requested`, lines, { href: url, label: "Review the request" }),
        text: [...lines, url].join("\n\n"),
      });
    } catch (e) {
      console.error("[payout-requests] admin email:", (e as Error).message);
    }
  }
}

export async function emailCreatorRejected(creator: { email: string }, amountPaise: number, reason: string) {
  const amount = formatPaise(amountPaise);
  const lines = [`We couldn't approve your payout request for ${amount}.`, `Reason: ${reason}`, "The money is still in your balance. Fix the issue and request it again from Earnings."];
  try {
    await sendEmail({
      to: creator.email,
      subject: `Your ${amount} payout request needs attention`,
      html: card("Reviewlabs payouts", "Payout request not approved", lines, { href: `${env.appUrl()}/dashboard/earnings`, label: "Open Earnings" }),
      text: [...lines, `${env.appUrl()}/dashboard/earnings`].join("\n\n"),
    });
  } catch (e) {
    console.error("[payout-requests] reject email:", (e as Error).message);
  }
}
