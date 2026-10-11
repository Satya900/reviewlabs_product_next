"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "../../actions";

const schema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  page_id: z.uuid(),
  question: z.string().trim().min(1, "Enter a question").max(150, "Keep the question under 150 characters"),
  answer: z.string().trim().min(1, "Enter an answer").max(1000, "Keep the answer under 1,000 characters"),
});

function refresh(pageId: string) {
  revalidatePath(`/dashboard/pages/${pageId}`);
}

// RLS limits every write to FAQs on the creator's own pages.
export async function saveFaq(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireCreator();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, page_id, question, answer } = parsed.data;
  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from("page_faqs").update({ question, answer }).eq("id", id).eq("page_id", page_id);
    if (error) return { error: error.message };
  } else {
    const { count } = await supabase.from("page_faqs").select("id", { count: "exact", head: true }).eq("page_id", page_id);
    const { error } = await supabase.from("page_faqs").insert({ page_id, question, answer, position: count ?? 0 });
    if (error) return { error: error.message.includes("faq_limit") ? "A page can show up to 20 FAQs." : error.message };
  }
  refresh(page_id);
  return { ok: id ? "Question updated" : "Question added" };
}

export async function deleteFaq(id: string, pageId: string) {
  await requireCreator();
  const supabase = await createClient();
  await supabase.from("page_faqs").delete().eq("id", id).eq("page_id", pageId);
  refresh(pageId);
}

export async function moveFaq(id: string, pageId: string, direction: "up" | "down") {
  await requireCreator();
  const supabase = await createClient();
  const { data } = await supabase.from("page_faqs").select("id").eq("page_id", pageId).order("position").order("created_at");
  const list = data ?? [];
  const i = list.findIndex((f) => f.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((f, index) => supabase.from("page_faqs").update({ position: index }).eq("id", f.id)));
  refresh(pageId);
}
