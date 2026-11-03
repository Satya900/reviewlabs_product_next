import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { recentMedia } from "@/lib/instagram";
import type { MediaOption } from "./automation-draft";

// What the automation form needs: the creator's recent posts and products.
// Without a connected Instagram account there's nothing to automate.
export async function loadFormData(creatorId: string) {
  const db = createAdminClient();
  const { data: account } = await db.from("instagram_accounts").select("id, ig_user_id").eq("creator_id", creatorId).maybeSingle();
  if (!account) redirect("/dashboard/autodm");

  let media: MediaOption[] = [];
  let mediaError: string | null = null;
  try {
    const { data: tok } = await db.from("instagram_tokens").select("token_encrypted").eq("account_id", account.id).single();
    media = (await recentMedia(decrypt(tok!.token_encrypted), account.ig_user_id, 24)).map((m) => ({
      id: m.id,
      thumb: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url,
      caption: m.caption?.slice(0, 300),
    }));
  } catch (e) {
    mediaError = `Couldn't load your posts from Instagram (${(e as Error).message}). You can still use "Any post or reel".`;
  }

  const supabase = await createClient();
  const { data: pages } = await supabase.from("payment_pages").select("id, title, status").eq("creator_id", creatorId).neq("status", "archived").order("created_at", { ascending: false });
  return { media, mediaError, pages: pages ?? [] };
}
