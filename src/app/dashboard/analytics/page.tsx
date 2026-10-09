import Link from "next/link";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { PageTitle, Stat, buttonClass, tableClass } from "@/components/ui";
import { DayBars } from "@/components/day-bars";

const ranges = [7, 30, 90] as const;
const istDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

// Days (YYYY-MM-DD, IST) from `days - 1` days ago up to today.
function dayRange(days: number): string[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => istDay.format(new Date(now - (days - 1 - i) * 86_400_000)));
}

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "n/a");

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const profile = await requireCreator();
  const { range } = await searchParams;
  const days = ranges.find((r) => String(r) === range) ?? 30;
  const dayKeys = dayRange(days);
  const fromDay = dayKeys[0];
  const fromIso = `${fromDay}T00:00:00+05:30`;

  const supabase = await createClient();
  const [{ data: pages }, { data: views }, { data: orders }] = await Promise.all([
    supabase.from("payment_pages").select("id, title, slug, status").eq("creator_id", profile.id).order("created_at"),
    supabase.from("page_views_daily").select("page_id, day, views").gte("day", fromDay),
    supabase.from("orders").select("page_id, status, amount_paise, created_at, paid_at").eq("creator_id", profile.id).gte("created_at", fromIso),
  ]);

  const paidStatuses = new Set(["paid", "partially_refunded"]);
  const perPage = new Map((pages ?? []).map((p) => [p.id, { ...p, views: 0, checkouts: 0, sales: 0, revenue: 0 }]));
  const viewsByDay = new Map(dayKeys.map((d) => [d, 0]));
  const salesByDay = new Map(dayKeys.map((d) => [d, 0]));

  for (const v of views ?? []) {
    const row = perPage.get(v.page_id);
    if (row) row.views += v.views;
    viewsByDay.set(v.day, (viewsByDay.get(v.day) ?? 0) + v.views);
  }
  for (const o of orders ?? []) {
    const row = perPage.get(o.page_id);
    if (!row) continue;
    row.checkouts += 1;
    if (paidStatuses.has(o.status)) {
      row.sales += 1;
      row.revenue += o.amount_paise;
      const d = istDay.format(new Date(o.paid_at ?? o.created_at));
      if (salesByDay.has(d)) salesByDay.set(d, (salesByDay.get(d) ?? 0) + o.amount_paise);
    }
  }

  const rows = [...perPage.values()].filter((r) => r.status !== "archived" || r.views || r.checkouts);
  const totals = rows.reduce((t, r) => ({ views: t.views + r.views, checkouts: t.checkouts + r.checkouts, sales: t.sales + r.sales, revenue: t.revenue + r.revenue }), { views: 0, checkouts: 0, sales: 0, revenue: 0 });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle sub="Views count one visit per browser session. Checkouts are buyers who clicked pay. Sales are confirmed payments.">Analytics</PageTitle>
        <div className="flex gap-2">
          {ranges.map((r) => (
            <Link key={r} href={`/dashboard/analytics?range=${r}`} className={r === days ? buttonClass.primary : buttonClass.secondary}>
              {r} days
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Page views" value={totals.views.toLocaleString("en-IN")} />
        <Stat label="Checkouts started" value={totals.checkouts.toLocaleString("en-IN")} sub={`${pct(totals.checkouts, totals.views)} of views`} />
        <Stat label="Sales" value={totals.sales.toLocaleString("en-IN")} sub={`${pct(totals.sales, totals.views)} of views`} />
        <Stat label="Revenue" value={formatPaise(totals.revenue)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DayBars title="Page views per day" points={dayKeys.map((d) => ({ day: d, value: viewsByDay.get(d) ?? 0 }))} format={(n) => n.toLocaleString("en-IN")} />
        <DayBars title="Sales per day" points={dayKeys.map((d) => ({ day: d, value: salesByDay.get(d) ?? 0 }))} format={formatPaise} />
      </div>

      <div className={tableClass.wrap}>
        <table className={`${tableClass.table} min-w-[640px]`}>
          <thead>
            <tr>
              <th className={tableClass.th}>Page</th>
              <th className={`${tableClass.th} text-right`}>Views</th>
              <th className={`${tableClass.th} text-right`}>Checkouts</th>
              <th className={`${tableClass.th} text-right`}>Sales</th>
              <th className={`${tableClass.th} text-right`}>Conversion</th>
              <th className={`${tableClass.th} text-right`}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={tableClass.td}>
                  <Link href={`/dashboard/pages/${r.id}`}>{r.title}</Link>
                </td>
                <td className={`${tableClass.td} text-right`}>{r.views.toLocaleString("en-IN")}</td>
                <td className={`${tableClass.td} text-right`}>{r.checkouts.toLocaleString("en-IN")}</td>
                <td className={`${tableClass.td} text-right`}>{r.sales.toLocaleString("en-IN")}</td>
                <td className={`${tableClass.td} text-right`}>{pct(r.sales, r.views)}</td>
                <td className={`${tableClass.td} text-right font-bold`}>{formatPaise(r.revenue)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className={`${tableClass.td} text-center`}>No pages yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[12px]">Views are counted from when analytics was switched on, so older pages show fewer views than they really had.</p>
    </>
  );
}
