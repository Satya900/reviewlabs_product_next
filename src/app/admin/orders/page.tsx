import { createAdminClient } from "@/lib/supabase/admin";
import { OrdersTable } from "@/components/orders-table";
import { PageTitle, buttonClass } from "@/components/ui";
import type { Order } from "@/lib/types";
import { RefundForm } from "../forms";

export default async function AdminOrders() {
  const { data: orders } = await createAdminClient()
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle>All orders</PageTitle>
        <a href="/admin/orders/export" className={buttonClass.secondary}>Download CSV</a>
      </div>
      <OrdersTable
        orders={(orders ?? []) as Order[]}
        actions={(o) => (o.status === "paid" || o.status === "partially_refunded" ? <RefundForm orderId={o.id} /> : null)}
      />
    </>
  );
}
