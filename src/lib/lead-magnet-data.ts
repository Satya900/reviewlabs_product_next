import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPaise } from "@/lib/money";
import type { LeadFile, LeadFormData, LeadMagnet, LeadQuestion } from "@/lib/lead-magnets";

export function toFormData(
  magnet: LeadMagnet,
  questions: LeadQuestion[],
  fileCount: number,
  creatorName: string,
  recommended: LeadFormData["recommended"],
): LeadFormData {
  return {
    id: magnet.id,
    title: magnet.title,
    description: magnet.description,
    buttonLabel: magnet.button_label,
    coverPreset: magnet.cover_preset,
    coverImageUrl: magnet.cover_image_url,
    collectPhone: magnet.collect_phone,
    phoneRequired: magnet.phone_required,
    verifyEmail: magnet.verify_email,
    questions: questions.map((q) => ({ id: q.id, label: q.label, type: q.field_type, required: q.required, options: q.options })),
    fileCount,
    creatorName,
    thankYouMessage: magnet.thank_you_message,
    redirectUrl: magnet.redirect_url,
    recommended,
  };
}

// A live lead magnet for its public page.
export const getPublicLeadMagnet = cache(async (slug: string) => {
  const admin = createAdminClient();
  const { data: magnet } = await admin.from("lead_magnets").select("*").eq("slug", slug.toLowerCase()).eq("status", "live").maybeSingle<LeadMagnet>();
  if (!magnet) return null;
  const [{ data: questions }, { data: files }, { data: seller }, { data: rec }] = await Promise.all([
    admin.from("lead_magnet_questions").select("*").eq("magnet_id", magnet.id).order("position"),
    admin.from("lead_magnet_files").select("id, file_name, size_bytes").eq("magnet_id", magnet.id).order("created_at"),
    admin.from("profiles").select("name").eq("id", magnet.creator_id).maybeSingle(),
    magnet.recommended_page_id
      ? admin.from("payment_pages").select("slug, title, amount_paise, cover_image_url").eq("id", magnet.recommended_page_id).eq("status", "live").maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const recommended = rec ? { slug: rec.slug, title: rec.title, price: formatPaise(rec.amount_paise).replace(/\.00$/, ""), cover: rec.cover_image_url } : null;
  return {
    magnet,
    files: (files ?? []) as LeadFile[],
    form: toFormData(magnet, (questions ?? []) as LeadQuestion[], files?.length ?? 0, seller?.name ?? "", recommended),
  };
});
