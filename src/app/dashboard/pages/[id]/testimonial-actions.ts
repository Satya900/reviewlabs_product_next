"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isAllowedImageSrc } from "@/lib/rich-text";
import { FACES } from "@/components/face-avatar";
import type { ActionState } from "../../actions";

const schema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  page_id: z.uuid(),
  name: z.string().trim().min(1, "Enter a name").max(80, "Name is too long"),
  comment: z.string().trim().min(1, "Enter a comment").max(300, "Keep the comment under 300 characters"),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  avatar_url: z.string().max(1000),
  avatar_face: z.enum(FACES),
});

function refresh(pageId: string) {
  revalidatePath(`/dashboard/pages/${pageId}`);
}

// RLS limits every write to testimonials on the creator's own pages.
export async function saveTestimonial(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireCreator();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;
  if (input.avatar_url && !isAllowedImageSrc(input.avatar_url)) return { error: "Please upload the photo again." };

  const supabase = await createClient();
  const row = {
    name: input.name,
    comment: input.comment,
    rating: input.rating,
    avatar_url: input.avatar_url || null,
    avatar_face: input.avatar_face,
  };

  if (input.id) {
    const { error } = await supabase.from("page_testimonials").update(row).eq("id", input.id).eq("page_id", input.page_id);
    if (error) return { error: error.message };
  } else {
    const { count } = await supabase.from("page_testimonials").select("id", { count: "exact", head: true }).eq("page_id", input.page_id);
    const { error } = await supabase.from("page_testimonials").insert({ ...row, page_id: input.page_id, position: count ?? 0 });
    if (error) return { error: error.message.includes("testimonial_limit") ? "A page can show up to 20 testimonials." : error.message };
  }
  refresh(input.page_id);
  return { ok: input.id ? "Testimonial updated" : "Testimonial added" };
}

export async function deleteTestimonial(id: string, pageId: string) {
  await requireCreator();
  const supabase = await createClient();
  await supabase.from("page_testimonials").delete().eq("id", id).eq("page_id", pageId);
  refresh(pageId);
}

// Swaps a testimonial with its neighbour.
export async function moveTestimonial(id: string, pageId: string, direction: "up" | "down") {
  await requireCreator();
  const supabase = await createClient();
  const { data } = await supabase.from("page_testimonials").select("id, position").eq("page_id", pageId).order("position").order("created_at");
  const list = data ?? [];
  const i = list.findIndex((t) => t.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((t, index) => supabase.from("page_testimonials").update({ position: index }).eq("id", t.id)));
  refresh(pageId);
}
