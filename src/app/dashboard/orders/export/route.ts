import { createClient } from "@/lib/supabase/server";
import { csvResponse, ordersToCsv } from "@/lib/csv";
import type { Order } from "@/lib/types";
import { creatorHasPlan } from "@/lib/plans-server";

const statusFilters: Record<string, string[] | null> = {
  paid: ["paid", "partially_refunded"],
  refunded: ["refunded", "partially_refunded"],
  all: null,
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await creatorHasPlan(user.id))) return new Response("CSV export is part of the Creator plan.", { status: 403 });

  const filter = new URL(request.url).searchParams.get("filter") ?? "paid";
  const statuses = statusFilters[filter] ?? statusFilters.paid;

  // RLS limits this to the creator's own orders.
  let query = supabase.from("orders").select("*").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(10000);
  if (statuses) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) return new Response("Export failed", { status: 500 });

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(ordersToCsv((data ?? []) as Order[]), `orders-${filter}-${date}.csv`);
}
