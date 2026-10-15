import Link from "next/link";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { hasCreatorPlan } from "@/lib/plans";
import { buttonClass } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { COVER_PRESETS, type CoverPreset } from "@/lib/lead-magnets";
import { createLeadMagnet } from "./actions";

export const metadata = { title: "Lead magnets" };

const DAYS = 30;
const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

// The last DAYS days (IST), oldest first.
function lastDays() {
  const now = Date.now();
  return Array.from({ length: DAYS }, (_, i) => istDay(new Date(now - (DAYS - 1 - i) * 864e5)));
}

function Spark({ values, tone = "#0052ff" }: { values: number[]; tone?: string }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - (v / max) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      <polygon points={`0,40 ${pts} 100,40`} fill={tone} opacity="0.08" />
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Stat({ label, value, values, hint }: { label: string; value: string; values: number[]; hint?: string }) {
  return (
    <div className="rounded-3xl border border-hairline bg-canvas p-5 shadow-soft">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-muted" title={hint}>{label}</p>
      <div className="mt-3 flex items-end gap-4">
        <p className="num text-[32px] leading-none">{value}</p>
        <div className="min-w-0 flex-1"><Spark values={values} /></div>
      </div>
    </div>
  );
}

export default async function LeadMagnetsPage({ searchParams }: PageProps<"/dashboard/lead-magnets">) {
  const profile = await requireCreator();
  const { tab = "published", error } = await searchParams;
  const supabase = await createClient();
  const days = lastDays();

  const [{ data: magnets }, { data: responses }, { count: total }] = await Promise.all([
    supabase.from("lead_magnets").select("id, slug, title, status, cover_preset, cover_image_url, created_at").neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("lead_responses").select("magnet_id, created_at").eq("creator_id", profile.id).limit(50000),
    supabase.from("lead_responses").select("id", { count: "exact", head: true }).eq("creator_id", profile.id),
  ]);
  const ids = (magnets ?? []).map((m) => m.id);
  const { data: views } = ids.length
    ? await supabase.from("lead_magnet_views_daily").select("magnet_id, day, views").in("magnet_id", ids).gte("day", days[0])
    : { data: [] };

  const respByDay = new Map(days.map((d) => [d, 0]));
  const viewsByDay = new Map(days.map((d) => [d, 0]));
  const perMagnet = new Map<string, number>();
  for (const r of responses ?? []) {
    perMagnet.set(r.magnet_id, (perMagnet.get(r.magnet_id) ?? 0) + 1);
    const d = istDay(new Date(r.created_at));
    if (respByDay.has(d)) respByDay.set(d, respByDay.get(d)! + 1);
  }
  for (const v of views ?? []) if (viewsByDay.has(v.day)) viewsByDay.set(v.day, viewsByDay.get(v.day)! + v.views);

  const respSeries = days.map((d) => respByDay.get(d)!);
  const cumulative = respSeries.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []);
  const last7 = respSeries.slice(-7).reduce((a, b) => a + b, 0);
  const views7 = days.slice(-7).reduce((a, d) => a + viewsByDay.get(d)!, 0);
  const rate = views7 ? Math.min(100, (last7 / views7) * 100) : 0;
  const rateSeries = days.map((d) => { const v = viewsByDay.get(d)!; return v ? respByDay.get(d)! / v : 0; });

  const published = (magnets ?? []).filter((m) => m.status === "live");
  const drafts = (magnets ?? []).filter((m) => m.status === "draft");
  const list = tab === "draft" ? drafts : published;
  const appUrl = env.appUrl();
  const atLimit = !hasCreatorPlan(profile) && (magnets?.length ?? 0) >= 1;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] px-6 pb-24 pt-8 text-center text-white" style={{ background: "radial-gradient(ellipse at 20% 120%, #8fb3ff 0%, transparent 45%), linear-gradient(160deg,#0033cc 0%,#0052ff 45%,#3d7bff 100%)" }}>
        <div className="flex justify-end">
          {atLimit ? (
            <Link href="/dashboard/billing" className="rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold">Upgrade for more</Link>
          ) : (
            <form action={createLeadMagnet}>
              <button className="rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold transition hover:bg-[#282b31]">+ New lead magnet</button>
            </form>
          )}
        </div>
        <h1 className="display mt-4 text-[40px] sm:text-[48px]">Lead magnets</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-white/80">Give away a free guide, checklist or file in exchange for a name and email. Build your list, then sell to it.</p>
      </section>

      <div className="relative z-10 -mt-28 grid gap-4 px-2 sm:px-6 md:grid-cols-3">
        <Stat label="Total responses" value={(total ?? 0).toLocaleString("en-IN")} values={cumulative} hint="All responses across your lead magnets" />
        <Stat label="Responses in last 7 days" value={last7.toLocaleString("en-IN")} values={respSeries} />
        <Stat label="Conversion rate, last 7 days" value={`${rate.toFixed(rate && rate < 10 ? 1 : 0)}%`} values={rateSeries} hint="Responses divided by page views" />
      </div>

      {error && (
        <p className="rounded-2xl bg-[#fff1f1] px-4 py-3 text-[14px] text-down">
          {error === "limit" ? <>The Free plan includes one lead magnet. <Link href="/dashboard/billing" className="link">Upgrade to Creator</Link> for unlimited.</> : "Couldn't create a lead magnet. Please try again."}
        </p>
      )}

      <div className="flex gap-2">
        <Link href="/dashboard/lead-magnets?tab=published" className={tab !== "draft" ? buttonClass.dark : buttonClass.secondary}>Published ({published.length})</Link>
        <Link href="/dashboard/lead-magnets?tab=draft" className={tab === "draft" ? buttonClass.dark : buttonClass.secondary}>Draft ({drafts.length})</Link>
      </div>

      {list.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-3xl border border-hairline bg-canvas">
              <Link href={`/dashboard/lead-magnets/${m.id}`} className="block">
                {m.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.cover_image_url} alt="" className="aspect-[2/1] w-full object-cover" />
                ) : (
                  <div className="aspect-[2/1] w-full" style={{ background: COVER_PRESETS[m.cover_preset as CoverPreset] }} />
                )}
              </Link>
              <div className="space-y-3 p-5">
                <div>
                  <Link href={`/dashboard/lead-magnets/${m.id}`} className="text-[17px] font-semibold leading-snug hover:text-primary">{m.title}</Link>
                  <p className="num mt-1 text-[13px] text-muted">{(perMagnet.get(m.id) ?? 0).toLocaleString("en-IN")} {perMagnet.get(m.id) === 1 ? "response" : "responses"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/lead-magnets/${m.id}/responses`} className={buttonClass.secondary}>Responses</Link>
                  <Link href={`/dashboard/lead-magnets/${m.id}`} className={buttonClass.secondary}>Edit</Link>
                  {m.status === "live" && <CopyButton value={`${appUrl}/l/${m.slug}`} label="Copy link" />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-3xl border border-dashed border-hairline p-10 text-center">
          <p className="text-[17px] font-semibold">{tab === "draft" ? "No drafts" : "No published lead magnets yet"}</p>
          <p className="mx-auto mt-1 max-w-sm text-[14px] text-muted">Offer something useful for free, like a checklist, a template or a mini guide. Share the link in your bio, ads or posts.</p>
          {!atLimit && (
            <form action={createLeadMagnet} className="mt-5">
              <button className={buttonClass.dark}>+ New lead magnet</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
