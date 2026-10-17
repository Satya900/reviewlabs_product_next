import { formatPaise } from "@/lib/money";
import { EmptyState, cx, tableClass } from "@/components/ui";
import type { LedgerEntry } from "@/lib/types";

const labels: Record<LedgerEntry["entry_type"], string> = {
  sale: "Sale",
  gateway_fee: "Gateway fee",
  platform_fee: "Platform fee",
  refund: "Refund",
  subscription_fee: "Plan fee",
  payout: "Payout",
  payout_reversal: "Payout returned",
  adjustment: "Adjustment",
};
const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length) return <EmptyState>No transactions yet.</EmptyState>;
  return (
    <div className={tableClass.wrap}>
      <table className={`${tableClass.table} min-w-[560px]`}>
        <thead>
          <tr>
            <th className={tableClass.th}>Date</th>
            <th className={tableClass.th}>Type</th>
            <th className={tableClass.th}>Details</th>
            <th className={`${tableClass.th} text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className={`${tableClass.td} whitespace-nowrap text-body`}>{dateFmt.format(new Date(e.created_at))}</td>
              <td className={`${tableClass.td} font-medium`}>{labels[e.entry_type]}</td>
              <td className={`${tableClass.td} text-body`}>{e.description}</td>
              <td className={cx(tableClass.td, "num whitespace-nowrap text-right", e.amount_paise > 0 && "text-up")}>
                {e.amount_paise > 0 ? "+" : ""}{formatPaise(e.amount_paise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
