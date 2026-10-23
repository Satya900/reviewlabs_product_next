import Link from "next/link";
import { Badge, EmptyState, buttonClass, cx, inputClass, tableClass } from "@/components/ui";
import { SmallCopyButton } from "@/components/copy-button";
import { formatPaise } from "@/lib/money";
import { PAYMENT_FILTERS, STAGE_BADGE, STAGE_LABEL, followUpLinks, type PaymentFilterKey } from "@/lib/follow-up";
import { PER_PAGE, type PaymentRow } from "@/lib/payments-list";

const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export type BrowserParams = { filter: PaymentFilterKey; q: string; from: string; to: string; page: number; product?: string };

// Payments with follow-up buttons. Filters are plain links and a GET form, so
// every view has its own URL (shareable, back button works).
export function PaymentsBrowser({ basePath, params, rows, total, counts, appUrl, csv, products }: {
  basePath: string;
  params: BrowserParams;
  rows: PaymentRow[];
  total: number;
  counts: Record<PaymentFilterKey, number>;
  appUrl: string;
  csv: { allowed: boolean; href: string };
  products?: { id: string; title: string }[]; // shows a product picker and column (all-products view)
}) {
  const href = (change: Partial<BrowserParams>) => {
    const next = { ...params, page: 1, ...change };
    const qs = new URLSearchParams();
    if (next.filter !== "all") qs.set("filter", next.filter);
    if (next.q) qs.set("q", next.q);
    if (next.from) qs.set("from", next.from);
    if (next.to) qs.set("to", next.to);
    if (next.product) qs.set("product", next.product);
    if (next.page > 1) qs.set("page", String(next.page));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const filtered = Boolean(params.q || params.from || params.to || params.product);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Payment status">
        {PAYMENT_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href({ filter: f.key })}
            role="tab"
            aria-selected={params.filter === f.key}
            className={cx(
              "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition",
              params.filter === f.key ? "bg-ink text-white" : "bg-surface-strong text-body hover:text-ink",
            )}
          >
            {f.label}
            <span className={cx("num rounded-full px-2 py-0.5 text-[12px]", params.filter === f.key ? "bg-white/20" : "bg-canvas")}>{counts[f.key]}</span>
          </Link>
        ))}
      </div>

      <form action={basePath} method="get" className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface-soft p-4">
        {params.filter !== "all" && <input type="hidden" name="filter" value={params.filter} />}
        <label className="block min-w-[220px] flex-1 space-y-1">
          <span className="block text-[13px] font-semibold">Search</span>
          <input name="q" defaultValue={params.q} placeholder="Name, email or phone" className={inputClass} />
        </label>
        {products && (
          <label className="block space-y-1">
            <span className="block text-[13px] font-semibold">Product</span>
            <select name="product" defaultValue={params.product ?? ""} className={cx(inputClass, "max-w-[240px]")}>
              <option value="">All products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        )}
        <label className="block space-y-1">
          <span className="block text-[13px] font-semibold">From</span>
          <input type="date" name="from" defaultValue={params.from} className={inputClass} />
        </label>
        <label className="block space-y-1">
          <span className="block text-[13px] font-semibold">To</span>
          <input type="date" name="to" defaultValue={params.to} className={inputClass} />
        </label>
        <button type="submit" className={cx(buttonClass.primary, "h-12 px-5")}>Apply</button>
        {filtered && <Link href={href({ q: "", from: "", to: "", product: "" })} className="link h-12 content-center text-[14px]">Clear</Link>}
        <span className="basis-full sm:basis-auto sm:ml-auto">
          {csv.allowed ? (
            <a href={csv.href} className={cx(buttonClass.secondary, "h-12 px-5")}>Download CSV</a>
          ) : (
            <Link href="/dashboard/billing" className={cx(buttonClass.secondary, "h-12 px-5")}>Download CSV (Creator)</Link>
          )}
        </span>
      </form>

      {params.filter === "not_completed" && rows.length > 0 && (
        <p className="rounded-2xl bg-accent-yellow/10 p-4 text-[14px] text-body">
          These buyers filled in their details but didn&apos;t pay. A short, friendly message often brings them back. People who paid later or
          tried again aren&apos;t shown here, so you won&apos;t message anyone twice.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState>{filtered || params.filter !== "all" ? "Nothing matches these filters." : "No payments yet. They show up here as soon as someone starts checkout."}</EmptyState>
      ) : (
        <>
          {/* Phones: cards, so the follow-up buttons are always in reach. */}
          <ul className="space-y-3 md:hidden">
            {rows.map((o) => (
              <li key={o.id} className="space-y-3 rounded-2xl border border-hairline bg-canvas p-4">
                <div className="flex items-start justify-between gap-3">
                  <Buyer o={o} />
                  <div className="shrink-0 text-right">
                    <Amount o={o} />
                    <div className="mt-1"><Badge status={STAGE_BADGE[o.stage]} label={STAGE_LABEL[o.stage]} /></div>
                  </div>
                </div>
                <Answers o={o} />
                <p className="text-[12px] text-muted">{products ? `${o.page_title} · ` : ""}{dateFmt.format(new Date(o.created_at))}</p>
                <FollowUp o={o} appUrl={appUrl} />
              </li>
            ))}
          </ul>
          <div className={cx(tableClass.wrap, "hidden md:block")}>
            <table className={`${tableClass.table} min-w-[920px]`}>
              <thead>
                <tr>
                  <th className={tableClass.th}>Date</th>
                  <th className={tableClass.th}>Buyer</th>
                  {products && <th className={tableClass.th}>Product</th>}
                  <th className={tableClass.th}>Amount</th>
                  <th className={tableClass.th}>Status</th>
                  <th className={tableClass.th}>Follow up</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td className={`${tableClass.td} whitespace-nowrap align-top text-body`}>{dateFmt.format(new Date(o.created_at))}</td>
                    <td className={`${tableClass.td} align-top`}>
                      <Buyer o={o} />
                      <div className="mt-2"><Answers o={o} /></div>
                    </td>
                    {products && <td className={`${tableClass.td} align-top`}>{o.page_title}</td>}
                    <td className={`${tableClass.td} whitespace-nowrap align-top`}><Amount o={o} /></td>
                    <td className={`${tableClass.td} whitespace-nowrap align-top`}>
                      <Badge status={STAGE_BADGE[o.stage]} label={STAGE_LABEL[o.stage]} />
                      {o.razorpay_payment_id && <p className="num mt-1.5 text-[11px] text-muted">{o.razorpay_payment_id}</p>}
                    </td>
                    <td className={`${tableClass.td} align-top`}><FollowUp o={o} appUrl={appUrl} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between gap-3 text-[14px]" aria-label="Pages">
          <span className="text-muted">
            {(params.page - 1) * PER_PAGE + 1}–{Math.min(params.page * PER_PAGE, total)} of {total}
          </span>
          <span className="flex gap-2">
            {params.page > 1 && <Link href={href({ page: params.page - 1 })} className={cx(buttonClass.secondary, "h-10 px-4")}>← Newer</Link>}
            {params.page < pages && <Link href={href({ page: params.page + 1 })} className={cx(buttonClass.secondary, "h-10 px-4")}>Older →</Link>}
          </span>
        </nav>
      )}
    </div>
  );
}

function Buyer({ o }: { o: PaymentRow }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold">{o.buyer_name}</p>
      <p className="break-all text-[13px] text-body">{o.buyer_email}</p>
      <p className="num text-[13px] text-body">{o.buyer_phone}</p>
    </div>
  );
}

function Answers({ o }: { o: PaymentRow }) {
  const answers = Object.entries(o.form_responses ?? {});
  if (!answers.length) return null;
  return (
    <dl className="space-y-0.5 rounded-xl bg-surface-soft px-3 py-2 text-[13px]">
      {answers.map(([k, v]) => (
        <div key={k}><dt className="inline text-muted">{k}: </dt><dd className="inline font-medium">{String(v)}</dd></div>
      ))}
    </dl>
  );
}

function Amount({ o }: { o: PaymentRow }) {
  return (
    <>
      <span className="num">{formatPaise(o.amount_paise)}</span>
      {o.coupon_code && <p className="text-[12px] text-muted">{o.coupon_code}, <span className="num">−{formatPaise(o.discount_paise)}</span></p>}
      {o.offer_title && <p className="text-[12px] text-primary">+ {o.offer_title}</p>}
    </>
  );
}

function FollowUp({ o, appUrl }: { o: PaymentRow; appUrl: string }) {
  const links = followUpLinks(o, `${appUrl}/p/${o.page_slug}`);
  return (
    <div className="flex flex-wrap gap-2">
      {links.whatsapp && (
        <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#25D366] px-3 text-[13px] font-semibold text-white">
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.6-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" /></svg>
          WhatsApp
        </a>
      )}
      <a href={links.email} className="inline-flex h-9 items-center rounded-full bg-surface-strong px-3 text-[13px] font-semibold text-ink">Email</a>
      <SmallCopyButton value={o.buyer_phone} label="Copy phone" />
    </div>
  );
}
