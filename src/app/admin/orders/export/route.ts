import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { csvResponse, ordersToCsv } from "@/lib/csv";
import type { Order } from "@/lib/types";

export async function GET() {
  const profile = await getProfile();
  if (!profile?.is_admin) return new Response("Forbidden", { status: 403 });

  const db = createAdminClient();
  const [{ data: orders, error }, { data: profiles }] = await Promise.all([
    db.from("orders").select("*").order("created_at", { ascending: false }).limit(20000),
    db.from("profiles").select("id, email"),
  ]);
  if (error) return new Response("Export failed", { status: 500 });
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const rows = ((orders ?? []) as Order[]).map((o) => ({ ...o, creator_email: emailById.get(o.creator_id) }));
  return csvResponse(ordersToCsv(rows, true), `all-orders-${new Date().toISOString().slice(0, 10)}.csv`);
}
