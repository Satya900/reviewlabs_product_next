"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOffer, deleteOfferFile, registerOfferFile, saveOffer } from "./offer-actions";
import { Button, Field, FormMessage, inputClass, textareaClass, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { paiseToRupeesString } from "@/lib/money";
import type { Offer, OfferFile } from "@/lib/types";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Shrinks the add-on thumbnail; it is shown small in the checkout card.
async function thumbnail(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Couldn't process that image");
  return blob;
}

function OfferFiles({ creatorId, pageId, offerId, files }: { creatorId: string; pageId: string; offerId: string; files: OfferFile[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError(null);
    const supabase = createClient();
    for (const file of selected) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name} is larger than 50 MB`);
        continue;
      }
      setUploading(file.name);
      const path = `${creatorId}/offers/${offerId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("product-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) {
        setError(`${file.name}: ${upErr.message}`);
        continue;
      }
      const res = await registerOfferFile({ offerId, pageId, path, name: file.name, size: file.size, type: file.type || null });
      if (res?.error) setError(`${file.name}: ${res.error}`);
    }
    setUploading(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <span className="block text-[14px] font-semibold">Files delivered with the add-on</span>
      {files.length > 0 && (
        <ul className="divide-y divide-hairline-soft rounded-2xl bg-surface-soft text-[14px]">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="min-w-0 break-all">{f.file_name} <span className="num text-[12px] text-muted">{formatSize(f.size_bytes)}</span></span>
              <button type="button" disabled={deleting} onClick={() => startDelete(() => deleteOfferFile(f.id, pageId))} className="link shrink-0 text-[14px]">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-hairline p-5 text-center text-[14px] font-medium text-body transition hover:border-primary hover:text-primary">
        {uploading ? `Uploading ${uploading}` : "Click to upload add-on files (50 MB each)"}
        <input type="file" multiple onChange={onChange} disabled={!!uploading} className="hidden" />
      </label>
      {!files.length && <p className="text-[13px] text-muted">Add at least one file so buyers receive something when they tick the add-on.</p>}
      {error && <p className="text-[14px] text-down">{error}</p>}
    </div>
  );
}

export function OfferPanel({ creatorId, pageId, offer, files }: { creatorId: string; pageId: string; offer: Offer | null; files: OfferFile[] }) {
  const [state, action, pending] = useActionState(saveOffer, null);
  const [creating, setCreating] = useState(false);
  const [image, setImage] = useState(offer?.image_url ?? "");
  const [description, setDescription] = useState(offer?.description ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const [removeState, setRemoveState] = useState<{ error?: string; ok?: string } | null>(null);

  if (!offer && !creating) {
    return (
      <div className="space-y-3">
        <p className="text-[14px] text-body">
          Offer a bonus at checkout, like a template pack or a mini guide. Buyers tick one box and pay for both in a single payment.
        </p>
        <Button type="button" variant="secondary" onClick={() => setCreating(true)}>+ Create an add-on</Button>
      </div>
    );
  }

  async function onImage(file: File) {
    setUploadError(null);
    if (!file.type.startsWith("image/")) return setUploadError("Choose an image file.");
    setUploading(true);
    try {
      const blob = await thumbnail(file);
      const path = `${creatorId}/offers/${crypto.randomUUID()}.webp`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("page-covers").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw new Error(error.message);
      setImage(supabase.storage.from("page-covers").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <input type="hidden" name="page_id" value={pageId} />
        <input type="hidden" name="image_url" value={image} />
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface-soft px-4 py-3">
          <span>
            <span className="block text-[14px] font-semibold">Show this add-on at checkout</span>
            <span className="block text-[13px] text-muted">Turn off to hide it without deleting it.</span>
          </span>
          <input type="checkbox" name="active" defaultChecked={offer?.active ?? true} className="size-5 accent-primary" />
        </label>
        <Field label="Headline" hint="The bold line above the add-on, e.g. YES, ADD THIS TO MY ORDER.">
          <input name="headline" defaultValue={offer?.headline ?? "Yes, add this to my order"} required maxLength={80} className={inputClass} />
        </Field>
        <Field label="Add-on title">
          <input name="title" defaultValue={offer?.title ?? ""} required maxLength={120} placeholder="For example: 30 bonus Canva templates" className={inputClass} />
        </Field>
        <label className="block space-y-1.5">
          <span className="block text-[14px] font-semibold">Short pitch</span>
          <div className="relative">
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="One or two lines on why it's worth adding."
              className={cx(textareaClass, "pb-7")}
            />
            <span className="num pointer-events-none absolute bottom-3 right-4 text-[12px] text-muted">{description.length}/300</span>
          </div>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Offer price (₹)">
            <input name="price" defaultValue={offer ? paiseToRupeesString(offer.price_paise) : ""} required inputMode="decimal" placeholder="149" className={inputClass} />
          </Field>
          <Field label="Original price (₹, optional)" hint="Shown struck through.">
            <input name="compare_at" defaultValue={offer?.compare_at_paise ? paiseToRupeesString(offer.compare_at_paise) : ""} inputMode="decimal" placeholder="299" className={inputClass} />
          </Field>
        </div>
        <div className="space-y-2">
          <span className="block text-[14px] font-semibold">Image (optional)</span>
          <div className="flex flex-wrap items-center gap-3">
            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="size-16 rounded-xl object-cover" />
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onImage(f); }} className="text-[13px]" />
            {image && <button type="button" onClick={() => setImage("")} className="link text-[14px]">Remove</button>}
          </div>
          {uploading && <p className="text-[13px] text-muted">Uploading</p>}
          {uploadError && <p className="text-[13px] text-down">{uploadError}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || uploading}>{pending ? "Saving" : offer ? "Save add-on" : "Create add-on"}</Button>
          {!offer && <button type="button" onClick={() => setCreating(false)} className="link text-[14px]">Cancel</button>}
          <FormMessage state={state} />
        </div>
      </form>

      {offer && (
        <>
          <OfferFiles creatorId={creatorId} pageId={pageId} offerId={offer.id} files={files} />
          <div className="border-t border-hairline pt-4">
            <button
              type="button"
              disabled={removing}
              onClick={() => { if (confirm("Delete this add-on? If it has sales it will be switched off instead, so past buyers keep their files.")) startRemove(async () => setRemoveState(await deleteOffer(offer.id, pageId))); }}
              className="text-[14px] font-medium text-down"
            >
              {removing ? "Deleting" : "Delete add-on"}
            </button>
            <div className="mt-2"><FormMessage state={removeState} /></div>
          </div>
        </>
      )}
    </div>
  );
}
