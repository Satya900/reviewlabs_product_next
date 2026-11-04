import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import { amountInWords, GST_RATE_PERCENT, stateName } from "@/lib/gst";
import type { Invoice } from "@/lib/invoices";
import { PrintButton } from "./print-button";

export const metadata = { title: "Tax invoice", robots: { index: false } };

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
const state = (code: string | null) => (code ? `${stateName(code) ?? "Unknown"} (${code})` : null);

// A GST tax invoice for one plan payment. The creator sees their own (RLS);
// admins can open any. Printable, and saved as PDF from the print dialog.
export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/invoices/${id}`)}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = profile.is_admin ? createAdminClient() : await createClient();
  const { data } = await db.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const inv = data as Invoice;
  const interState = inv.igst_paise > 0;
  const half = GST_RATE_PERCENT / 2;

  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-6 py-1.5 ${strong ? "border-t border-hairline pt-3 text-[16px] font-semibold" : ""}`}>
      <span className={strong ? "" : "text-body"}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );

  return (
    <main className="min-h-screen bg-surface-soft px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between print:hidden">
        <Link href={profile.is_admin && profile.id !== inv.creator_id ? "/admin/invoices" : "/dashboard/billing"} className="link text-[14px]">← Back</Link>
        <PrintButton />
      </div>

      <article className="mx-auto max-w-3xl rounded-3xl border border-hairline bg-canvas p-8 text-[14px] text-ink print:rounded-none print:border-0 print:p-0 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-hairline pb-6">
          <div>
            <p className="text-[24px] font-semibold tracking-tight">Tax invoice</p>
            <p className="mt-1 text-body">Original for recipient</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-right">
            <dt className="text-muted">Invoice no.</dt><dd className="num font-semibold">{inv.invoice_number}</dd>
            <dt className="text-muted">Invoice date</dt><dd>{dateFmt.format(new Date(inv.issued_at))}</dd>
            <dt className="text-muted">Payment date</dt><dd>{dateFmt.format(new Date(inv.paid_at))}</dd>
          </dl>
        </header>

        <section className="grid gap-6 border-b border-hairline py-6 sm:grid-cols-2">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">From</p>
            <p className="mt-2 text-[15px] font-semibold">{inv.seller_trade_name ?? inv.seller_legal_name}</p>
            {inv.seller_trade_name && inv.seller_legal_name && <p className="text-body">{inv.seller_legal_name} (proprietor)</p>}
            {inv.seller_address && <p className="whitespace-pre-line text-body">{inv.seller_address}</p>}
            <p className="mt-1">GSTIN: <span className="num font-medium">{inv.seller_gstin}</span></p>
            <p className="text-body">State: {state(inv.seller_state_code)}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Bill to</p>
            <p className="mt-2 text-[15px] font-semibold">{inv.buyer_name}</p>
            {inv.buyer_address && <p className="whitespace-pre-line text-body">{inv.buyer_address}</p>}
            <p className="text-body">{inv.buyer_email}</p>
            {inv.buyer_gstin && <p className="mt-1">GSTIN: <span className="num font-medium">{inv.buyer_gstin}</span></p>}
            {inv.buyer_state_code && <p className="text-body">State: {state(inv.buyer_state_code)}</p>}
          </div>
        </section>

        <p className="pt-6 text-body">Place of supply: <span className="font-medium text-ink">{state(inv.place_of_supply)}</span> · Reverse charge: No</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left">
            <thead>
              <tr className="border-b border-hairline text-[12px] uppercase tracking-wider text-muted">
                <th className="py-2 font-semibold">Description</th>
                <th className="py-2 font-semibold">SAC</th>
                <th className="py-2 text-right font-semibold">Qty</th>
                <th className="py-2 text-right font-semibold">Taxable value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-hairline-soft">
                <td className="py-3">
                  {inv.description}
                  {inv.period_end && <span className="block text-[13px] text-muted">Paid until {dateFmt.format(new Date(inv.period_end))}</span>}
                </td>
                <td className="num py-3">{inv.sac}</td>
                <td className="num py-3 text-right">1</td>
                <td className="num py-3 text-right">{formatPaise(inv.taxable_paise)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-4 max-w-xs">
          {row("Taxable value", formatPaise(inv.taxable_paise))}
          {interState
            ? row(`IGST @ ${GST_RATE_PERCENT}%`, formatPaise(inv.igst_paise))
            : <>{row(`CGST @ ${half}%`, formatPaise(inv.cgst_paise))}{row(`SGST @ ${half}%`, formatPaise(inv.sgst_paise))}</>}
          {row("Total", formatPaise(inv.total_paise), true)}
        </div>
        <p className="mt-2 text-right text-[13px] text-body">{amountInWords(inv.total_paise)}</p>

        <footer className="mt-8 space-y-1 border-t border-hairline pt-5 text-[12px] text-muted">
          <p>Paid in full via Razorpay (payment ID <span className="num">{inv.razorpay_payment_id}</span>).</p>
          <p>This is a computer-generated invoice and does not need a signature.</p>
        </footer>
      </article>
    </main>
  );
}
