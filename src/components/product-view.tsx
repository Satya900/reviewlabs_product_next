import type { ReactNode } from "react";
import { formatPaise } from "@/lib/money";
import { TestimonialsGrid, type TestimonialCard } from "@/components/testimonials-grid";
import { FaqAccordion, type FaqItem } from "@/components/faq-accordion";
import { PagePolicies } from "@/components/page-policies";
import { ProductCheckout } from "@/components/product-checkout";

export type ProductViewData = {
  title: string;
  amountPaise: number;
  compareAtPaise?: number | null;
  coverImageUrl: string | null;
  // Already sanitised HTML. Falls back to plain text for old pages.
  descriptionHtml: string;
  descriptionText: string;
  files: { file_name: string; size_bytes: number }[];
  linkLabels?: string[];
  testimonials?: TestimonialCard[];
  faqs?: FaqItem[];
  policies?: { sellerName: string; supportEmail: string | null; refundPolicy: string; terms: string };
};

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// The buyer-facing product layout, shared by the live page and the editor's
// preview so they always match. It responds to its container's width (not the
// window), which is what lets the preview show a true phone or desktop layout.
export function ProductView({ data, checkout, buttonLabel, preview }: { data: ProductViewData; checkout: ReactNode; buttonLabel: string; preview?: boolean }) {
  return (
    <div className="@container">
      <div className="mx-auto grid max-w-[1100px] gap-8 @3xl:grid-cols-[1fr_400px]">
        <section className="min-w-0 space-y-6">
          {data.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.coverImageUrl} alt="" className="aspect-[16/10] w-full rounded-3xl object-cover" />
          ) : (
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0052ff_0%,#3d7bff_55%,#7aa5ff_100%)]">
              <div className="absolute bottom-8 left-8 h-40 w-28 rotate-[-6deg] rounded-xl bg-white/95 p-3 shadow-float">
                <div className="h-2 w-14 rounded-full bg-primary" />
                <div className="mt-3 h-1.5 w-16 rounded-full bg-hairline" />
                <div className="mt-1.5 h-1.5 w-12 rounded-full bg-hairline" />
              </div>
            </div>
          )}
          <div className="rounded-3xl bg-canvas p-6 @lg:p-8">
            <div className="flex flex-wrap gap-2">
              {["Instant download", "Lifetime access"].map((t) => (
                <span key={t} className="rounded-full bg-primary-soft px-3 py-1 text-[12px] font-semibold text-primary">{t}</span>
              ))}
            </div>
            <h1 className="display mt-4 text-[34px] @lg:text-[44px]">{data.title || "Untitled product"}</h1>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
              <span className="num text-[28px]">{formatPaise(data.amountPaise)}</span>
              {data.compareAtPaise && data.compareAtPaise > data.amountPaise && (
                <>
                  <s className="num text-[18px] text-muted">{formatPaise(data.compareAtPaise)}</s>
                  <span className="rounded-full bg-up/15 px-2.5 py-0.5 text-[13px] font-semibold text-up">
                    {Math.round((1 - data.amountPaise / data.compareAtPaise) * 100)}% off
                  </span>
                </>
              )}
            </p>
            {data.descriptionHtml ? (
              <div className="rich-text mt-6" dangerouslySetInnerHTML={{ __html: data.descriptionHtml }} />
            ) : data.descriptionText ? (
              <div className="mt-6 whitespace-pre-wrap text-[16px] leading-relaxed text-body">{data.descriptionText}</div>
            ) : null}
          </div>
          {(data.files.length > 0 || (data.linkLabels ?? []).length > 0) && (
            <div className="rounded-3xl bg-canvas p-6 @lg:p-8">
              <h2 className="text-[18px] font-semibold">What you get</h2>
              <ul className="mt-4 divide-y divide-hairline-soft">
                {data.files.map((f) => (
                  <li key={f.file_name} className="flex items-center justify-between gap-4 py-3 text-[15px]">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                        <svg viewBox="0 0 24 24" className="size-4 text-primary" aria-hidden><path d="M6 2h8l5 5v15H6z M14 2v5h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                      </span>
                      <span className="truncate">{f.file_name}</span>
                    </span>
                    <span className="num shrink-0 text-[13px] text-muted">{formatSize(f.size_bytes)}</span>
                  </li>
                ))}
                {(data.linkLabels ?? []).map((label, i) => (
                  <li key={`link-${i}`} className="flex items-center justify-between gap-4 py-3 text-[15px]">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                        <svg viewBox="0 0 24 24" className="size-4 text-primary" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                      </span>
                      <span className="truncate">{label}</span>
                    </span>
                    <span className="shrink-0 text-[13px] text-muted">Link</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <TestimonialsGrid items={data.testimonials ?? []} />
          <FaqAccordion items={data.faqs ?? []} />
          {data.policies && <PagePolicies {...data.policies} />}
          {/* Room for the pinned buy bar in the editor's phone preview (live pages get it from BuyerShell). */}
          {preview && <div className="h-32 @3xl:hidden" aria-hidden />}
        </section>
        <aside className="@3xl:sticky @3xl:top-6 @3xl:self-start">
          <ProductCheckout
            priceLabel={formatPaise(data.amountPaise)}
            compareLabel={data.compareAtPaise && data.compareAtPaise > data.amountPaise ? formatPaise(data.compareAtPaise) : null}
            buttonLabel={buttonLabel} preview={preview}>
            {checkout}
          </ProductCheckout>
        </aside>
      </div>
    </div>
  );
}
