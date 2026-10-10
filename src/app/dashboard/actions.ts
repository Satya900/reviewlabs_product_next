"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { sendMetaEvent } from "@/lib/meta";
import { checkTokenWithMeta, pixelSchema } from "@/lib/meta-settings";
import { hasCreatorPlan } from "@/lib/plans";
import { htmlToText, sanitizeDescription } from "@/lib/rich-text";
import { rupeesToPaise } from "@/lib/money";

export type ActionState = { error?: string; ok?: string } | null;

// Turns the database's plan-limit errors into something a creator can act on.
function planLimitMessage(message: string): string | null {
  if (message.includes("free_plan_page_limit")) return "The Free plan includes one product page. Upgrade to Creator in Plan and billing for unlimited pages.";
  if (message.includes("free_plan_live_limit")) return "The Free plan can have one live page. Upgrade to Creator in Plan and billing to publish more.";
  return null;
}

function slugify(input: string) {
  return input.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "page";
}

// ---------------------------------------------------------------- pages

export async function createPage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireCreator();
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
  button_label: z.string().trim().min(1).max(40),
  thank_you_message: z.string().trim().max(2000),
  status: z.enum(["draft", "live", "archived"]),
  cover_image_url: z.union([z.url(), z.literal("")]),
});

export async function updatePage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireCreator();
  const parsed = pageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;

  const amount = rupeesToPaise(input.price);
  if (amount === null || amount < 100) return { error: "Price must be at least ₹1" };
  if (amount > 50_000_000) return { error: "Price is too high" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_pages")
    .update({
      title: input.title,
      slug: input.slug,
      // Clean the editor HTML before storing; keep a plain-text copy for SEO and emails.
      description_html: sanitizeDescription(input.description_html),
      description: htmlToText(input.description_html).slice(0, 10000),
      amount_paise: amount,
      button_label: input.button_label,
      thank_you_message: input.thank_you_message || "Thank you for your purchase!",
      status: input.status,
      cover_image_url: input.cover_image_url || null,
    })
    .eq("id", input.id);
  if (error) return { error: error.code === "23505" ? "That slug is taken, try another" : planLimitMessage(error.message) ?? error.message };

  revalidatePath(`/dashboard/pages/${input.id}`);
  revalidatePath("/dashboard/pages");
  return { ok: "Saved" };
}

export async function deletePage(pageId: string) {
  await requireCreator();
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
  await requireCreator();
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
  await requireCreator();
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
  const profile = await requireCreator();
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
  await requireCreator();
  const supabase = await createClient();
  const { data: file } = await supabase.from("page_files").select("storage_path").eq("id", fileId).single();
  if (file) {
    await supabase.storage.from("product-files").remove([file.storage_path]);
    await supabase.from("page_files").delete().eq("id", fileId);
  }
  revalidatePath(`/dashboard/pages/${pageId}`);
}

// ---------------------------------------------------------------- settings

const profileSchema = z.object({
  name: z.string().trim().max(120),
  payout_upi: z.union([z.string().trim().regex(/^[\w.\-]{2,}@[a-zA-Z]{2,}$/, "Invalid UPI ID"), z.literal("")]),
  payout_account_name: z.string().trim().max(120),
  payout_account_number: z.union([z.string().trim().regex(/^\d{6,20}$/, "Invalid account number"), z.literal("")]),
  payout_ifsc: z.union([z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC"), z.literal("")]),
});

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireCreator();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const nullIfEmpty = (v: string) => v || null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      name: nullIfEmpty(parsed.data.name),
      payout_upi: nullIfEmpty(parsed.data.payout_upi),
      payout_account_name: nullIfEmpty(parsed.data.payout_account_name),
      payout_account_number: nullIfEmpty(parsed.data.payout_account_number),
      payout_ifsc: nullIfEmpty(parsed.data.payout_ifsc),
    })
    .eq("id", profile.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: "Saved" };
}

// Meta tracking needs both the Pixel ID and the Conversions API token, so every
// connected creator gets browser and server events. Leaving both empty turns tracking off.
export async function updatePixel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireCreator();
  if (!hasCreatorPlan(profile)) return { error: "Meta tracking is part of the Creator plan." };
  const parsed = pixelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;
  const db = createAdminClient();

  if (!input.pixel_id) {
    if (input.capi_token) return { error: "Add your Pixel ID too. Meta tracking needs both." };
    const { error } = await db
      .from("creator_pixel_settings")
      .upsert({ creator_id: profile.id, pixel_id: null, capi_token_encrypted: null, test_event_code: null }, { onConflict: "creator_id" });
    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings");
    return { ok: "Meta tracking is off" };
  }

  const { data: current } = await db.from("creator_pixel_settings").select("pixel_id, capi_token_encrypted").eq("creator_id", profile.id).maybeSingle();

  // A blank token field keeps the saved token; it is never sent back to the browser.
  const token = input.capi_token || (current?.capi_token_encrypted ? decrypt(current.capi_token_encrypted) : "");
  if (!token) return { error: "Add your Conversions API access token. Meta tracking needs both the Pixel ID and the token." };

  if (input.test_event_code && (input.capi_token || current?.pixel_id !== input.pixel_id)) {
    const problem = await checkTokenWithMeta(input.pixel_id, token, input.test_event_code);
    if (problem) return { error: `Meta didn't accept this token for pixel ${input.pixel_id}: ${problem}` };
  }

  const { error } = await db.from("creator_pixel_settings").upsert(
    {
      creator_id: profile.id,
      pixel_id: input.pixel_id,
      test_event_code: input.test_event_code || null,
      ...(input.capi_token ? { capi_token_encrypted: encrypt(input.capi_token) } : {}),
    },
    { onConflict: "creator_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: input.test_event_code ? "Saved. Meta tracking is on, in test mode." : "Saved. Meta tracking is on." };
}

export async function sendTestMetaEvent(): Promise<ActionState> {
  const profile = await requireCreator();
  if (!hasCreatorPlan(profile)) return { error: "Meta tracking is part of the Creator plan." };
  // Without the creator's test code this would land in their real data.
  const { data: settings } = await createAdminClient().from("creator_pixel_settings").select("test_event_code").eq("creator_id", profile.id).maybeSingle();
  if (!settings?.test_event_code) return { error: "Add your test event code under Testing first, so the test doesn't count as a real visit." };
  const result = await sendMetaEvent({ creatorId: profile.id }, {
    eventName: "PageView",
    eventId: `test_${crypto.randomUUID()}`,
    tracking: { source_url: env.appUrl(), user_agent: "reviewlabs-test", client_ip: "127.0.0.1" },
  });
  if (result.status === "skipped") return { error: "Save your Pixel ID and access token first" };
  if (result.status === "failed") return { error: `Meta rejected the event: ${JSON.stringify(result.response ?? result.error)}` };
  return { ok: "Test event sent. Check the Test events tab in Events Manager." };
}
