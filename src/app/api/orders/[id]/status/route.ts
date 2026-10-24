import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderLinks, type DeliverableLink } from "@/lib/order-files";

// Polled by the success page. Order ids are unguessable UUIDs held by the buyer.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, status, page_id").eq("id", id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let downloadToken: string | null = null;
  let links: DeliverableLink[] = [];
  // Product links are what the buyer paid for, so they're only sent once paid.
  if (order.status === "paid" || order.status === "partially_refunded") {
    const [{ data: grant }, list] = await Promise.all([
      admin.from("download_grants").select("token").eq("order_id", id).maybeSingle(),
      orderLinks(order),
    ]);
    downloadToken = grant?.token ?? null;
    links = list;
  }
  return NextResponse.json({ status: order.status, downloadToken, links }, { headers: { "cache-control": "no-store" } });
}
