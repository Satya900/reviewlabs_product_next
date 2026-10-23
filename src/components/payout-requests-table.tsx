import { formatPaise } from "@/lib/money";
import { Badge, tableClass } from "@/components/ui";
import { maskAccountNumber } from "@/lib/bank-details";
import type { PayoutRequest } from "@/lib/payout-requests";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const badge: Record<PayoutRequest["status"], [string, string]> = {
  pending: ["pending", "In review"],
  paid: ["processed", "Paid"],
  rejected: ["failed", "Not approved"],
  cancelled: ["archived", "Cancelled"],
};

// The creator's own payout requests (Earnings).
export function PayoutRequestsTable({ requests }: { requests: PayoutRequest[] }) {
  return (
    <div className={tableClass.wrap}>
      <table className={`${tableClass.table} min-w-[640px]`}>
        <thead>
          <tr>
            <th className={tableClass.th}>Requested</th>
            <th className={tableClass.th}>To</th>
            <th className={tableClass.th}>Status</th>
            <th className={`${tableClass.th} text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td className={`${tableClass.td} whitespace-nowrap text-body`}>{dateFmt.format(new Date(r.created_at))}</td>
              <td className={`${tableClass.td} text-body`}>{r.bank_name ?? r.ifsc} · {maskAccountNumber(r.account_number)}</td>
              <td className={tableClass.td}>
                <Badge status={badge[r.status][0]} label={badge[r.status][1]} />
                {r.status === "paid" && r.utr && <p className="mt-1 font-mono text-[12px] text-body">UTR {r.utr}</p>}
                {r.status === "rejected" && r.reject_reason && <p className="mt-1 max-w-[260px] text-[12px] text-down">{r.reject_reason}</p>}
              </td>
              <td className={`${tableClass.td} num whitespace-nowrap text-right`}>{formatPaise(r.amount_paise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
