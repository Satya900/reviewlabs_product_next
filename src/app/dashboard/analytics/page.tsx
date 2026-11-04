import Link from "next/link";
import { requirePlan } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/money";
import { PageTitle, Stat, buttonClass, tableClass } from "@/components/ui";
import { DayBars } from "@/components/day-bars";
import { hasProPlan } from "@/lib/plans";
import { SOURCE_LABELS, SOURCES, type Source } from "@/lib/traffic-source";
import { UpgradeCard } from "@/components/upgrade-card";

const ranges = [7, 30, 90] as const;
const istDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

// Days (YYYY-MM-DD, IST) from `days - 1` days ago up to today.
function dayRange(days: number): string[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) => istDay.format(new Date(now - (days - 1 - i) * 86_400_000)));
}

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "n/a");

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const profile = await requirePlan();
  // Creator: totals and daily charts for 7 or 30 days. Pro adds 90 days,
  // per-page conversion, the checkout funnel and traffic sources.
  const pro = hasProPlan(profile);
  const { range } = await searchParams;
  const allowed = pro ? ranges : ranges.filter((r) => r !== 90);
  const days = allowed.find((r) => String(r) === range) ?? 30;
  const dayKeys = dayRange(days);
  const fromDay = dayKeys[0];
  const fromIso = `${fromDay}T00:00:00+05:30`;

  const supabase = await createClient();
  const [{ data: pages }, { data: views }, { data: orders }, { data: sourceViews }] = await Promise.all([
    supabase.from("payment_pages").select("id, title, slug, status").eq("creator_id", profile.id).order("created_at"),
    supabase.from("page_views_daily").select("page_id, day, views").gte("day", fromDay),
    supabase.from("orders").select("page_id, status, amount_paise, created_at, paid_at, offer_id, source:tracking->>source").eq("creator_id", profile.id).gte("created_at", fromIso),
    pro ? supabase.from("page_view_sources").select("source, views").gte("day", fromDay) : Promise.resolve({ data: [] as { source: string; views: number }[] }),
  ]);

  const paidStatuses = new Set(["paid", "partially_refunded"]);
  const perPage = new Map((pages ?? []).map((p) => [p.id, { ...p, views: 0, checkouts: 0, sales: 0, revenue: 0, withOffer: 0 }]));
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
      if (o.offer_id) row.withOffer += 1;
      const d = istDay.format(new Date(o.paid_at ?? o.created_at));
      if (salesByDay.has(d)) salesByDay.set(d, (salesByDay.get(d) ?? 0) + o.amount_paise);
    }
  }

  // Traffic sources: views from page_view_sources, sales from each order's first-touch source.
  const bySource = new Map<Source, { views: number; sales: number; revenue: number }>();
  const src = (s: string | null | undefined): Source => ((SOURCES as readonly string[]).includes(s ?? "") ? (s as Source) : "direct");
  for (const v of sourceViews ?? []) {
    const r = bySource.get(src(v.source)) ?? { views: 0, sales: 0, revenue: 0 };
    r.views += v.views;
    bySource.set(src(v.source), r);
  }
  for (const o of orders ?? []) {
    if (!paidStatuses.has(o.status)) continue;
    const key = src(o.source as string | null);
    const r = bySource.get(key) ?? { views: 0, sales: 0, revenue: 0 };
    r.sales += 1;
    r.revenue += o.amount_paise;
    bySource.set(key, r);
  }
  const sourceRows = [...bySource.entries()].sort((a, b) => b[1].revenue - a[1].revenue || b[1].views - a[1].views);

  const rows = [...perPage.values()].filter((r) => r.status !== "archived" || r.views || r.checkouts);
  const totals = rows.reduce((t, r) => ({ views: t.views + r.views, checkouts: t.checkouts + r.checkouts, sales: t.sales + r.sales, revenue: t.revenue + r.revenue }), { views: 0, checkouts: 0, sales: 0, revenue: 0 });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle sub="Views count one visit per browser session. Checkouts are buyers who clicked pay. Sales are confirmed payments.">Analytics</PageTitle>
        <div className="flex gap-2">
          {allowed.map((r) => (
            <Link key={r} href={`/dashboard/analytics?range=${r}`} className={r === days ? buttonClass.primary : buttonClass.secondary}>
              {r} days
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Page views" value={totals.views.toLocaleString("en-IN")} />
        <Stat label="Checkouts started" value={totals.checkouts.toLocaleString("en-IN")} sub={pro ? `${pct(totals.checkouts, totals.views)} of views` : undefined} />
        <Stat label="Sales" value={totals.sales.toLocaleString("en-IN")} sub={pro ? `${pct(totals.sales, totals.views)} of views` : undefined} />
        <Stat label="Revenue" value={formatPaise(totals.revenue)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DayBars title="Page views per day" points={dayKeys.map((d) => ({ day: d, value: viewsByDay.get(d) ?? 0 }))} format={(n) => n.toLocaleString("en-IN")} />
        <DayBars title="Sales per day" points={dayKeys.map((d) => ({ day: d, value: salesByDay.get(d) ?? 0 }))} format={formatPaise} />
      </div>

      {pro ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="rounded-3xl border border-hairline bg-canvas p-6">
              <p className="text-[16px] font-semibold">Checkout funnel</p>
              <p className="mt-1 text-[13px] text-muted">Where buyers drop off, all pages.</p>
              <div className="mt-5 space-y-4">
                {[
                  { label: "Viewed a page", value: totals.views, of: totals.views },
                  { label: "Started checkout", value: totals.checkouts, of: totals.views },
                  { label: "Paid", value: totals.sales, of: totals.views },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-[14px]"><span>{s.label}</span><span className="num">{s.value.toLocaleString("en-IN")} · {pct(s.value, s.of)}</span></div>
                    <div className="mt-1.5 h-2.5 rounded-full bg-surface-strong"><div className="h-2.5 rounded-full bg-primary" style={{ width: s.of ? `${Math.max(2, (s.value / s.of) * 100)}%` : "0%" }} /></div>
                  </div>
                ))}
                <p className="text-[13px] text-body">{totals.checkouts > 0 ? `${pct(totals.checkouts - totals.sales, totals.checkouts)} of checkouts were not completed. Follow them up from each page's Payments tab.` : "No checkouts in this period yet."}</p>
              </div>
            </div>
            <div className={tableClass.wrap}>
              <table className={tableClass.table}>
                <thead>
                  <tr>
                    <th className={tableClass.th}>Traffic source</th>
                    <th className={`${tableClass.th} text-right`}>Views</th>
                    <th className={`${tableClass.th} text-right`}>Sales</th>
                    <th className={`${tableClass.th} text-right`}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map(([key, r]) => (
                    <tr key={key}>
                      <td className={tableClass.td}>{SOURCE_LABELS[key]}</td>
                      <td className={`${tableClass.td} text-right`}>{r.views.toLocaleString("en-IN")}</td>
                      <td className={`${tableClass.td} text-right`}>{r.sales.toLocaleString("en-IN")}</td>
                      <td className={`${tableClass.td} text-right font-bold`}>{formatPaise(r.revenue)}</td>
                    </tr>
                  ))}
                  {!sourceRows.length && <tr><td colSpan={4} className={`${tableClass.td} text-center`}>No visits with a known source yet. Sources are counted from today.</td></tr>}
                </tbody>
              </table>
            </div>
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
                <th className={`${tableClass.th} text-right`}>Add-on taken</th>
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
                  <td className={`${tableClass.td} text-right`}>{r.withOffer ? pct(r.withOffer, r.sales) : "-"}</td>
                  <td className={`${tableClass.td} text-right font-bold`}>{formatPaise(r.revenue)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} className={`${tableClass.td} text-center`}>No pages yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <UpgradeCard feature="analytics" compact />
      )}
      <p className="text-[12px]">Views are counted from when analytics was switched on, so older pages show fewer views than they really had.</p>
    </>
  );
}
