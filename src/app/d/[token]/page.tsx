import { createAdminClient } from "@/lib/supabase/admin";
import { Notice, buttonClass } from "@/components/ui";
import { ResendForm } from "./resend-form";

export const metadata = { title: "Your downloads", robots: { index: false } };

const errors: Record<string, string> = {
  expired: "This link has reached its download limit or is no longer active. Request a fresh link below.",
  invalid: "That download link is invalid.",
  unavailable: "That file is temporarily unavailable. Please try again in a minute.",
};

export default async function DownloadPage({ params, searchParams }: PageProps<"/d/[token]">) {
  const { token } = await params;
  const { error } = await searchParams;
  const admin = createAdminClient();

  const { data: grant } = /^[0-9a-f]{48}$/.test(token)
    ? await admin
        .from("download_grants")
        .select("expires_at, max_downloads, download_count, orders(page_id, page_title, status)")
        .eq("token", token)
        .maybeSingle()
    : { data: null };

  const order = grant ? (Array.isArray(grant.orders) ? grant.orders[0] : grant.orders) : null;
  const active =
    grant &&
    order &&
    ["paid", "partially_refunded"].includes(order.status) &&
    (grant.expires_at === null || new Date(grant.expires_at) > new Date()) &&
    grant.download_count < grant.max_downloads;

  const { data: files } = active
    ? await admin.from("page_files").select("id, file_name, size_bytes").eq("page_id", order!.page_id).order("created_at")
    : { data: null };

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      {typeof error === "string" && errors[error] && <Notice tone="warn">{errors[error]}</Notice>}
      {active ? (
        <section className="overflow-hidden rounded-3xl bg-canvas shadow-soft ring-1 ring-hairline">
          <div className="bg-dark px-8 py-8 text-white">
            <p className="text-[13px] text-on-dark-soft">Your purchase</p>
            <h1 className="display mt-1 text-[30px]">{order!.page_title}</h1>
            <p className="mt-3 inline-flex rounded-full bg-dark-elevated px-3 py-1 text-[12px] font-semibold text-on-dark-soft">
              {grant!.expires_at
                ? `Link valid until ${new Date(grant!.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                : "Lifetime access"}
            </p>
          </div>
          <ul className="divide-y divide-hairline-soft px-4">
            {(files ?? []).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 px-4 py-4">
                <span className="min-w-0 break-all text-[15px] font-medium">{f.file_name}</span>
                <a href={`/api/download/${token}/${f.id}`} className={`${buttonClass.primary} h-10 shrink-0 text-[14px]`}>Download</a>
              </li>
            ))}
          </ul>
          {!files?.length && <p className="px-8 py-6 text-[15px] text-body">The creator hasn&apos;t attached files to this product yet.</p>}
          <p className="border-t border-hairline-soft px-8 py-4 text-[13px] text-muted">Bookmark this page or keep your receipt email to come back later.</p>
        </section>
      ) : (
        <section className="rounded-3xl bg-canvas p-8 shadow-soft ring-1 ring-hairline">
          <h1 className="display text-[30px]">This link isn&apos;t active</h1>
          <p className="mt-3 text-[16px] text-body">
            It has reached its download limit, or the order was refunded. If you bought this product, request a fresh link below.
          </p>
        </section>
      )}
      <section className="rounded-3xl bg-canvas p-8 ring-1 ring-hairline">
        <h2 className="text-[18px] font-semibold">Lost your link?</h2>
        <p className="mt-1 text-[15px] text-body">Enter the email you used at checkout and we&apos;ll send links for all your purchases.</p>
        <div className="mt-5"><ResendForm /></div>
      </section>
    </div>
  );
}
