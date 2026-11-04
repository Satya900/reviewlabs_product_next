import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import { PageTitle, Stat, buttonClass, cx, tableClass } from "@/components/ui";
import { currentTier } from "@/lib/plans";
import { attributionLabel, type Attribution } from "@/lib/ad-click";

export default async function AdminCreators() {
  const db = createAdminClient();
  const [{ data: profiles }, { data: balances }] = await Promise.all([
    db.from("profiles").select("id, email, name, is_admin, plan, plan_status, plan_current_period_end, payout_upi, payout_account_number, payout_bank_submitted_at, payout_bank_name, email_verified_at, signup_attribution, created_at").order("created_at"),
    db.from("creator_balances").select("*"),
  ]);
  const { data: subPayments } = await db.from("subscription_payments").select("creator_id, amount_paise").in("status", ["captured", "authorized"]);
  const { data: commission } = await db.from("ledger_entries").select("amount_paise").eq("entry_type", "platform_fee");
  const planRevenue = (subPayments ?? []).reduce((s, r) => s + r.amount_paise, 0);
  const commissionRevenue = -(commission ?? []).reduce((s, r) => s + r.amount_paise, 0);
  const creatorCount = (profiles ?? []).filter((p) => { const t = currentTier(p); return !p.is_admin && (t === "creator" || t === "pro"); }).length;
  const trialCount = (profiles ?? []).filter((p) => !p.is_admin && currentTier(p) === "trial").length;
  // Which ads bring signups and paying creators (last ad click before signup).
  const paidCreators = new Set((subPayments ?? []).map((r) => r.creator_id));
  const funnel = new Map<string, { signups: number; paid: number; last: string }>();
  for (const p of profiles ?? []) {
    if (p.is_admin) continue;
    const key = attributionLabel(p.signup_attribution as Attribution | null);
    const row = funnel.get(key) ?? { signups: 0, paid: 0, last: p.created_at };
    row.signups++;
    if (paidCreators.has(p.id)) row.paid++;
    if (p.created_at > row.last) row.last = p.created_at;
    funnel.set(key, row);
  }
  const funnelRows = [...funnel.entries()].sort((a, b) => b[1].signups - a[1].signups);
  const balanceBy = new Map((balances ?? []).map((b) => [b.creator_id, b]));
  const totalOwed = (balances ?? []).reduce((s, b) => s + Math.max(0, Number(b.balance_paise)), 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle sub={<>Total owed to creators: <b>{formatPaise(totalOwed)}</b></>}>Creators</PageTitle>
        <Link href="/admin/creators/new" className={buttonClass.primary}>Add creator</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Paying creators (Creator + Pro)" value={creatorCount} sub={`${trialCount} on free trial`} />
        <Stat label="Plan revenue (all time)" value={formatPaise(planRevenue)} />
        <Stat label="Platform fees earned (net)" value={formatPaise(commissionRevenue)} />
      </div>
      <div className={tableClass.wrap}>
        <table className={`${tableClass.table} min-w-[560px]`}>
          <thead>
            <tr>
              <th className={tableClass.th}>Signups by source / medium / campaign</th>
              <th className={`${tableClass.th} text-right`}>Signups</th>
              <th className={`${tableClass.th} text-right`}>Paid</th>
              <th className={`${tableClass.th} text-right`}>Paid rate</th>
              <th className={`${tableClass.th} text-right`}>Latest signup</th>
            </tr>
          </thead>
          <tbody>
            {funnelRows.map(([label, r]) => (
              <tr key={label}>
                <td className={tableClass.td}>{label}</td>
                <td className={cx(tableClass.td, "num text-right")}>{r.signups}</td>
                <td className={cx(tableClass.td, "num text-right")}>{r.paid}</td>
                <td className={cx(tableClass.td, "num text-right")}>{Math.round((r.paid / r.signups) * 100)}%</td>
                <td className={cx(tableClass.td, "num text-right")}>{new Date(r.last).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={tableClass.wrap}>
        <table className={`${tableClass.table} min-w-[720px]`}>
          <thead>
            <tr>
              <th className={tableClass.th}>Creator</th>
              <th className={tableClass.th}>Pay to</th>
              <th className={tableClass.th}>Plan</th>
              <th className={tableClass.th}>Gross sales</th>
              <th className={`${tableClass.th} text-right`}>Balance owed</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => {
              const b = balanceBy.get(p.id);
              const balance = Number(b?.balance_paise ?? 0);
              return (
                <tr key={p.id}>
                  <td className={tableClass.td}>
                    <Link href={`/admin/creators/${p.id}`} className="font-semibold">{p.name || p.email}</Link>
                    <p className="text-[13px] text-muted">
                      {p.email}{p.is_admin ? " (admin)" : ""}
                      {!p.email_verified_at && !p.is_admin && <span className="ml-2 font-medium text-accent-yellow">Email not verified</span>}
                    </p>
                    {!p.is_admin && <p className="text-[12px] text-muted">From: {attributionLabel(p.signup_attribution as Attribution | null)}</p>}
                  </td>
                  <td className={tableClass.td}>
                    {p.payout_bank_submitted_at && p.payout_account_number
                      ? <>{p.payout_bank_name?.split(",")[0] ?? "Bank"} · A/c ending {p.payout_account_number.slice(-4)}</>
                      : <span className="font-medium text-accent-yellow">No bank yet</span>}
                  </td>
                  <td className={tableClass.td}>{p.is_admin ? "Admin" : { pro: `Pro (${p.plan_status})`, creator: `Creator (${p.plan_status})`, trial: "Trial", none: "No plan (offline)" }[currentTier(p)]}</td>
                  <td className={tableClass.td}>{formatPaise(Number(b?.gross_sales_paise ?? 0))}</td>
                  <td className={cx(tableClass.td, "num text-right", balance < 0 ? "text-down" : balance > 0 ? "text-up" : "")}>{formatPaise(balance)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
