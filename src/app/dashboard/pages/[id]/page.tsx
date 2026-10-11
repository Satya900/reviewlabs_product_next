import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { paiseToRupeesString } from "@/lib/money";
import { Badge, Notice, Panel, buttonClass } from "@/components/ui";
import type { Faq, Offer, OfferFile, PageField, PageFile, PaymentPage, Testimonial } from "@/lib/types";
import { PageDetailsForm } from "./page-details-form";
import { FieldsEditor } from "./fields-editor";
import { FilesManager } from "./files-manager";
import { DeletePageButton } from "./delete-page-button";
import { TrackingPanel } from "./tracking-panel";
import { TestimonialsPanel } from "./testimonials-panel";
import { FaqsPanel } from "./faqs-panel";
import { OfferPanel } from "./offer-panel";
import { hasCreatorPlan } from "@/lib/plans";
import { UpgradeCard } from "@/components/upgrade-card";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function EditPage({ params }: PageProps<"/dashboard/pages/[id]">) {
  const { id } = await params;
  const profile = await requireCreator();
  const supabase = await createClient();

  const { data: page } = await supabase.from("payment_pages").select("*").eq("id", id).eq("creator_id", profile.id).maybeSingle<PaymentPage>();
  if (!page) notFound();
  const admin = createAdminClient();
  const [{ data: fields }, { data: files }, { data: ownPixel }, { data: accountPixel }, { data: testimonials }, { data: faqs }, { data: offer }] = await Promise.all([
    supabase.from("page_fields").select("*").eq("page_id", id).order("position"),
    supabase.from("page_files").select("*").eq("page_id", id).order("created_at"),
    // Tokens are never selected here; only whether tracking is set up.
    admin.from("page_pixel_settings").select("pixel_id, test_event_code").eq("page_id", id).maybeSingle(),
    admin.from("creator_pixel_settings").select("pixel_id, capi_token_encrypted").eq("creator_id", profile.id).maybeSingle(),
    supabase.from("page_testimonials").select("*").eq("page_id", id).order("position").order("created_at"),
    supabase.from("page_faqs").select("*").eq("page_id", id).order("position").order("created_at"),
    supabase.from("page_offers").select("*").eq("page_id", id).maybeSingle<Offer>(),
  ]);
  const { data: offerFiles } = offer
    ? await supabase.from("offer_files").select("*").eq("offer_id", offer.id).order("created_at")
    : { data: [] as OfferFile[] };
  const accountPixelId = accountPixel?.pixel_id && accountPixel.capi_token_encrypted ? accountPixel.pixel_id : null;
  const publicUrl = `${env.appUrl()}/p/${page.slug}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link href="/dashboard/pages" className="link text-[14px]">← Back to pages</Link>
          <h1 className="display flex flex-wrap items-center gap-3 text-[32px]">{page.title} <Badge status={page.status} /></h1>
        </div>
        {page.status === "live" && (
          <a href={publicUrl} target="_blank" className={buttonClass.secondary}>View live page</a>
        )}
      </div>
      {page.status === "live" && (
        <Notice tone="good">
          Share this link: <span className="num select-all break-all">{publicUrl}</span>
        </Notice>
      )}

      <PageDetailsForm
        creatorId={profile.id}
        appUrl={env.appUrl()}
        page={{ ...page, price: paiseToRupeesString(page.amount_paise) }}
        files={((files ?? []) as PageFile[]).map((f) => ({ file_name: f.file_name, size_bytes: f.size_bytes }))}
        fields={(fields ?? []) as PageField[]}
        testimonials={(testimonials ?? []) as Testimonial[]}
        faqs={(faqs ?? []) as Faq[]}
        offer={offer && offer.active && hasCreatorPlan(profile) ? offer : null}
      >
        <Panel title="Files buyers receive">
          <p className="mb-3 text-[13px]">Sent by email and shown on the thank-you page after payment.</p>
          <FilesManager creatorId={profile.id} pageId={page.id} files={(files ?? []) as PageFile[]} />
        </Panel>
        <Panel title="Additional offer">
          {hasCreatorPlan(profile) ? (
            <OfferPanel creatorId={profile.id} pageId={page.id} offer={offer ?? null} files={(offerFiles ?? []) as OfferFile[]} />
          ) : (
            <UpgradeCard feature="offer" compact />
          )}
        </Panel>
        <Panel title="Testimonials">
          <p className="mb-3 text-[13px]">Shown on your page under the description. Add real feedback from buyers.</p>
          <TestimonialsPanel pageId={page.id} creatorId={profile.id} items={(testimonials ?? []) as Testimonial[]} />
        </Panel>
        <Panel title="FAQ">
          <p className="mb-3 text-[13px]">Answer common questions before buyers have to ask. Shown on this page only.</p>
          <FaqsPanel pageId={page.id} items={(faqs ?? []) as Faq[]} />
        </Panel>
        <Panel title="Checkout questions">
          <p className="mb-3 text-[13px]">Name, email and phone are always asked.</p>
          <FieldsEditor pageId={page.id} fields={(fields ?? []) as PageField[]} />
        </Panel>
        <Panel title="Meta tracking">
          {hasCreatorPlan(profile) ? (
            <TrackingPanel
              pageId={page.id}
              own={ownPixel ? { pixelId: ownPixel.pixel_id, testEventCode: ownPixel.test_event_code ?? "" } : null}
              accountPixelId={accountPixelId}
            />
          ) : (
            <UpgradeCard feature="meta" compact />
          )}
        </Panel>
        <Panel title="Delete page">
          <DeletePageButton pageId={page.id} />
        </Panel>
      </PageDetailsForm>
    </>
  );
}
