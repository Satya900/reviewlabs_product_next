"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedImageSrc } from "@/lib/rich-text";
import { HANDLE_PATTERN, RESERVED_HANDLES, SOCIALS, socialHref } from "@/lib/storefront";

export type StorefrontState = { error?: string; ok?: string } | null;

function refresh(handle?: string | null) {
  revalidatePath("/dashboard/storefront");
  if (handle) revalidatePath(`/s/${handle}`);
}

// Live check while typing. Never reveals anything beyond "taken".
export async function checkHandle(raw: string): Promise<{ ok: boolean; message: string }> {
  const profile = await requireCreator();
  const handle = raw.trim().toLowerCase();
  if (!HANDLE_PATTERN.test(handle)) return { ok: false, message: "3 to 30 characters: letters, numbers, dots and underscores" };
  if (RESERVED_HANDLES.has(handle)) return { ok: false, message: "That name is reserved" };
  if (handle === profile.handle) return { ok: true, message: "This is your current link" };
  const { data } = await createAdminClient().from("profiles").select("id").eq("handle", handle).maybeSingle();
  return data ? { ok: false, message: "Already taken" } : { ok: true, message: "Available" };
}

const schema = z.object({
  handle: z.string().trim().toLowerCase(),
  name: z.string().trim().max(80),
  bio: z.string().trim().max(160, "Keep your bio under 160 characters"),
  avatar_url: z.string().max(1000),
  featured_page_id: z.union([z.uuid(), z.literal("")]),
});

export async function saveStorefront(_prev: StorefrontState, formData: FormData): Promise<StorefrontState> {
  const profile = await requireCreator();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;

  if (!HANDLE_PATTERN.test(input.handle)) return { error: "Your link name needs 3 to 30 characters: letters, numbers, dots and underscores." };
  if (RESERVED_HANDLES.has(input.handle)) return { error: "That link name is reserved. Try another." };
  if (input.avatar_url && !isAllowedImageSrc(input.avatar_url)) return { error: "Please upload your photo again." };

  const socials: Record<string, string> = {};
  for (const s of SOCIALS) {
    const value = String(formData.get(`social_${s.key}`) ?? "").trim().slice(0, 300);
    if (!value) continue;
    if (!socialHref(s.key, value)) return { error: `${s.label} doesn't look right. Check the link or number.` };
    socials[s.key] = value;
  }

  const supabase = await createClient();
  if (input.featured_page_id) {
    const { data: owned } = await supabase.from("payment_pages").select("id").eq("id", input.featured_page_id).eq("creator_id", profile.id).maybeSingle();
    if (!owned) return { error: "Pick one of your own products to feature." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      handle: input.handle,
      name: input.name || null,
      bio: input.bio,
      avatar_url: input.avatar_url || null,
      social_links: socials,
      featured_page_id: input.featured_page_id || null,
    })
    .eq("id", profile.id);
  if (error) return { error: error.code === "23505" ? "That link name was just taken. Try another." : error.message };
  refresh(profile.handle);
  refresh(input.handle);
  return { ok: "Saved. Your storefront is live." };
}

export async function setPageVisible(pageId: string, visible: boolean) {
  const profile = await requireCreator();
  const supabase = await createClient();
  await supabase.from("payment_pages").update({ storefront_visible: visible }).eq("id", pageId).eq("creator_id", profile.id);
  refresh(profile.handle);
}

export async function movePage(pageId: string, direction: "up" | "down") {
  const profile = await requireCreator();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_pages")
    .select("id")
    .eq("creator_id", profile.id)
    .neq("status", "archived")
    .order("storefront_position")
    .order("created_at", { ascending: false });
  const list = data ?? [];
  const i = list.findIndex((p) => p.id === pageId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((p, index) => supabase.from("payment_pages").update({ storefront_position: index }).eq("id", p.id)));
  refresh(profile.handle);
}
