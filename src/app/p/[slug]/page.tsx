import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPage } from "@/lib/public-page";
import { MetaPixel } from "@/components/meta-pixel";
import { PageViewBeacon } from "@/components/page-view-beacon";
import { CheckoutForm } from "./checkout-form";
import { ProductView } from "@/components/product-view";
import { faqJsonLd } from "@/lib/faq";
import { sanitizeDescription } from "@/lib/rich-text";

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

export default async function PublicPaymentPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const data = await getPublicPage(slug);
  if (!data) notFound();
  const { page, fields, files, pixelId, testimonials, faqs, offer, sellerName } = data;

  return (
    <>
      <PageViewBeacon pageId={page.id} />
      {faqs.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd(faqs) }} />}
      <MetaPixel
        pixelId={pixelId}
        pageId={page.id}
        content={{ name: page.title, value: page.amount_paise / 100, currency: page.currency }}
      />
      <ProductView
        buttonLabel={page.button_label || "Get it now"}
        data={{
          title: page.title,
          amountPaise: page.amount_paise,
          coverImageUrl: page.cover_image_url,
          // Sanitised again on display, in case anything slipped in another way.
          descriptionHtml: sanitizeDescription(page.description_html ?? ""),
          descriptionText: page.description,
          files,
          testimonials,
          faqs,
          policies: { sellerName, supportEmail: page.support_email, refundPolicy: page.refund_policy, terms: page.terms },
        }}
        checkout={
          <CheckoutForm
            page={{ id: page.id, slug: page.slug, title: page.title, amountPaise: page.amount_paise, currency: page.currency, buttonLabel: page.button_label }}
            fields={fields.map((f) => ({ id: f.id, label: f.label, type: f.field_type, required: f.required, options: f.options }))}
            pixelId={pixelId}
            sellerName={sellerName}
            offer={offer ? { id: offer.id, headline: offer.headline, title: offer.title, description: offer.description, imageUrl: offer.image_url, pricePaise: offer.price_paise, compareAtPaise: offer.compare_at_paise } : null}
          />
        }
      />
    </>
  );
}
