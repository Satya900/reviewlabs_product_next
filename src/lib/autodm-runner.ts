import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { buildDm, pickAutomation, pickPublicReply, withinReplyWindow, type AutomationRule, type CommentEvent } from "@/lib/autodm";
import { isTokenProblem, mediaComments, recentMedia, replyToComment, sendPrivateReply } from "@/lib/instagram";
import { creatorHasPro } from "@/lib/plans-server";

// Answers comments on a creator's Instagram posts. Called from the webhook
// (instant) and from the sync (a fallback that reads recent comments).

type AutomationRow = {
  id: string;
  active: boolean;
  post_scope: "all" | "selected";
  media_ids: string[];
  match_mode: "keywords" | "any";
  keywords: string[];
  dm_message: string;
  link_kind: "none" | "page" | "url";
  page_id: string | null;
  link_url: string | null;
  public_reply_enabled: boolean;
  public_replies: string[];
  created_at: string;
};

const toRule = (a: AutomationRow): AutomationRule & { row: AutomationRow } => ({
  id: a.id,
  active: a.active,
  postScope: a.post_scope,
  mediaIds: a.media_ids,
  matchMode: a.match_mode,
  keywords: a.keywords,
  row: a,
});

async function loadAccount(igUserId: string) {
  const db = createAdminClient();
  const { data: account } = await db.from("instagram_accounts").select("id, creator_id, ig_user_id, status").eq("ig_user_id", igUserId).maybeSingle();
  if (!account) return null;
  const { data: tok } = await db.from("instagram_tokens").select("token_encrypted").eq("account_id", account.id).maybeSingle();
  if (!tok) return null;
  return { ...account, token: decrypt(tok.token_encrypted) };
}

async function destination(a: AutomationRow): Promise<string | null> {
  if (a.link_kind === "url") return a.link_url;
  if (a.link_kind === "page" && a.page_id) {
    const { data: page } = await createAdminClient().from("payment_pages").select("slug, status").eq("id", a.page_id).maybeSingle();
    return page?.status === "live" ? `${env.appUrl()}/p/${page.slug}` : null;
  }
  return null;
}

async function markTokenBroken(accountId: string, message: string) {
  await createAdminClient().from("instagram_accounts").update({ status: "error", last_error: message }).eq("id", accountId);
}

export type CommentResult = "no_account" | "no_plan" | "no_match" | "duplicate" | "skipped" | "sent" | "failed";

export async function handleComment(event: CommentEvent): Promise<CommentResult> {
  const account = await loadAccount(event.igUserId);
  if (!account) return "no_account";
  // AutoDM is a Pro feature (the trial includes it).
  if (!(await creatorHasPro(account.creator_id))) return "no_plan";
  const db = createAdminClient();

  const { data: rows } = await db
    .from("dm_automations")
    .select("id, active, post_scope, media_ids, match_mode, keywords, dm_message, link_kind, page_id, link_url, public_reply_enabled, public_replies, created_at")
    .eq("creator_id", account.creator_id)
    .eq("active", true)
    .order("created_at");
  // Comments the sync reads back must be newer than the automation, so turning
  // one on never messages people who commented before. (Instagram's and our
  // clocks differ by seconds, so this isn't applied to webhook comments,
  // which are always new.)
  const commentedAt = event.timestamp ? Date.parse(event.timestamp) : Date.now();
  const eligible = ((rows ?? []) as AutomationRow[]).filter((a) => !event.fromSync || Date.parse(a.created_at) <= commentedAt);
  const match = pickAutomation(eligible.map(toRule), {
    commentId: event.commentId,
    mediaId: event.mediaId,
    text: event.text,
    fromId: event.fromId,
    accountId: event.igUserId,
  });
  if (!match) return "no_match";
  const automation = match.row;
  const target = await destination(automation);

  // Claim the comment first: a webhook retry or the sync finding it again
  // must never send a second DM.
  const { data: claimed } = await db
    .from("dm_events")
    .upsert(
      {
        creator_id: account.creator_id,
        automation_id: automation.id,
        comment_id: event.commentId,
        media_id: event.mediaId,
        commenter_id: event.fromId,
        commenter_username: event.fromUsername ?? null,
        comment_text: event.text.slice(0, 2000),
        link_url: target,
      },
      { onConflict: "comment_id", ignoreDuplicates: true },
    )
    .select("id, click_token")
    .maybeSingle();
  if (!claimed) return "duplicate";

  if (event.timestamp && !withinReplyWindow(new Date(event.timestamp))) {
    await db.from("dm_events").update({ status: "skipped", error: "Comment is older than 7 days" }).eq("id", claimed.id);
    return "skipped";
  }

  const link = target ? `${env.appUrl()}/go/${claimed.click_token}` : null;
  try {
    const messageId = await sendPrivateReply(account.token, account.ig_user_id, event.commentId, buildDm(automation.dm_message, link));
    await db.from("dm_events").update({ status: "sent", message_id: messageId, sent_at: new Date().toISOString() }).eq("id", claimed.id);
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    await db.from("dm_events").update({ status: "failed", error: message }).eq("id", claimed.id);
    if (isTokenProblem(e)) await markTokenBroken(account.id, message);
    console.warn(`[autodm] DM for comment ${event.commentId} failed:`, message);
    return "failed";
  }

  if (automation.public_reply_enabled) {
    const reply = pickPublicReply(automation.public_replies, event.commentId);
    if (reply) {
      try {
        const replyId = await replyToComment(account.token, event.commentId, reply);
        await db.from("dm_events").update({ public_reply_id: replyId }).eq("id", claimed.id);
      } catch (e) {
        // The DM went out; a failed public reply is noted, not retried.
        await db.from("dm_events").update({ error: `Public reply failed: ${(e as Error).message.slice(0, 400)}` }).eq("id", claimed.id);
      }
    }
  }
  return "sent";
}

// Fallback for missed webhooks (and for testing before Meta sends comment
// webhooks): read recent comments on the posts the creator's automations
// watch and answer any that haven't been answered.
export async function syncAccount(creatorId: string): Promise<{ checked: number; sent: number }> {
  const db = createAdminClient();
  const { data: acct } = await db.from("instagram_accounts").select("id, ig_user_id").eq("creator_id", creatorId).maybeSingle();
  if (!acct || !(await creatorHasPro(creatorId))) return { checked: 0, sent: 0 };
  const account = await loadAccount(acct.ig_user_id);
  if (!account) return { checked: 0, sent: 0 };

  const { data: rows } = await db.from("dm_automations").select("post_scope, media_ids").eq("creator_id", creatorId).eq("active", true);
  if (!rows?.length) return { checked: 0, sent: 0 };

  const mediaIds = new Set<string>();
  for (const r of rows) for (const m of r.media_ids as string[]) mediaIds.add(m);
  try {
    if (rows.some((r) => r.post_scope === "all")) for (const m of await recentMedia(account.token, account.ig_user_id, 10)) mediaIds.add(m.id);
  } catch (e) {
    if (isTokenProblem(e)) await markTokenBroken(account.id, (e as Error).message.slice(0, 500));
    throw e;
  }

  let checked = 0, sent = 0;
  for (const mediaId of mediaIds) {
    const comments = await mediaComments(account.token, mediaId).catch(() => []);
    for (const c of comments) {
      if (!c.text || !c.from?.id) continue;
      if (c.timestamp && !withinReplyWindow(new Date(c.timestamp))) continue;
      checked++;
      const result = await handleComment({ igUserId: account.ig_user_id, commentId: c.id, mediaId, text: c.text, fromId: c.from.id, fromUsername: c.from.username, timestamp: c.timestamp, fromSync: true });
      if (result === "sent") sent++;
    }
  }
  await db.from("instagram_accounts").update({ last_synced_at: new Date().toISOString() }).eq("id", account.id);
  return { checked, sent };
}

// Every connected account with an active automation, within a time budget so
// the reconcile job finishes.
export async function syncAllAccounts(budgetMs = 30_000): Promise<{ sent: number; errors: number }> {
  const started = Date.now();
  const db = createAdminClient();
  const [{ data: accounts }, { data: withRules }] = await Promise.all([
    db.from("instagram_accounts").select("creator_id").eq("status", "active").order("last_synced_at", { ascending: true, nullsFirst: true }).limit(200),
    db.from("dm_automations").select("creator_id").eq("active", true),
  ]);
  const active = new Set((withRules ?? []).map((r) => r.creator_id as string));
  let sent = 0, errors = 0;
  for (const a of accounts ?? []) {
    if (Date.now() - started > budgetMs) break;
    if (!active.has(a.creator_id)) continue;
    try {
      sent += (await syncAccount(a.creator_id)).sent;
    } catch (e) {
      errors++;
      console.error(`[autodm] sync for creator ${a.creator_id}:`, (e as Error).message);
    }
  }
  return { sent, errors };
}
