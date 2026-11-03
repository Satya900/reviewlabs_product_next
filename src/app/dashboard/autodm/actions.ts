"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePlan } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { MAX_DM_LENGTH, MAX_PUBLIC_REPLIES, parseKeywords } from "@/lib/autodm";
import { cleanLinkUrl } from "@/lib/product-links";
import { unsubscribeWebhooks } from "@/lib/instagram";
import { syncAccount } from "@/lib/autodm-runner";
import { rateLimit } from "@/lib/rate-limit";
import { hasProPlan } from "@/lib/plans";

export type ActionState = { error?: string; ok?: string } | null;

const schema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Give the automation a name").max(80),
  post_scope: z.enum(["all", "selected"]),
  media: z.string().default("[]"),
  match_mode: z.enum(["keywords", "any"]),
  keywords: z.string().default(""),
  dm_message: z.string().trim().min(1, "Write the DM people will get").max(MAX_DM_LENGTH, `Keep the DM under ${MAX_DM_LENGTH} characters`),
  link_kind: z.enum(["none", "page", "url"]),
  page_id: z.string().default(""),
  link_url: z.string().trim().default(""),
  public_reply_enabled: z.literal("on").optional(),
  active: z.literal("on").optional(),
});

const mediaSchema = z.array(z.object({ id: z.string().regex(/^\d{5,30}$/), thumb: z.string().max(2000).optional(), caption: z.string().max(300).optional() })).max(50);

export async function saveAutomation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requirePlan();
  if (!hasProPlan(profile)) return { error: "AutoDM is part of the Pro plan. Choose Pro in Plan and billing to use it." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;

  let media: z.infer<typeof mediaSchema> = [];
  try {
    media = mediaSchema.parse(JSON.parse(input.media));
  } catch {
    return { error: "Couldn't read the chosen posts. Pick them again." };
  }
  if (input.post_scope === "selected" && !media.length) return { error: "Pick at least one post or reel, or choose \"Any post or reel\"." };

  const keywords = parseKeywords(input.keywords);
  if (input.match_mode === "keywords" && !keywords.length) return { error: "Add at least one keyword, e.g. PDF" };

  let linkUrl: string | null = null;
  if (input.link_kind === "url") {
    linkUrl = cleanLinkUrl(input.link_url);
    if (!linkUrl) return { error: "Enter a link starting with https://" };
  }
  if (input.link_kind === "page" && !input.page_id) return { error: "Choose the product to send" };

  const publicReplies = formData.getAll("public_reply").map((v) => String(v).trim().slice(0, 200)).filter(Boolean).slice(0, MAX_PUBLIC_REPLIES);
  if (input.public_reply_enabled && !publicReplies.length) return { error: "Write at least one public reply, or turn public replies off" };

  const row = {
    creator_id: profile.id,
    name: input.name,
    active: input.active === "on",
    post_scope: input.post_scope,
    media_ids: input.post_scope === "selected" ? media.map((m) => m.id) : [],
    media_previews: input.post_scope === "selected" ? media : [],
    match_mode: input.match_mode,
    keywords: input.match_mode === "keywords" ? keywords : [],
    dm_message: input.dm_message,
    link_kind: input.link_kind,
    page_id: input.link_kind === "page" ? input.page_id : null,
    link_url: linkUrl,
    public_reply_enabled: input.public_reply_enabled === "on",
    public_replies: publicReplies,
  };

  const supabase = await createClient();
  const { error } = input.id
    ? await supabase.from("dm_automations").update(row).eq("id", input.id)
    : await supabase.from("dm_automations").insert(row);
  if (error) return { error: error.message.includes("row-level security") ? "That product isn't one of yours." : "Couldn't save. Please try again." };
  revalidatePath("/dashboard/autodm");
  redirect("/dashboard/autodm?saved=1");
}

export async function setAutomationActive(id: string, active: boolean) {
  await requirePlan();
  const supabase = await createClient();
  await supabase.from("dm_automations").update({ active }).eq("id", id);
  revalidatePath("/dashboard/autodm");
}

export async function deleteAutomation(id: string) {
  await requirePlan();
  const supabase = await createClient();
  await supabase.from("dm_automations").delete().eq("id", id);
  revalidatePath("/dashboard/autodm");
  redirect("/dashboard/autodm");
}

// Removes the Instagram connection, its token and every automation and log.
export async function disconnectInstagram() {
  const profile = await requirePlan();
  const db = createAdminClient();
  const { data: account } = await db.from("instagram_accounts").select("id, ig_user_id").eq("creator_id", profile.id).maybeSingle();
  if (account) {
    const { data: tok } = await db.from("instagram_tokens").select("token_encrypted").eq("account_id", account.id).maybeSingle();
    if (tok) await unsubscribeWebhooks(decrypt(tok.token_encrypted), account.ig_user_id).catch(() => {});
    await db.from("instagram_accounts").delete().eq("id", account.id);
  }
  await db.from("dm_automations").delete().eq("creator_id", profile.id);
  await db.from("dm_events").delete().eq("creator_id", profile.id);
  revalidatePath("/dashboard/autodm");
  redirect("/dashboard/autodm?ig=disconnected");
}

// "Check now": read recent comments and answer any the webhook missed.
export async function syncNow(): Promise<ActionState> {
  const profile = await requirePlan();
  if (!hasProPlan(profile)) return { error: "AutoDM is part of the Pro plan." };
  if (!(await rateLimit(`autodm-sync:${profile.id}`, 6, 600))) return { error: "Checked a few times already. Try again in a few minutes." };
  try {
    const { checked, sent } = await syncAccount(profile.id);
    revalidatePath("/dashboard/autodm");
    return { ok: sent ? `Checked ${checked} recent comments and sent ${sent} DM${sent === 1 ? "" : "s"}.` : `Checked ${checked} recent comments. Nothing new to answer.` };
  } catch (e) {
    return { error: `Instagram didn't answer: ${(e as Error).message}` };
  }
}
