"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasCreatorPlan } from "@/lib/plans";
import { rupeesToPaise } from "@/lib/money";
import { isAllowedImageSrc } from "@/lib/rich-text";
import type { ActionState } from "../../actions";

const schema = z.object({
  page_id: z.uuid(),
  headline: z.string().trim().min(1, "Add a headline").max(80),
  title: z.string().trim().min(1, "Give the add-on a title").max(120),
  description: z.string().trim().max(300, "Keep the pitch under 300 characters"),
  image_url: z.string().max(1000),
  price: z.string().trim().min(1, "Set the add-on price"),
  compare_at: z.string().trim(),
  active: z.literal("on").optional(),
});

function refresh(pageId: string) {
  revalidatePath(`/dashboard/pages/${pageId}`);
}

// One add-on per page; RLS makes sure the page belongs to this creator.
export async function saveOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireCreator();
  if (!hasCreatorPlan(profile)) return { error: "Additional offers are part of the Creator plan." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;

  const price = rupeesToPaise(input.price);
  if (price === null || price < 100) return { error: "The add-on price must be at least ₹1" };
  let compareAt: number | null = null;
  if (input.compare_at) {
    compareAt = rupeesToPaise(input.compare_at);
    if (compareAt === null) return { error: "Enter the original price as a number, or leave it empty" };
    if (compareAt <= price) return { error: "The original price should be higher than the offer price" };
  }
  if (input.image_url && !isAllowedImageSrc(input.image_url)) return { error: "Please upload the image again." };

  const supabase = await createClient();
  const { error } = await supabase.from("page_offers").upsert(
    {
      page_id: input.page_id,
      headline: input.headline,
      title: input.title,
      description: input.description,
      image_url: input.image_url || null,
      price_paise: price,
      compare_at_paise: compareAt,
      active: input.active === "on",
    },
    { onConflict: "page_id" },
  );
  if (error) return { error: error.message };
  refresh(input.page_id);
  return { ok: "Add-on saved" };
}

// An add-on buyers have paid for is switched off instead of deleted, so their
// bonus files keep downloading.
export async function deleteOffer(offerId: string, pageId: string): Promise<ActionState> {
  await requireCreator();
  const supabase = await createClient();
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("offer_id", offerId)
    .in("status", ["paid", "partially_refunded"]);
  if (count) {
    await supabase.from("page_offers").update({ active: false }).eq("id", offerId).eq("page_id", pageId);
    refresh(pageId);
    return { ok: `This add-on has ${count} sale${count > 1 ? "s" : ""}, so it was switched off instead of deleted. Past buyers keep their files.` };
  }
  const { data: files } = await supabase.from("offer_files").select("storage_path").eq("offer_id", offerId);
  if (files?.length) await supabase.storage.from("product-files").remove(files.map((f) => f.storage_path));
  await supabase.from("page_offers").delete().eq("id", offerId).eq("page_id", pageId);
  refresh(pageId);
  return { ok: "Add-on deleted" };
}

const fileSchema = z.object({
  offerId: z.uuid(),
  pageId: z.uuid(),
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  type: z.string().max(200).nullable(),
});

// Files are uploaded straight from the browser to storage; this records them.
export async function registerOfferFile(input: z.infer<typeof fileSchema>): Promise<ActionState> {
  const profile = await requireCreator();
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid file" };
  const f = parsed.data;
  if (!f.path.startsWith(`${profile.id}/offers/${f.offerId}/`)) return { error: "Invalid file path" };

  const supabase = await createClient();
  const { error } = await supabase.from("offer_files").insert({
    offer_id: f.offerId,
    storage_path: f.path,
    file_name: f.name,
    size_bytes: f.size,
    content_type: f.type,
  });
  if (error) {
    await supabase.storage.from("product-files").remove([f.path]);
    return { error: error.message };
  }
  refresh(f.pageId);
  return { ok: "Uploaded" };
}

export async function deleteOfferFile(fileId: string, pageId: string) {
  await requireCreator();
  const supabase = await createClient();
  const { data: file } = await supabase.from("offer_files").select("storage_path").eq("id", fileId).single();
  if (file) {
    await supabase.storage.from("product-files").remove([file.storage_path]);
    await supabase.from("offer_files").delete().eq("id", fileId);
  }
  refresh(pageId);
}
