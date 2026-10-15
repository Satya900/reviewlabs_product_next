import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { loadLeadResponses } from "@/lib/lead-responses";
import { PageTitle, buttonClass, inputClass, tableClass, cx } from "@/components/ui";

export const metadata = { title: "Responses" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function ResponsesPage({ params, searchParams }: PageProps<"/dashboard/lead-magnets/[id]/responses">) {
  await requireCreator();
  const { id } = await params;
  const { q } = await searchParams;
  const search = typeof q === "string" ? q : "";
  const data = await loadLeadResponses(id, search);
  if (!data) notFound();
  const { magnet, rows, count, labels } = data;

  return (
    <>
      <Link href="/dashboard/lead-magnets" className="link text-[14px]">← Lead magnets</Link>
      <PageTitle sub={`${count.toLocaleString("en-IN")} ${count === 1 ? "response" : "responses"}${search ? ` matching "${search}"` : ""}`}>{magnet.title}</PageTitle>
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex flex-1 gap-2">
          <input name="q" defaultValue={search} placeholder="Search name, email or phone" className={cx(inputClass, "max-w-sm")} />
          <button className={buttonClass.secondary}>Search</button>
        </form>
        <a href={`/dashboard/lead-magnets/${id}/responses/export`} className={buttonClass.primary}>Export CSV</a>
      </div>
      <div className={cx(tableClass.wrap, "mt-4")}>
        <table className={tableClass.table}>
          <thead>
            <tr>
              <th className={tableClass.th}>Name</th>
              <th className={tableClass.th}>Email</th>
              {magnet.collect_phone && <th className={tableClass.th}>Phone</th>}
              {labels.map((l) => <th key={l} className={tableClass.th}>{l}</th>)}
              <th className={tableClass.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={tableClass.td}>{r.name}</td>
                <td className={tableClass.td}>
                  {r.email}
                  {r.email_verified && <span className="ml-2 rounded-full bg-[#e6f7ef] px-2 py-0.5 text-[11px] font-semibold text-up">Verified</span>}
                </td>
                {magnet.collect_phone && <td className={`${tableClass.td} num`}>{r.phone || "-"}</td>}
                {labels.map((l) => <td key={l} className={`${tableClass.td} max-w-xs whitespace-pre-line`}>{r.answers?.[l] ?? "-"}</td>)}
                <td className={`${tableClass.td} num whitespace-nowrap text-muted`}>{dateFmt.format(new Date(r.created_at))}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={4 + labels.length} className={`${tableClass.td} py-10 text-center text-muted`}>{search ? "No responses match that search." : "No responses yet. Share your link to start collecting leads."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {count > rows.length && <p className="mt-3 text-[13px] text-muted">Showing the latest {rows.length}. Export CSV for all of them.</p>}
    </>
  );
}
