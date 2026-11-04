import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import { stateName } from "@/lib/gst";
import { Notice, PageTitle, Panel, buttonClass, tableClass } from "@/components/ui";
import { GstSettingsForm, type GstSettings } from "./gst-form";

export const metadata = { title: "GST invoices" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function AdminInvoices() {
  const db = createAdminClient();
  const [{ data: settings }, { data: invoices }] = await Promise.all([
    db.from("gst_settings").select("legal_name, trade_name, gstin, address, sac").eq("id", 1).single(),
    db.from("invoices").select("id, invoice_number, issued_at, buyer_name, buyer_gstin, place_of_supply, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, emailed_at").order("issued_at", { ascending: false }).limit(300),
  ]);
  const gst = settings as GstSettings;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle sub="Tax invoices for plan payments, numbered per financial year. Download the CSV for GSTR-1.">GST invoices</PageTitle>
        <a href="/admin/invoices/export" className={buttonClass.secondary}>Download CSV</a>
      </div>
      {!gst.gstin && <Notice tone="warn"><b>Invoices are paused.</b> Add your GSTIN and address below. Plan payments made until then are invoiced automatically once it&apos;s saved.</Notice>}
      <Panel title="Our GST details (Veyrn Labs)">
        <p className="mb-5 text-[14px] text-body">Invoices are issued by the trade name, with the proprietor and GSTIN from the GST certificate. Reviewlabs appears as the product.</p>
        <GstSettingsForm initial={gst} />
      </Panel>
      <div className={tableClass.wrap}>
        <table className={tableClass.table}>
          <thead>
            <tr>
              <th className={tableClass.th}>Invoice</th>
              <th className={tableClass.th}>Date</th>
              <th className={tableClass.th}>Billed to</th>
              <th className={tableClass.th}>Place of supply</th>
              <th className={`${tableClass.th} text-right`}>Taxable</th>
              <th className={`${tableClass.th} text-right`}>GST</th>
              <th className={`${tableClass.th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoices ?? []).map((i) => (
              <tr key={i.id}>
                <td className={tableClass.td}><Link href={`/invoices/${i.id}`} className="link num">{i.invoice_number}</Link>{!i.emailed_at && <span className="ml-2 text-[12px] text-muted">not emailed yet</span>}</td>
                <td className={tableClass.td}>{dateFmt.format(new Date(i.issued_at))}</td>
                <td className={tableClass.td}>{i.buyer_name}{i.buyer_gstin && <span className="num block text-[12px] text-muted">{i.buyer_gstin}</span>}</td>
                <td className={tableClass.td}>{stateName(i.place_of_supply)}</td>
                <td className={`${tableClass.td} num text-right`}>{formatPaise(i.taxable_paise)}</td>
                <td className={`${tableClass.td} num text-right`}>{formatPaise(i.cgst_paise + i.sgst_paise + i.igst_paise)}</td>
                <td className={`${tableClass.td} num text-right`}>{formatPaise(i.total_paise)}</td>
              </tr>
            ))}
            {!invoices?.length && <tr><td colSpan={7} className={`${tableClass.td} text-center text-muted`}>No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
