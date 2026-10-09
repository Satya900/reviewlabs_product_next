import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPage } from "@/lib/public-page";
import { formatPaise } from "@/lib/money";
import { MetaPixel } from "@/components/meta-pixel";
import { PageViewBeacon } from "@/components/page-view-beacon";
import { CheckoutForm } from "./checkout-form";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicPage(slug);
  if (!data) return { title: "Not found" };
  return {
    title: data.page.title,
    description: data.page.description.slice(0, 160),
    openGraph: data.page.cover_image_url ? { images: [data.page.cover_image_url] } : undefined,
  };
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function PublicPaymentPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const data = await getPublicPage(slug);
  if (!data) notFound();
  const { page, fields, files, pixelId } = data;

  return (
    <div className="mx-auto grid max-w-[1100px] gap-8 lg:grid-cols-[1fr_400px]">
      <PageViewBeacon pageId={page.id} />
      <MetaPixel
        pixelId={pixelId}
        pageId={page.id}
        content={{ name: page.title, value: page.amount_paise / 100, currency: page.currency }}
      />
      <section className="space-y-6">
        {page.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.cover_image_url} alt="" className="aspect-[16/10] w-full rounded-3xl object-cover" />
        ) : (
          <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0052ff_0%,#3d7bff_55%,#7aa5ff_100%)]">
            <div className="absolute bottom-8 left-8 h-40 w-28 rotate-[-6deg] rounded-xl bg-white/95 p-3 shadow-float">
              <div className="h-2 w-14 rounded-full bg-primary" />
              <div className="mt-3 h-1.5 w-16 rounded-full bg-hairline" />
              <div className="mt-1.5 h-1.5 w-12 rounded-full bg-hairline" />
            </div>
          </div>
        )}
        <div className="rounded-3xl bg-canvas p-6 sm:p-8">
          <div className="flex flex-wrap gap-2">
            {["Instant download", "Lifetime access"].map((t) => (
              <span key={t} className="rounded-full bg-primary-soft px-3 py-1 text-[12px] font-semibold text-primary">{t}</span>
            ))}
          </div>
          <h1 className="display mt-4 text-[34px] sm:text-[44px]">{page.title}</h1>
          <p className="num mt-3 text-[28px]">{formatPaise(page.amount_paise)}</p>
          {page.description && <div className="mt-6 whitespace-pre-wrap text-[16px] leading-relaxed text-body">{page.description}</div>}
        </div>
        {files.length > 0 && (
          <div className="rounded-3xl bg-canvas p-6 sm:p-8">
            <h2 className="text-[18px] font-semibold">What you get</h2>
            <ul className="mt-4 divide-y divide-hairline-soft">
              {files.map((f) => (
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
            </ul>
          </div>
        )}
      </section>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <CheckoutForm
          page={{ id: page.id, slug: page.slug, title: page.title, amountPaise: page.amount_paise, currency: page.currency, buttonLabel: page.button_label }}
          fields={fields.map((f) => ({ id: f.id, label: f.label, type: f.field_type, required: f.required, options: f.options }))}
          pixelId={pixelId}
        />
        <p className="mt-4 text-center text-[13px] text-muted">Payments secured by Razorpay · UPI, cards, netbanking</p>
      </aside>
    </div>
  );
}
