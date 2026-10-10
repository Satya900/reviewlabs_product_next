import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import { PageTitle, Stat, cx, tableClass } from "@/components/ui";
import { hasCreatorPlan } from "@/lib/plans";

export default async function AdminCreators() {
  const db = createAdminClient();
  const [{ data: profiles }, { data: balances }] = await Promise.all([
    db.from("profiles").select("id, email, name, is_admin, plan, plan_status, plan_current_period_end, payout_upi, payout_account_number").order("created_at"),
    db.from("creator_balances").select("*"),
  ]);
  const { data: subPayments } = await db.from("subscription_payments").select("amount_paise").in("status", ["captured", "authorized"]);
  const { data: commission } = await db.from("ledger_entries").select("amount_paise").eq("entry_type", "platform_fee");
  const planRevenue = (subPayments ?? []).reduce((s, r) => s + r.amount_paise, 0);
  const commissionRevenue = -(commission ?? []).reduce((s, r) => s + r.amount_paise, 0);
  const creatorCount = (profiles ?? []).filter((p) => !p.is_admin && hasCreatorPlan(p)).length;
  const balanceBy = new Map((balances ?? []).map((b) => [b.creator_id, b]));
  const totalOwed = (balances ?? []).reduce((s, b) => s + Math.max(0, Number(b.balance_paise)), 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle sub={<>Total owed to creators: <b>{formatPaise(totalOwed)}</b></>}>Creators</PageTitle>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Creator plan subscribers" value={creatorCount} />
        <Stat label="Plan revenue (all time)" value={formatPaise(planRevenue)} />
        <Stat label="Platform fees earned (net)" value={formatPaise(commissionRevenue)} />
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
                    <p className="text-[13px] text-muted">{p.email}{p.is_admin ? " (admin)" : ""}</p>
                  </td>
                  <td className={tableClass.td}>
                    {p.payout_upi || (p.payout_account_number ? `A/c ending ${p.payout_account_number.slice(-4)}` : <span className="font-medium text-accent-yellow">Not set</span>)}
                  </td>
                  <td className={tableClass.td}>{p.is_admin ? "Admin" : hasCreatorPlan(p) ? `Creator (${p.plan_status})` : "Free"}</td>
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
