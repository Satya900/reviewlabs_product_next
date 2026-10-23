import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { PAYMENT_FILTERS, cleanSearch, istDayEnd, istDayStart, paymentFilter, type PaymentFilterKey, type Stage } from "@/lib/follow-up";

export type PaymentRow = Order & { stage: Stage; page_slug: string };

export type PaymentsQuery = {
  creatorId: string;
  pageId?: string | null;
  filter?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
};

export const PER_PAGE = 50;

type Db = Awaited<ReturnType<typeof createClient>>;

// The same search, date and product filters for the list, its counts and the CSV.
// RLS (through the security_invoker view) limits rows to the creator's own.
export function paymentsBase(supabase: Db, q: PaymentsQuery, opts: { head?: boolean } = {}) {
  let query = supabase.from("order_attempts").select("*", { count: "exact", head: opts.head ?? false }).eq("creator_id", q.creatorId);
  if (q.pageId) query = query.eq("page_id", q.pageId);
  const search = cleanSearch(q.q);
  if (search) {
    // Phone numbers match on digits only, so "+91 98765 43210" finds "9876543210".
    const digits = search.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
    const phone = digits.length >= 4 ? `,buyer_phone_digits.like."*${digits}*"` : "";
    query = query.or(`buyer_name.ilike."*${search}*",buyer_email.ilike."*${search}*"${phone}`);
  }
  const from = istDayStart(q.from);
  const to = istDayEnd(q.to);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", to);
  return query;
}

export async function loadPayments(supabase: Db, q: PaymentsQuery) {
  const filter = paymentFilter(q.filter);
  const page = Math.max(1, Math.floor(q.page ?? 1));
  let list = paymentsBase(supabase, q).order("created_at", { ascending: false }).range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (filter.stages) list = list.in("stage", [...filter.stages]);

  const [rows, ...counts] = await Promise.all([
    list,
    ...PAYMENT_FILTERS.map((f) => {
      const c = paymentsBase(supabase, q, { head: true });
      return f.stages ? c.in("stage", [...f.stages]) : c;
    }),
  ]);
  if (rows.error) console.error("[payments]", rows.error.message);
  return {
    filter: filter.key as PaymentFilterKey,
    page,
    rows: (rows.data ?? []) as PaymentRow[],
    total: rows.count ?? 0,
    counts: Object.fromEntries(PAYMENT_FILTERS.map((f, i) => [f.key, counts[i].count ?? 0])) as Record<PaymentFilterKey, number>,
  };
}
