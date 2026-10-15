"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { updatePage, type ActionState } from "../../actions";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, FormMessage, Panel, inputClass, textareaClass, cx } from "@/components/ui";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ProductView } from "@/components/product-view";
import { CheckoutForm } from "@/app/p/[slug]/checkout-form";
import { rupeesToPaise } from "@/lib/money";
import { sanitizeDescription } from "@/lib/rich-text";
import type { Faq, Offer, PageField, PaymentPage, Testimonial } from "@/lib/types";
import { PreviewFrame } from "./preview-frame";

type Props = {
  creatorId: string;
  appUrl: string;
  page: PaymentPage & { price: string };
  files: { file_name: string; size_bytes: number }[];
  fields: PageField[];
  testimonials: Testimonial[];
  faqs: Faq[];
  offer: Offer | null;
  // The other editor panels (files, questions, tracking, delete).
  children: ReactNode;
};

type Draft = {
  title: string;
  slug: string;
  price: string;
  is_free: boolean;
  description_html: string;
  cover_image_url: string;
  button_label: string;
  thank_you_message: string;
  status: PaymentPage["status"];
};

function draftFrom(page: Props["page"]): Draft {
  return {
    title: page.title,
    slug: page.slug,
    price: page.is_free ? "" : page.price,
    is_free: page.is_free,
    description_html: page.description_html ?? "",
    cover_image_url: page.cover_image_url ?? "",
    button_label: page.button_label,
    thank_you_message: page.thank_you_message,
    status: page.status,
  };
}

export function PageDetailsForm({ creatorId, appUrl, page, files, fields, testimonials, faqs, offer, children }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(page));
  const [saved, setSaved] = useState<string>(() => JSON.stringify(draftFrom(page)));
  // The draft as it was when Save was clicked; becomes the baseline if the save succeeds.
  const submitted = useRef("");
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await updatePage(prev, formData);
    if (result?.ok) setSaved(submitted.current);
    return result;
  }, null);
  const [uploading, setUploading] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);

  const dirty = JSON.stringify(draft) !== saved;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function onCoverChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${creatorId}/${page.id}-${Date.now()}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("page-covers").upload(path, file, { contentType: file.type });
    if (error) setUploadError(error.message);
    else set("cover_image_url", supabase.storage.from("page-covers").getPublicUrl(path).data.publicUrl);
    setUploading(false);
  }

  const amountPaise = draft.is_free ? 0 : rupeesToPaise(draft.price) ?? 0;
  const previewHtml = useMemo(() => sanitizeDescription(draft.description_html), [draft.description_html]);
  const previewUrl = `${appUrl.replace(/^https?:\/\//, "")}/p/${draft.slug || "your-link"}`;

  const preview = (
    <PreviewFrame url={previewUrl}>
      <ProductView
        data={{ title: draft.title, amountPaise, coverImageUrl: draft.cover_image_url || null, descriptionHtml: previewHtml, descriptionText: "", files, testimonials, faqs,
          policies: { sellerName: "You", supportEmail: page.support_email, refundPolicy: page.refund_policy ?? "", terms: page.terms ?? "" } }}
        checkout={
          <CheckoutForm
            preview
            page={{ id: page.id, slug: draft.slug, title: draft.title, amountPaise, currency: "INR", buttonLabel: draft.button_label || "Buy now", isFree: draft.is_free }}
            fields={fields.map((f) => ({ id: f.id, label: f.label, type: f.field_type, required: f.required, options: f.options }))}
            pixelId={null}
            offer={offer ? { id: offer.id, headline: offer.headline, title: offer.title, description: offer.description, imageUrl: offer.image_url, pricePaise: offer.price_paise, compareAtPaise: offer.compare_at_paise } : null}
          />
        }
      />
    </PreviewFrame>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <Panel
          title="Page details"
          aside={dirty ? <span className="rounded-full bg-[#fff7e0] px-3 py-1 text-[12px] font-semibold text-ink">Unsaved changes</span> : undefined}
        >
          <form action={action} onSubmit={() => { submitted.current = JSON.stringify(draft); }} className="space-y-5">
            <input type="hidden" name="id" value={page.id} />
            <input type="hidden" name="cover_image_url" value={draft.cover_image_url} />
            <input type="hidden" name="description_html" value={draft.description_html} />
            <Field label="Title">
              <input name="title" value={draft.title} onChange={(e) => set("title", e.target.value)} required className={inputClass} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="block text-[14px] font-semibold">Price</span>
                <div className="flex rounded-full bg-surface-strong p-1" role="radiogroup" aria-label="Pricing">
                  {([false, true] as const).map((free) => (
                    <button
                      key={String(free)}
                      type="button"
                      role="radio"
                      aria-checked={draft.is_free === free}
                      onClick={() => set("is_free", free)}
                      className={cx("flex-1 rounded-full px-3 py-1.5 text-[13px] font-semibold", draft.is_free === free ? "bg-canvas shadow-soft" : "text-body")}
                    >
                      {free ? "Free (lead magnet)" : "Paid"}
                    </button>
                  ))}
                </div>
                {draft.is_free && <input type="hidden" name="is_free" value="on" />}
                {draft.is_free ? (
                  <p className="text-[13px] text-muted">Buyers get it for their name and email. You collect leads, no payment needed.</p>
                ) : (
                  <input name="price" value={draft.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" required placeholder="₹ amount" className={inputClass} />
                )}
              </div>
              <Field label="Status">
                <select name="status" value={draft.status} onChange={(e) => set("status", e.target.value as Draft["status"])} className={inputClass}>
                  <option value="draft">Draft (hidden)</option>
                  <option value="live">Live</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
            </div>
            <Field label="Link" hint={`${appUrl}/p/${draft.slug || "your-link"}`}>
              <input name="slug" value={draft.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} required className={inputClass} />
            </Field>

            <div className="space-y-1.5">
              <span className="block text-[14px] font-semibold">Description</span>
              <RichTextEditor value={draft.description_html} onChange={(html) => set("description_html", html)} creatorId={creatorId} onBusyChange={setEditorBusy} />
              <span className="block text-[13px] text-muted">Format text, add headings, lists, links and images. Images are compressed automatically.</span>
            </div>

            <Field label="Cover image" hint="PNG, JPG, WebP or GIF up to 5 MB. Wide images (16:10) look best.">
              <div className="space-y-3">
                {draft.cover_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.cover_image_url} alt="" className="aspect-[16/10] w-full max-w-sm rounded-2xl object-cover" />
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onCoverChange} disabled={uploading} className="text-[13px]" />
                  {draft.cover_image_url && <button type="button" onClick={() => set("cover_image_url", "")} className="link text-[14px]">Remove</button>}
                </div>
                {uploading && <p className="text-[13px] text-muted">Uploading</p>}
                {uploadError && <p className="text-[13px] text-down">{uploadError}</p>}
              </div>
            </Field>

            <Field label="Button label">
              <input name="button_label" value={draft.button_label} onChange={(e) => set("button_label", e.target.value)} required maxLength={40} className={inputClass} />
            </Field>
            <Field label="Thank-you message" hint="Shown after a successful payment and in the delivery email.">
              <textarea name="thank_you_message" value={draft.thank_you_message} onChange={(e) => set("thank_you_message", e.target.value)} rows={3} className={textareaClass} />
            </Field>

            <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center gap-3 border-t border-hairline bg-canvas/95 px-6 py-4 backdrop-blur">
              <Button type="submit" disabled={pending || uploading || editorBusy || !dirty}>
                {pending ? "Saving" : editorBusy ? "Uploading images" : dirty ? "Save changes" : "Saved"}
              </Button>
              {dirty && (
                <button type="button" onClick={() => setDraft(JSON.parse(saved))} className="link text-[14px]">Discard</button>
              )}
              <FormMessage state={state} />
            </div>
          </form>
        </Panel>
        {children}
      </div>

      <div className="hidden xl:block">
        <div className="sticky top-6 space-y-2">
          <p className="text-[13px] font-semibold text-muted">Live preview{dirty ? " · includes unsaved changes" : ""}</p>
          {preview}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMobilePreview(true)}
        className={cx("fixed bottom-5 right-5 z-30 rounded-full bg-dark px-5 py-3 text-[14px] font-semibold text-white shadow-float xl:hidden")}
      >
        Preview
      </button>
      {mobilePreview && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-dark/60 p-3 backdrop-blur-sm xl:hidden" role="dialog" aria-label="Page preview">
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="flex justify-end">
              <button type="button" onClick={() => setMobilePreview(false)} className="rounded-full bg-canvas px-4 py-2 text-[14px] font-semibold">Close preview</button>
            </div>
            {preview}
          </div>
        </div>
      )}
    </div>
  );
}
