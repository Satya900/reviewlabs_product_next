import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { escapeHtml, sendEmail } from "@/lib/email";
import { formatPaise } from "@/lib/money";

// GST invoices for plan payments are issued by the database the moment a
// payment is recorded (public.issue_plan_invoice). This emails them, once each.

export type Invoice = {
  id: string;
  invoice_number: string;
  issued_at: string;
  paid_at: string;
  razorpay_payment_id: string;
  seller_legal_name: string | null;
  seller_trade_name: string | null;
  seller_gstin: string;
  seller_address: string | null;
  seller_state_code: string;
  buyer_name: string;
  buyer_email: string;
  buyer_gstin: string | null;
  buyer_state_code: string | null;
  buyer_address: string | null;
  place_of_supply: string;
  description: string;
  sac: string;
  period_end: string | null;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
  creator_id: string;
  emailed_at: string | null;
};

const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

async function sendOne(inv: Pick<Invoice, "id" | "invoice_number" | "buyer_email" | "buyer_name" | "description" | "total_paise">) {
  const link = `${env.appUrl()}/invoices/${inv.id}`;
  const lines = [
    `Hi ${inv.buyer_name.split(" ")[0]},`,
    `Thanks for your payment of ${formatPaise(inv.total_paise)} for ${inv.description}. Your GST tax invoice ${inv.invoice_number} is ready.`,
    "You can also find all your invoices under Plan and billing in your dashboard.",
  ];
  const html = `<div style="background:#f7f7f7;padding:32px 12px;"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dee1e6;border-radius:24px;padding:32px;font-family:${font};color:#0a0b0d;">
  <p style="margin:0;font-size:14px;color:#7c828a;">Reviewlabs</p>
  <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.15;font-weight:400;letter-spacing:-0.6px;">Invoice ${escapeHtml(inv.invoice_number)}</h1>
  ${lines.map((l) => `<p style="margin:10px 0 0 0;font-size:16px;line-height:1.5;color:#5b616e;">${escapeHtml(l)}</p>`).join("")}
  <p style="margin:24px 0 0 0;"><a href="${link}" style="display:inline-block;background:#0052ff;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:100px;">View invoice</a></p>
</div></div>`;
  await sendEmail({ to: inv.buyer_email, subject: `Your Reviewlabs invoice ${inv.invoice_number}`, html, text: [...lines, `View invoice: ${link}`].join("\n\n") });
}

// Invoices from the last 30 days that haven't been emailed. Each is claimed
// (emailed_at) before sending, so overlapping runs never send twice.
export async function sendInvoiceEmails(): Promise<number> {
  const db = createAdminClient();
  const { data } = await db
    .from("invoices")
    .select("id, invoice_number, buyer_email, buyer_name, description, total_paise")
    .is("emailed_at", null)
    .gt("issued_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
    .order("issued_at")
    .limit(50);
  let sent = 0;
  for (const inv of data ?? []) {
    const { data: claimed } = await db.from("invoices").update({ emailed_at: new Date().toISOString() }).eq("id", inv.id).is("emailed_at", null).select("id");
    if (!claimed?.length) continue;
    try {
      await sendOne(inv);
      sent++;
    } catch (e) {
      await db.from("invoices").update({ emailed_at: null }).eq("id", inv.id);
      console.error(`[invoices] email ${inv.invoice_number}:`, (e as Error).message);
    }
  }
  return sent;
}

// After a plan payment is recorded: email its invoice once the response is sent.
export function emailInvoicesSoon() {
  try {
    after(() => sendInvoiceEmails().catch((e) => console.error("[invoices]", e)));
  } catch {
    // Outside a request (scripts): the reconcile job sends it instead.
  }
}
