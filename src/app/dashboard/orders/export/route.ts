import { createClient } from "@/lib/supabase/server";
import { csvResponse, ordersToCsv } from "@/lib/csv";
import { creatorHasPlan } from "@/lib/plans-server";
import { browserParams, paymentFilter } from "@/lib/follow-up";
import { paymentsBase, type PaymentRow } from "@/lib/payments-list";

// CSV of the same view the creator is looking at (status, search, dates, product).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await creatorHasPlan(user.id))) return new Response("CSV export is part of the Creator plan.", { status: 403 });

  const params = browserParams(Object.fromEntries(new URL(request.url).searchParams));
  const filter = paymentFilter(params.filter);
  let query = paymentsBase(supabase, { creatorId: user.id, pageId: params.product || null, ...params })
    .order("created_at", { ascending: false })
    .limit(10000);
  if (filter.stages) query = query.in("stage", [...filter.stages]);
  const { data, error } = await query;
  if (error) return new Response("Export failed", { status: 500 });

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(ordersToCsv((data ?? []) as PaymentRow[]), `orders-${filter.key}-${date}.csv`);
}
