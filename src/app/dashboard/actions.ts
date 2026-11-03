"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlan } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { htmlToText, sanitizeDescription } from "@/lib/rich-text";
import { rupeesToPaise } from "@/lib/money";
import { MAX_LINKS, cleanLinkUrl, linkLabelError, suggestLinkLabel } from "@/lib/product-links";

export type ActionState = { error?: string; ok?: string } | null;

// Turns the database's plan-limit errors into something a creator can act on.
function planLimitMessage(message: string): string | null {
  if (message.includes("email_not_verified")) return "Verify your email to publish. Use the link at the top of the page, then set it to Live.";
  return null;
}

function slugify(input: string) {
  // Trim hyphens after cutting too, or a long title can end in "-" and give "…--ab12".
  return input.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").slice(0, 48).replace(/^-+|-+$/g, "") || "page";
}

// ---------------------------------------------------------------- pages

export async function createPage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePlan();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give your page a title" };

  const supabase = await createClient();
  const slug = `${slugify(title)}-${crypto.randomBytes(2).toString("hex")}`;
  const { data, error } = await supabase
    .from("payment_pages")
    .insert({ creator_id: profile.id, title: title.slice(0, 200), slug, amount_paise: 9900 })
    .select("id")
    .single();
  if (error) return { error: planLimitMessage(error.message) ?? error.message };
  redirect(`/dashboard/pages/${data.id}`);
}

const pageSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/, "Slug: 3-60 chars, lowercase letters, numbers and hyphens"),
  description_html: z.string().max(200000, "The description is too long"),
  price: z.string(),
  compare_price: z.string().trim().default(""),
  button_label: z.string().trim().min(1).max(40),
  thank_you_message: z.string().trim().max(2000),
  status: z.enum(["draft", "live", "archived"]),
  cover_image_url: z.union([z.url(), z.literal("")]),
});

export async function updatePage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlan();
  const parsed = pageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;

  const amount = rupeesToPaise(input.price);
  if (amount === null || amount < 100) return { error: "Price must be at least ₹1" };
  if (amount > 50_000_000) return { error: "Price is too high" };
  const compareAt = input.compare_price ? rupeesToPaise(input.compare_price) : null;
  if (input.compare_price && (compareAt === null || compareAt <= amount)) return { error: "The original price must be higher than the price, or left empty" };
  if (compareAt !== null && compareAt > 50_000_000) return { error: "The original price is too high" };

  const supabase = await createClient();
  const save = (status: typeof input.status) => supabase
    .from("payment_pages")
    .update({
      title: input.title,
      slug: input.slug,
      // Clean the editor HTML before storing; keep a plain-text copy for SEO and emails.
      description_html: sanitizeDescription(input.description_html),
      description: htmlToText(input.description_html).slice(0, 10000),
      amount_paise: amount,
      compare_at_paise: compareAt,
      button_label: input.button_label,
      thank_you_message: input.thank_you_message || "Thank you for your purchase!",
      status,
      cover_image_url: input.cover_image_url || null,
    })
    .eq("id", input.id);
  let { error } = await save(input.status);
  // Unverified email: keep the edits, as a draft, and say how to publish.
  if (error?.message.includes("email_not_verified")) {
    ({ error } = await save("draft"));
    if (!error) {
      revalidatePath(`/dashboard/pages/${input.id}`);
      return { error: "Saved as a draft. Verify your email to publish: use the link at the top of the page, then set it to Live." };
    }
  }
  if (error) return { error: error.code === "23505" ? "That slug is taken, try another" : planLimitMessage(error.message) ?? error.message };

  revalidatePath(`/dashboard/pages/${input.id}`);
  revalidatePath("/dashboard/pages");
  return { ok: "Saved" };
}

export async function deletePage(pageId: string) {
  await requirePlan();
  const supabase = await createClient();
  const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("page_id", pageId);
  if (count) {
    // Pages with orders are kept for the record; archive instead.
    await supabase.from("payment_pages").update({ status: "archived" }).eq("id", pageId);
  } else {
    const { data: files } = await supabase.from("page_files").select("storage_path").eq("page_id", pageId);
    if (files?.length) await supabase.storage.from("product-files").remove(files.map((f) => f.storage_path));
    await supabase.from("payment_pages").delete().eq("id", pageId);
  }
  revalidatePath("/dashboard/pages");
  redirect("/dashboard/pages");
}

// ---------------------------------------------------------------- checkout fields

const fieldSchema = z.object({
  page_id: z.uuid(),
  label: z.string().trim().min(1, "Label is required").max(120),
  field_type: z.enum(["text", "textarea", "number", "select"]),
  required: z.literal("on").optional(),
  options: z.string().optional(),
});

export async function addField(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlan();
  const parsed = fieldSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;

  const options = input.field_type === "select"
    ? (input.options ?? "").split(",").map((o) => o.trim()).filter(Boolean).slice(0, 50)
    : [];
  if (input.field_type === "select" && options.length < 2) return { error: "Add at least two comma-separated options" };

  const supabase = await createClient();
  const { count } = await supabase.from("page_fields").select("id", { count: "exact", head: true }).eq("page_id", input.page_id);
  if ((count ?? 0) >= 15) return { error: "Up to 15 custom fields" };

  const { error } = await supabase.from("page_fields").insert({
    page_id: input.page_id,
    label: input.label,
    field_type: input.field_type,
    required: input.required === "on",
    options,
    position: count ?? 0,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pages/${input.page_id}`);
  return { ok: "Field added" };
}

export async function deleteField(fieldId: string, pageId: string) {
  await requirePlan();
  const supabase = await createClient();
  await supabase.from("page_fields").delete().eq("id", fieldId);
  revalidatePath(`/dashboard/pages/${pageId}`);
}

// ---------------------------------------------------------------- files

const fileSchema = z.object({
  pageId: z.uuid(),
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  type: z.string().max(200).nullable(),
});

// Files are uploaded straight from the browser to Storage; this records them.
export async function registerFile(input: z.infer<typeof fileSchema>): Promise<ActionState> {
  const profile = await requirePlan();
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid file" };
  const file = parsed.data;
  if (!file.path.startsWith(`${profile.id}/${file.pageId}/`)) return { error: "Invalid file path" };

  const supabase = await createClient();
  const { error } = await supabase.from("page_files").insert({
    page_id: file.pageId,
    storage_path: file.path,
    file_name: file.name,
    size_bytes: file.size,
    content_type: file.type,
  });
  if (error) {
    await supabase.storage.from("product-files").remove([file.path]);
    return { error: error.message };
  }
  revalidatePath(`/dashboard/pages/${file.pageId}`);
  return { ok: "Uploaded" };
}

export async function deleteFile(fileId: string, pageId: string) {
  await requirePlan();
  const supabase = await createClient();
  const { data: file } = await supabase.from("page_files").select("storage_path").eq("id", fileId).single();
  if (file) {
    await supabase.storage.from("product-files").remove([file.storage_path]);
    await supabase.from("page_files").delete().eq("id", fileId);
  }
  revalidatePath(`/dashboard/pages/${pageId}`);
}

// Links buyers get instead of (or as well as) files: Notion, Drive, Canva,
// course logins, group invites. RLS limits these to the creator's own pages.
export async function addPageLink(input: { pageId: string; label: string; url: string }): Promise<ActionState> {
  await requirePlan();
  if (!z.uuid().safeParse(input.pageId).success) return { error: "Invalid page" };
  const url = cleanLinkUrl(input.url ?? "");
  if (!url) return { error: "Enter a full https:// link, like https://notion.so/your-template" };
  const label = (input.label ?? "").trim() || suggestLinkLabel(url);
  const labelProblem = linkLabelError(label);
  if (labelProblem) return { error: labelProblem };
  const supabase = await createClient();
  const { data: last } = await supabase.from("page_links").select("position").eq("page_id", input.pageId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("page_links").insert({ page_id: input.pageId, label, url, position: (last?.position ?? -1) + 1 });
  if (error) {
    if (error.message.includes("page_link_limit")) return { error: `A product can have up to ${MAX_LINKS} links.` };
    if (error.code === "42501" || /row-level security/i.test(error.message)) return { error: "Invalid page" };
    return { error: error.message };
  }
  revalidatePath(`/dashboard/pages/${input.pageId}`);
  return { ok: "Link added" };
}

export async function deletePageLink(linkId: string, pageId: string) {
  await requirePlan();
  const supabase = await createClient();
  await supabase.from("page_links").delete().eq("id", linkId);
  revalidatePath(`/dashboard/pages/${pageId}`);
}

// ---------------------------------------------------------------- settings

// Bank details have their own form (payout-actions.ts), with a cancelled cheque.
const profileSchema = z.object({
  name: z.string().trim().max(120),
});

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePlan();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const nullIfEmpty = (v: string) => v || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ name: nullIfEmpty(parsed.data.name) })
    .eq("id", profile.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: "Saved" };
}

