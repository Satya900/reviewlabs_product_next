import { formatPaise } from "@/lib/money";
import { Badge, EmptyState, tableClass } from "@/components/ui";
import type { Payout } from "@/lib/types";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const statusLabel: Record<Payout["status"], string> = {
  queued: "Queued",
  processing: "Sending",
  processed: "Sent",
  failed: "Failed",
  reversed: "Returned",
  cancelled: "Cancelled",
};

export function PayoutsTable({ payouts, showCreator }: { payouts: (Payout & { creator_email?: string })[]; showCreator?: boolean }) {
  if (!payouts.length) return <EmptyState>No payouts yet.</EmptyState>;
  return (
    <div className={tableClass.wrap}>
      <table className={`${tableClass.table} min-w-[640px]`}>
        <thead>
          <tr>
            <th className={tableClass.th}>Date</th>
            {showCreator && <th className={tableClass.th}>Creator</th>}
            <th className={tableClass.th}>Sent to</th>
            <th className={tableClass.th}>Status</th>
            <th className={tableClass.th}>Reference</th>
            <th className={`${tableClass.th} text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td className={`${tableClass.td} whitespace-nowrap text-body`}>{dateFmt.format(new Date(p.processed_at ?? p.created_at))}</td>
              {showCreator && <td className={`${tableClass.td} text-body`}>{p.creator_email}</td>}
              <td className={`${tableClass.td} text-body`}>
                {p.destination_label ?? (p.method === "upi" ? "UPI" : p.method === "bank_transfer" ? "Bank transfer" : "Other")}
                {p.provider === "manual" && <span className="ml-1 text-[12px] text-muted">(manual)</span>}
              </td>
              <td className={tableClass.td}>
                <Badge status={p.status} label={statusLabel[p.status]} />
                {p.failure_reason && <p className="mt-1 max-w-[220px] text-[12px] text-down">{p.failure_reason}</p>}
              </td>
              <td className={`${tableClass.td} font-mono text-[13px] text-body`}>{p.utr ?? p.reference ?? "—"}</td>
              <td className={`${tableClass.td} num whitespace-nowrap text-right`}>{formatPaise(p.amount_paise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
