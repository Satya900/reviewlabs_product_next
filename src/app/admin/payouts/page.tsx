import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import { EmptyState, PageTitle, Panel, Stat, buttonClass, cx, tableClass } from "@/components/ui";
import { PayoutsTable } from "@/components/payouts-table";
import { CopyButton } from "@/components/copy-button";
import { env } from "@/lib/env";
import { PAYOUT_MIN_PAISE, listDuePayouts, payoutsEnabled } from "@/lib/payouts";
import type { Payout } from "@/lib/types";
import { MarkPaidForm, RunPayoutsButton } from "../forms";

export default async function AdminPayouts() {
  const db = createAdminClient();
  const [{ data: payouts }, due] = await Promise.all([
    db.from("payouts").select("*, profiles!payouts_creator_id_fkey(email)").order("created_at", { ascending: false }).limit(200),
    listDuePayouts(),
  ]);
  const rows = (payouts ?? []).map((p) => ({ ...(p as Payout), creator_email: (p as { profiles?: { email: string } | null }).profiles?.email }));
  const open = rows.filter((p) => p.status === "queued" || p.status === "processing");
  const dueTotal = due.reduce((sum, d) => sum + d.availablePaise, 0);
  const enabled = payoutsEnabled();
  const auto = enabled && env.autoPayouts();

  return (
    <>
      <PageTitle
        sub={
          enabled
            ? `Automatic payouts run every day at 10:00 AM IST. A sale can be paid 24 hours after it happens; the minimum payout is ${formatPaise(PAYOUT_MIN_PAISE)}.`
            : `Manual mode until RazorpayX is connected. Every morning at 10:00 AM IST you get an email with who is due. Pay each creator from your bank or UPI app, then record the UTR below.`
        }
      >
        Payouts
      </PageTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Due now" value={formatPaise(dueTotal)} sub={`${due.length} creator${due.length === 1 ? "" : "s"} with ${formatPaise(PAYOUT_MIN_PAISE)}+ ready`} />
        <Stat label="On the way" value={formatPaise(open.reduce((s, p) => s + p.amount_paise, 0))} sub={`${open.length} queued or sending`} />
        <Stat label="Mode" value={auto ? "Automatic" : enabled ? "RazorpayX, manual runs" : "Manual"} sub={enabled ? "RazorpayX connected" : "Set the RAZORPAYX_* keys to automate"} />
      </div>

      {enabled ? (
        <Panel title="Run now">
          <p className="mb-4 text-[14px] text-body">
            Pays every creator their available balance straight away, the same as the daily run. Keep enough money in your
            RazorpayX account: payouts wait in the queue when the balance is low and go out once you top it up.
          </p>
          <RunPayoutsButton disabled={false} />
        </Panel>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[20px] font-semibold">Pay these creators</h2>
            {due.length > 0 && <Link href="/admin/payouts/export" className={cx(buttonClass.secondary, "h-10 px-4")}>Download bank CSV</Link>}
          </div>
          {due.length === 0 ? (
            <EmptyState>Nobody is due right now. Sales become payable 24 hours after they happen.</EmptyState>
          ) : (
            <div className={tableClass.wrap}>
              <table className={`${tableClass.table} min-w-[860px]`}>
                <thead>
                  <tr>
                    <th className={tableClass.th}>Creator</th>
                    <th className={tableClass.th}>Send to</th>
                    <th className={tableClass.th}>Record payment</th>
                  </tr>
                </thead>
                <tbody>
                  {due.map((d) => (
                    <tr key={d.creatorId}>
                      <td className={`${tableClass.td} align-top`}>
                        <Link href={`/admin/creators/${d.creatorId}`} className="link font-medium">{d.name || d.email}</Link>
                        <p className="text-[13px] text-body">{d.email}</p>
                        <p className="num mt-1 text-[18px] font-semibold">{formatPaise(d.availablePaise)}</p>
                      </td>
                      <td className={`${tableClass.td} align-top text-[14px]`}>
                        {d.upi ? (
                          <div className="flex items-center gap-2"><span>UPI <span className="font-mono">{d.upi}</span></span><CopyButton value={d.upi} /></div>
                        ) : d.accountNumber && d.ifsc ? (
                          <div className="space-y-1">
                            <div>{d.accountName}</div>
                            <div className="flex items-center gap-2"><span>A/c <span className="font-mono">{d.accountNumber}</span></span><CopyButton value={d.accountNumber} /></div>
                            <div className="flex items-center gap-2"><span>IFSC <span className="font-mono">{d.ifsc}</span></span><CopyButton value={d.ifsc} /></div>
                          </div>
                        ) : (
                          <span className="font-medium text-accent-yellow">No payout details yet</span>
                        )}
                      </td>
                      <td className={`${tableClass.td} align-top`}>
                        <MarkPaidForm creatorId={d.creatorId} amountPaise={d.availablePaise} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <h2 className="text-[20px] font-semibold">History</h2>
      <PayoutsTable payouts={rows} showCreator />
    </>
  );
}
