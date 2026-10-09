import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Polled by the success page. Order ids are unguessable UUIDs held by the buyer.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, status").eq("id", id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let downloadToken: string | null = null;
  if (order.status === "paid" || order.status === "partially_refunded") {
    const { data: grant } = await admin.from("download_grants").select("token").eq("order_id", id).maybeSingle();
    downloadToken = grant?.token ?? null;
  }
  return NextResponse.json({ status: order.status, downloadToken }, { headers: { "cache-control": "no-store" } });
}
