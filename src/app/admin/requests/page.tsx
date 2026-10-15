import { createAdminClient } from "@/lib/supabase/admin";
import { Badge, EmptyState, PageTitle } from "@/components/ui";
import { RequestStatus } from "./request-status";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

type Row = { id: string; name: string; email: string; phone: string; business: string; website: string; monthly_volume: string; requirements: string; status: string; created_at: string };

export default async function AdminRequests() {
  const { data } = await createAdminClient().from("custom_requests").select("*").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as Row[];
  return (
    <>
      <PageTitle sub="Custom plan requests from the /custom page. Each one is also emailed to you.">Requests</PageTitle>
      {!rows.length ? (
        <EmptyState>No requests yet.</EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <article key={r.id} className="rounded-3xl border border-hairline bg-canvas p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-[17px] font-semibold">
                    {r.name}
                    <Badge status={r.status === "new" ? "pending" : r.status === "contacted" ? "live" : "archived"} label={r.status} />
                  </p>
                  <p className="text-[14px] text-body">
                    <a href={`mailto:${r.email}`} className="link">{r.email}</a>
                    {r.phone && <> · <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a></>}
                  </p>
                </div>
                <p className="text-[13px] text-muted">{dateFmt.format(new Date(r.created_at))}</p>
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-body">
                {r.business && <div><dt className="inline text-muted">Business: </dt><dd className="inline">{r.business}</dd></div>}
                {r.website && <div><dt className="inline text-muted">Link: </dt><dd className="inline break-all">{r.website}</dd></div>}
                {r.monthly_volume && <div><dt className="inline text-muted">Monthly sales: </dt><dd className="inline">{r.monthly_volume}</dd></div>}
              </dl>
              <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-surface-soft p-4 text-[14px]">{r.requirements}</p>
              <div className="mt-3"><RequestStatus id={r.id} status={r.status} /></div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
