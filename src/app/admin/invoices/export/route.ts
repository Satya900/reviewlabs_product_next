import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { csvResponse, rowsToCsv } from "@/lib/csv";
import { stateName } from "@/lib/gst";

const rupees = (paise: number) => (paise / 100).toFixed(2);
const istDate = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

// Every invoice, one row each, in the columns GSTR-1 asks for (B2B rows have a GSTIN).
export async function GET() {
  const profile = await getProfile();
  if (!profile?.is_admin) return new Response("Forbidden", { status: 403 });
  const { data, error } = await createAdminClient().from("invoices").select("*").order("financial_year").order("seq").limit(50000);
  if (error) return new Response("Export failed", { status: 500 });
  const rows = (data ?? []).map((i) => [
    i.invoice_number, istDate(i.issued_at), i.buyer_gstin ? "B2B" : "B2C", i.buyer_name, i.buyer_gstin ?? "", i.buyer_email,
    `${i.place_of_supply}-${stateName(i.place_of_supply) ?? ""}`, i.sac, i.description, "18",
    rupees(i.taxable_paise), rupees(i.cgst_paise), rupees(i.sgst_paise), rupees(i.igst_paise), rupees(i.total_paise), i.razorpay_payment_id,
  ]);
  const header = ["Invoice number", "Invoice date", "Type", "Recipient name", "Recipient GSTIN", "Recipient email", "Place of supply", "SAC", "Description", "GST rate %", "Taxable value", "CGST", "SGST", "IGST", "Invoice value", "Razorpay payment ID"];
  return csvResponse("﻿" + rowsToCsv(header, rows), `gst-invoices-${new Date().toISOString().slice(0, 10)}.csv`);
}
