"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCreator } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "../../actions";

const schema = z.object({
  page_id: z.uuid(),
  support_email: z.union([z.email("Enter a valid support email").max(200), z.literal("")]),
  refund_policy: z.string().trim().max(3000, "Keep the refund policy under 3,000 characters"),
  terms: z.string().trim().max(3000, "Keep the terms under 3,000 characters"),
});

// RLS restricts the update to the creator's own pages.
export async function savePolicies(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireCreator();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { page_id, support_email, refund_policy, terms } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_pages")
    .update({ support_email: support_email ? support_email.toLowerCase() : null, refund_policy, terms })
    .eq("id", page_id);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/pages/${page_id}`);
  return { ok: "Saved" };
}
