import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import { Badge, EmptyState, PageTitle, Stat, tableClass } from "@/components/ui";
import { PayoutsTable } from "@/components/payouts-table";
import { CopyButton } from "@/components/copy-button";
import { chequeUrl, type PayoutRequest } from "@/lib/payout-requests";
import type { Payout } from "@/lib/types";
import { PayoutRequestActions } from "../forms";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
type Creator = { email: string; name: string | null };
type Row = PayoutRequest & { creator: Creator | null };

export default async function AdminPayouts() {
  const db = createAdminClient();
  const [{ data: pendingRows }, { data: recentRows }, { data: payouts }] = await Promise.all([
    db.from("payout_requests").select("*, creator:profiles!payout_requests_creator_id_fkey(email, name)").eq("status", "pending").order("created_at"),
    db.from("payout_requests").select("*, creator:profiles!payout_requests_creator_id_fkey(email, name)").neq("status", "pending").order("created_at", { ascending: false }).limit(100),
    db.from("payouts").select("*, profiles!payouts_creator_id_fkey(email)").order("created_at", { ascending: false }).limit(200),
  ]);
  const pending = (pendingRows ?? []) as Row[];
  const recent = (recentRows ?? []) as Row[];
  const ids = [...new Set(pending.map((r) => r.creator_id))];
  const [{ data: balances }, cheques] = await Promise.all([
    ids.length ? db.from("creator_balances").select("creator_id, available_paise").in("creator_id", ids) : Promise.resolve({ data: [] }),
    Promise.all(pending.map((r) => chequeUrl(r.cheque_path))),
  ]);
  const availableBy = new Map((balances ?? []).map((b) => [b.creator_id as string, Number(b.available_paise)]));
  const rows = (payouts ?? []).map((p) => ({ ...(p as Payout), creator_email: (p as { profiles?: { email: string } | null }).profiles?.email }));
  const paidThisMonth = recent
    .filter((r) => r.status === "paid" && r.decided_at && new Date(r.decided_at) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    .reduce((s, r) => s + r.amount_paise, 0);

  return (
    <>
      <PageTitle sub="Creators request payouts from their Earnings page (₹500 minimum, up to their available balance). Check the cancelled cheque, send the money from your bank, then approve the request with the UTR.">
        Payouts
      </PageTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Requests waiting" value={pending.length} />
        <Stat label="Amount requested" value={formatPaise(pending.reduce((s, r) => s + r.amount_paise, 0))} />
        <Stat label="Paid this month" value={formatPaise(paidThisMonth)} />
      </div>

      <h2 className="text-[20px] font-semibold">Payout requests</h2>
      {pending.length === 0 ? (
        <EmptyState>No payout requests waiting. You&apos;ll get an email when a creator asks for one.</EmptyState>
      ) : (
        <div className={tableClass.wrap}>
          <table className={`${tableClass.table} min-w-[980px]`}>
            <thead>
              <tr>
                <th className={tableClass.th}>Creator and amount</th>
                <th className={tableClass.th}>Pay to</th>
                <th className={tableClass.th}>Approve or reject</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r, i) => {
                const available = availableBy.get(r.creator_id) ?? 0;
                return (
                  <tr key={r.id}>
                    <td className={`${tableClass.td} align-top`}>
                      <Link href={`/admin/creators/${r.creator_id}`} className="link font-medium">{r.creator?.name || r.creator?.email}</Link>
                      <p className="text-[13px] text-body">{r.creator?.email}</p>
                      <p className="num mt-2 text-[22px] font-semibold">{formatPaise(r.amount_paise)}</p>
                      <p className={`text-[13px] ${available < r.amount_paise ? "font-semibold text-down" : "text-muted"}`}>
                        Available now: {formatPaise(available)}{available < r.amount_paise ? " (less than requested)" : ""}
                      </p>
                      <p className="mt-1 text-[12px] text-muted">Requested {dateFmt.format(new Date(r.created_at))}</p>
                    </td>
                    <td className={`${tableClass.td} align-top text-[14px]`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2"><span className="font-medium">{r.account_name}</span><CopyButton value={r.account_name} /></div>
                        <div className="flex items-center gap-2"><span>A/c <span className="font-mono">{r.account_number}</span></span><CopyButton value={r.account_number} /></div>
                        <div className="flex items-center gap-2"><span>IFSC <span className="font-mono">{r.ifsc}</span></span><CopyButton value={r.ifsc} /></div>
                        {r.bank_name && <div className="text-[13px] text-body">{r.bank_name}</div>}
                        {cheques[i] ? (
                          <a href={cheques[i]!} target="_blank" rel="noopener noreferrer" className="link inline-block pt-1 text-[14px]">View cancelled cheque ↗</a>
                        ) : (
                          <span className="text-[13px] font-medium text-down">Cheque file missing</span>
                        )}
                      </div>
                    </td>
                    <td className={`${tableClass.td} align-top`}>
                      <PayoutRequestActions requestId={r.id} amountPaise={r.amount_paise} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {recent.length > 0 && (
        <>
          <h2 className="text-[20px] font-semibold">Handled requests</h2>
          <div className={tableClass.wrap}>
            <table className={`${tableClass.table} min-w-[760px]`}>
              <thead>
                <tr>
                  <th className={tableClass.th}>Requested</th>
                  <th className={tableClass.th}>Creator</th>
                  <th className={tableClass.th}>Outcome</th>
                  <th className={`${tableClass.th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className={`${tableClass.td} whitespace-nowrap text-body`}>{dateFmt.format(new Date(r.created_at))}</td>
                    <td className={tableClass.td}><Link href={`/admin/creators/${r.creator_id}`} className="link">{r.creator?.name || r.creator?.email}</Link></td>
                    <td className={tableClass.td}>
                      <Badge status={r.status === "paid" ? "processed" : r.status === "rejected" ? "failed" : "archived"} label={r.status === "paid" ? "Paid" : r.status === "rejected" ? "Rejected" : "Cancelled by creator"} />
                      {r.utr && <p className="mt-1 font-mono text-[12px] text-body">UTR {r.utr}</p>}
                      {r.reject_reason && <p className="mt-1 max-w-[280px] text-[12px] text-down">{r.reject_reason}</p>}
                    </td>
                    <td className={`${tableClass.td} num whitespace-nowrap text-right`}>{formatPaise(r.amount_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2 className="text-[20px] font-semibold">All payouts</h2>
      <PayoutsTable payouts={rows} showCreator />
    </>
  );
}
