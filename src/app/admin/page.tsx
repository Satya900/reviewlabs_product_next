import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import { PageTitle, cx, tableClass } from "@/components/ui";
import { ChargeSubscriptionsButton } from "./forms";

export default async function AdminCreators() {
  const db = createAdminClient();
  const [{ data: profiles }, { data: balances }] = await Promise.all([
    db.from("profiles").select("id, email, name, is_admin, subscription_active, plan_amount_paise, payout_upi, payout_account_number").order("created_at"),
    db.from("creator_balances").select("*"),
  ]);
  const balanceBy = new Map((balances ?? []).map((b) => [b.creator_id, b]));
  const totalOwed = (balances ?? []).reduce((s, b) => s + Math.max(0, Number(b.balance_paise)), 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle sub={<>Total owed to creators: <b>{formatPaise(totalOwed)}</b></>}>Creators</PageTitle>
        <ChargeSubscriptionsButton />
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
                  <td className={tableClass.td}>{p.is_admin ? "Exempt" : p.subscription_active ? `${formatPaise(p.plan_amount_paise)}/month` : "Paused"}</td>
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
