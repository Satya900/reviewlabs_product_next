import { getProfile } from "@/lib/auth";
import { csvResponse, rowsToCsv } from "@/lib/csv";
import { listDuePayouts } from "@/lib/payouts";

// Today's due payouts as a CSV, to fill your bank's bulk-transfer sheet.
export async function GET() {
  const profile = await getProfile();
  if (!profile?.is_admin) return new Response("Forbidden", { status: 403 });
  const due = await listDuePayouts();
  const csv = rowsToCsv(
    ["Creator email", "Name", "Amount (INR)", "Pay by", "UPI ID", "Account holder", "Account number", "IFSC", "Reference"],
    due.map((d) => [
      d.email,
      d.name ?? "",
      (d.availablePaise / 100).toFixed(2),
      d.destination?.method === "upi" ? "UPI" : d.destination ? "Bank (IMPS/NEFT)" : "Missing details",
      d.upi ?? "",
      d.accountName ?? "",
      d.accountNumber ?? "",
      d.ifsc ?? "",
      "Reviewlabs payout",
    ]),
  );
  return csvResponse("﻿" + csv, `payouts-due-${new Date().toISOString().slice(0, 10)}.csv`);
}
