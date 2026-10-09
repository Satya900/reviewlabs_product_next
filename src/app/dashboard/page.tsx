import Link from "next/link";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { Badge, Notice, Panel, PageTitle, Stat } from "@/components/ui";
import type { Order } from "@/lib/types";

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 86_400_000).toISOString();
}

export default async function DashboardHome() {
  const profile = await requireCreator();
  const supabase = await createClient();
  const since = thirtyDaysAgo();

  const [{ data: balance }, { data: recent }, { data: last30 }, { count: liveCount }] = await Promise.all([
    supabase.from("creator_balances").select("*").eq("creator_id", profile.id).maybeSingle(),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(8),
    supabase.from("orders").select("amount_paise").in("status", ["paid", "partially_refunded"]).gte("paid_at", since),
    supabase.from("payment_pages").select("id", { count: "exact", head: true }).eq("status", "live"),
  ]);

  const sales30 = (last30 ?? []).reduce((sum, o) => sum + o.amount_paise, 0);
  const missingPayout = !profile.payout_upi && !profile.payout_account_number;

  return (
    <>
      <PageTitle>Hello{profile.name ? `, ${profile.name}` : ""}</PageTitle>
      {missingPayout && (
        <Notice tone="warn">
          Add your UPI ID or bank account in <Link href="/dashboard/settings" className="link">settings</Link> so we can send your payouts.
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Balance owed to you" value={formatPaise(balance?.balance_paise ?? 0)} />
        <Stat label="Sales, last 30 days" value={formatPaise(sales30)} sub={`${last30?.length ?? 0} orders`} />
        <Stat label="Live pages" value={liveCount ?? 0} />
      </div>
      <Panel title="Recent orders" aside={<Link href="/dashboard/orders" className="link text-[14px]">View all</Link>}>
        {!recent?.length ? (
          <p className="text-[14px]">
            No orders yet. <Link href="/dashboard/pages" className="link">Make a page</Link> and share the link.
          </p>
        ) : (
          <ul className="-my-2 divide-y divide-hairline-soft">
            {(recent as Order[]).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-4 py-3 text-[15px]">
                <span className="min-w-0 truncate">{o.buyer_name}, {o.page_title}</span>
                <span className="flex shrink-0 items-center gap-3"><Badge status={o.status} /><span className="num">{formatPaise(o.amount_paise)}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
