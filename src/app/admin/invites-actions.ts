"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteState = { error?: string; ok?: string } | null;

const schema = z.object({ email: z.email("Enter a valid email").max(200), note: z.string().trim().max(200).optional() });

export async function addInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const email = parsed.data.email.toLowerCase();

  const { error } = await createAdminClient()
    .from("creator_invites")
    .upsert({ email, invited_by: admin.id, note: parsed.data.note || null }, { onConflict: "email" });
  if (error) return { error: error.message };
  revalidatePath("/admin/invites");
  return { ok: `${email} can now log in at /login` };
}

export async function removeInvite(email: string) {
  await requireAdmin();
  await createAdminClient().from("creator_invites").delete().eq("email", email.toLowerCase());
  revalidatePath("/admin/invites");
}
