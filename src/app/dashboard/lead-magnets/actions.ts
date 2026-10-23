"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAllowedImageSrc } from "@/lib/rich-text";
import { COVER_KEYS, LEAD_LIMITS, leadSlug, type CoverPreset } from "@/lib/lead-magnets";

export type LeadActionState = { error?: string; ok?: string } | null;

function limitMessage(message: string) {
  if (message.includes("email_not_verified")) return "Verify your email to publish. Use the link at the top of the page, then publish again.";
  return message.includes("free_plan_lead_magnet_limit")
    ? "The Free plan includes one lead magnet. Upgrade to Creator in Plan and billing for unlimited lead magnets."
    : null;
}

function refresh(id?: string) {
  revalidatePath("/dashboard/lead-magnets");
  if (id) revalidatePath(`/dashboard/lead-magnets/${id}`);
}

export async function createLeadMagnet() {
  const profile = await requireCreator();
  const supabase = await createClient();
  const title = "Get my free guide";
  const { data, error } = await supabase
    .from("lead_magnets")
    .insert({ creator_id: profile.id, slug: leadSlug(title), title })
    .select("id")
    .single();
  if (error) redirect(`/dashboard/lead-magnets?error=${limitMessage(error.message) ? "limit" : "failed"}`);
  redirect(`/dashboard/lead-magnets/${data.id}`);
}

const questionSchema = z.object({
  id: z.string().max(60),
  label: z.string().trim().min(1, "Every question needs a label").max(120),
  type: z.enum(["text", "textarea", "number", "select"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(80)).max(30),
});

const basicsSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Add a title").max(LEAD_LIMITS.title),
  description: z.string().trim().max(LEAD_LIMITS.description),
  buttonLabel: z.string().trim().min(1, "Add button text").max(LEAD_LIMITS.button),
  coverPreset: z.enum(COVER_KEYS as [CoverPreset, ...CoverPreset[]]),
  coverImageUrl: z.string().max(1000),
  collectPhone: z.boolean(),
  phoneRequired: z.boolean(),
  verifyEmail: z.boolean(),
  questions: z.array(questionSchema).max(15, "Up to 15 extra questions"),
});

// Step 1: content, cover and questions.
export async function saveLeadBasics(input: z.input<typeof basicsSchema>): Promise<LeadActionState> {
  await requireCreator();
  const parsed = basicsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (d.coverImageUrl && !isAllowedImageSrc(d.coverImageUrl)) return { error: "Please upload the cover image again." };
  for (const q of d.questions) if (q.type === "select" && q.options.length < 2) return { error: `Add at least two options for "${q.label}"` };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_magnets")
    .update({
      title: d.title,
      description: d.description,
      button_label: d.buttonLabel,
      cover_preset: d.coverPreset,
      cover_image_url: d.coverImageUrl || null,
      collect_phone: d.collectPhone,
      phone_required: d.collectPhone && d.phoneRequired,
      verify_email: d.verifyEmail,
    })
    .eq("id", d.id);
  if (error) return { error: error.message };

  // Replace the question list; responses store answers by label, so ids can change.
  const { error: delError } = await supabase.from("lead_magnet_questions").delete().eq("magnet_id", d.id);
  if (delError) return { error: delError.message };
  if (d.questions.length) {
    const { error: insError } = await supabase.from("lead_magnet_questions").insert(
      d.questions.map((q, position) => ({ magnet_id: d.id, label: q.label, field_type: q.type, required: q.required, options: q.type === "select" ? q.options : [], position })),
    );
    if (insError) return { error: insError.message };
  }
  refresh(d.id);
  return { ok: "Saved" };
}

const settingsSchema = z.object({
  id: z.uuid(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/, "Link name: 3 to 60 lowercase letters, numbers and hyphens"),
  thankYouMessage: z.string().trim().min(1, "Add a thank-you message").max(LEAD_LIMITS.thankYou),
  redirectUrl: z.union([z.url("Redirect link must be a full URL starting with https://").max(1000), z.literal("")]),
  recommendedPageId: z.union([z.uuid(), z.literal("")]),
  storefrontVisible: z.boolean(),
  status: z.enum(["draft", "live"]),
});

// Step 2: after-submit experience, link and publishing.
export async function saveLeadSettings(input: z.input<typeof settingsSchema>): Promise<LeadActionState> {
  const profile = await requireCreator();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (d.redirectUrl && !/^https?:\/\//i.test(d.redirectUrl)) return { error: "Redirect link must start with https://" };

  const supabase = await createClient();
  if (d.recommendedPageId) {
    const { data: page } = await supabase.from("payment_pages").select("id").eq("id", d.recommendedPageId).eq("creator_id", profile.id).maybeSingle();
    if (!page) return { error: "Pick one of your own products to recommend." };
  }
  const save = (status: typeof d.status) => supabase
    .from("lead_magnets")
    .update({
      slug: d.slug,
      thank_you_message: d.thankYouMessage,
      redirect_url: d.redirectUrl || null,
      recommended_page_id: d.recommendedPageId || null,
      storefront_visible: d.storefrontVisible,
      status,
    })
    .eq("id", d.id);
  let { error } = await save(d.status);
  // Unverified email: keep the edits, as a draft, and say how to publish.
  if (error?.message.includes("email_not_verified")) {
    ({ error } = await save("draft"));
    if (!error) {
      refresh(d.id);
      return { error: "Saved as a draft. Verify your email to publish: use the link at the top of the page, then publish again." };
    }
  }
  if (error) return { error: error.code === "23505" ? "That link name is taken. Try another." : limitMessage(error.message) ?? error.message };
  refresh(d.id);
  if (profile.handle) revalidatePath(`/s/${profile.handle}`);
  return { ok: d.status === "live" ? "Published. Your lead magnet is live." : "Saved as draft." };
}

export async function setLeadStatus(id: string, status: "draft" | "live") {
  await requireCreator();
  const supabase = await createClient();
  const { error } = await supabase.from("lead_magnets").update({ status }).eq("id", id);
  refresh(id);
  return error ? { error: limitMessage(error.message) ?? error.message } : { ok: "Updated" };
}

// Lead magnets with responses are archived so the leads stay; others are deleted.
export async function deleteLeadMagnet(id: string) {
  await requireCreator();
  const supabase = await createClient();
  const { count } = await supabase.from("lead_responses").select("id", { count: "exact", head: true }).eq("magnet_id", id);
  if (count) {
    await supabase.from("lead_magnets").update({ status: "archived" }).eq("id", id);
  } else {
    const { data: files } = await supabase.from("lead_magnet_files").select("storage_path").eq("magnet_id", id);
    if (files?.length) await supabase.storage.from("product-files").remove(files.map((f) => f.storage_path));
    await supabase.from("lead_magnets").delete().eq("id", id);
  }
  refresh();
  redirect("/dashboard/lead-magnets");
}

export async function registerLeadFile(input: { magnetId: string; path: string; name: string; size: number; type: string | null }): Promise<LeadActionState> {
  const profile = await requireCreator();
  if (!input.path.startsWith(`${profile.id}/`)) return { error: "Invalid file path" };
  const supabase = await createClient();
  const { error } = await supabase.from("lead_magnet_files").insert({
    magnet_id: input.magnetId,
    storage_path: input.path,
    file_name: input.name.slice(0, 200),
    size_bytes: input.size,
    content_type: input.type,
  });
  if (error) {
    await supabase.storage.from("product-files").remove([input.path]);
    return { error: error.message };
  }
  refresh(input.magnetId);
  return { ok: "Uploaded" };
}

export async function deleteLeadFile(fileId: string, magnetId: string) {
  await requireCreator();
  const supabase = await createClient();
  const { data: file } = await supabase.from("lead_magnet_files").select("storage_path").eq("id", fileId).maybeSingle();
  if (!file) return;
  await supabase.storage.from("product-files").remove([file.storage_path]);
  await supabase.from("lead_magnet_files").delete().eq("id", fileId);
  refresh(magnetId);
}
