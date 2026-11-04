import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { Badge, EmptyState, Notice, PageTitle } from "@/components/ui";
import { AccessButtons } from "./access-buttons";

export const metadata = { title: "AutoDM access" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function AdminAutodmAccess() {
  const db = createAdminClient();
  const { data } = await db.from("autodm_access_requests").select("creator_id, ig_username, facebook, status, created_at, decided_at").order("created_at", { ascending: false }).limit(300);
  const rows = data ?? [];
  const ids = rows.map((r) => r.creator_id);
  const { data: profiles } = ids.length ? await db.from("profiles").select("id, email, name, plan").in("id", ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const fbHref = (v: string) => (/^https?:\/\//.test(v) ? v : v.includes("facebook.com") ? `https://${v}` : null);

  return (
    <>
      <PageTitle sub="Pro creators asking for AutoDM while Meta reviews the app.">AutoDM access</PageTitle>
      {env.autodmOpen() ? (
        <Notice tone="good">AutoDM is open to every Pro creator (AUTODM_OPEN=true). Requests are no longer needed.</Notice>
      ) : (
        <Notice tone="info">
          For each request: Meta App Dashboard → App roles → Roles → Add people → <b>Testers</b>, enter their Facebook account, then click Mark invited here. They get an email with the accept step. After Meta approves the app, set <code>AUTODM_OPEN=true</code> in Vercel.
        </Notice>
      )}
      {!rows.length ? (
        <EmptyState>No requests yet.</EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const p = byId.get(r.creator_id);
            const fb = fbHref(r.facebook);
            return (
              <article key={r.creator_id} className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-hairline bg-canvas p-6">
                <div className="space-y-1 text-[14px]">
                  <p className="flex items-center gap-2 text-[17px] font-semibold">
                    @{r.ig_username}
                    <Badge status={r.status === "pending" ? "pending" : r.status === "invited" ? "live" : "archived"} label={r.status} />
                  </p>
                  <p className="text-body">{p?.name ?? "—"} · <a href={`mailto:${p?.email}`} className="link">{p?.email}</a> · {p?.plan}</p>
                  <p className="text-body">Facebook: {fb ? <a href={fb} target="_blank" rel="noreferrer" className="link">{r.facebook}</a> : r.facebook}</p>
                  <p className="text-muted">Asked {dateFmt.format(new Date(r.created_at))}{r.decided_at && ` · decided ${dateFmt.format(new Date(r.decided_at))}`}</p>
                </div>
                <AccessButtons creatorId={r.creator_id} status={r.status} />
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
