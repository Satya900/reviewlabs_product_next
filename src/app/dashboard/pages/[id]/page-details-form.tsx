"use client";

import { useActionState, useState } from "react";
import { updatePage } from "../../actions";
import { createClient } from "@/lib/supabase/client";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
import type { PaymentPage } from "@/lib/types";

type Props = { creatorId: string; appUrl: string; page: PaymentPage & { price: string } };

export function PageDetailsForm({ creatorId, appUrl, page }: Props) {
  const [state, action, pending] = useActionState(updatePage, null);
  const [cover, setCover] = useState(page.cover_image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    else setCover(supabase.storage.from("page-covers").getPublicUrl(path).data.publicUrl);
    setUploading(false);
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={page.id} />
      <input type="hidden" name="cover_image_url" value={cover} />
      <Field label="Title">
        <input name="title" defaultValue={page.title} required className={inputClass} />
      </Field>
      <Field label="Link" hint={`${appUrl}/p/your-link`}>
        <input name="slug" defaultValue={page.slug} required className={inputClass} />
      </Field>
      <Field label="Price (₹)">
        <input name="price" defaultValue={page.price} inputMode="decimal" required className={inputClass} />
      </Field>
      <Field label="Description">
        <textarea name="description" defaultValue={page.description} rows={8} className={inputClass} />
      </Field>
      <Field label="Cover image" hint="PNG, JPG, WebP or GIF up to 5 MB">
        <div className="space-y-2">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="aspect-video w-full max-w-sm rounded-2xl object-cover" />
          )}
          <div className="flex items-center gap-3">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onCoverChange} disabled={uploading} className="text-[13px]" />
            {cover && <button type="button" onClick={() => setCover("")} className="link text-[14px]">Remove</button>}
          </div>
          {uploading && <p className="text-[13px] text-muted">Uploading</p>}
          {uploadError && <p className="text-[13px] text-down">{uploadError}</p>}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Button label">
          <input name="button_label" defaultValue={page.button_label} required className={inputClass} />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={page.status} className={inputClass}>
            <option value="draft">Draft (hidden)</option>
            <option value="live">Live</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      </div>
      <Field label="Thank-you message" hint="Shown after a successful payment.">
        <textarea name="thank_you_message" defaultValue={page.thank_you_message} rows={3} className={inputClass} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || uploading}>{pending ? "Saving" : "Save"}</Button>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
