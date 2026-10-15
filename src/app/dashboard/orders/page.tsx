import Link from "next/link";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrdersTable } from "@/components/orders-table";
import { PageTitle, buttonClass } from "@/components/ui";
import type { Order } from "@/lib/types";
import { hasCreatorPlan } from "@/lib/plans";

const filters = [
  { key: "paid", label: "Paid", statuses: ["paid", "partially_refunded"], amount: "paid" },
  { key: "leads", label: "Leads (free)", statuses: ["paid"], amount: "free" },
  { key: "refunded", label: "Refunded", statuses: ["refunded", "partially_refunded"], amount: null },
  { key: "all", label: "All attempts", statuses: null, amount: null },
] as const;

export default async function OrdersPage({ searchParams }: PageProps<"/dashboard/orders">) {
  const profile = await requireCreator();
  const { filter = "paid" } = await searchParams;
  const active = filters.find((f) => f.key === filter) ?? filters[0];

  const supabase = await createClient();
  let query = supabase.from("orders").select("*").eq("creator_id", profile.id).order("created_at", { ascending: false }).limit(200);
  if (active.statuses) query = query.in("status", [...active.statuses]);
  if (active.amount === "paid") query = query.gt("amount_paise", 0);
  if (active.amount === "free") query = query.eq("amount_paise", 0);
  const { data: orders } = await query;

  return (
    <>
      <PageTitle>Orders</PageTitle>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link key={f.key} href={`/dashboard/orders?filter=${f.key}`} className={f.key === active.key ? buttonClass.primary : buttonClass.secondary}>
            {f.label}
          </Link>
        ))}
        {hasCreatorPlan(profile) || active.key === "leads" ? (
          <a href={`/dashboard/orders/export?filter=${active.key}`} className={`${buttonClass.secondary} sm:ml-auto`}>Download CSV</a>
        ) : (
          <Link href="/dashboard/billing" className={`${buttonClass.secondary} sm:ml-auto`}>Download CSV (Creator)</Link>
        )}
      </div>
      <OrdersTable orders={(orders ?? []) as Order[]} />
    </>
  );
}
