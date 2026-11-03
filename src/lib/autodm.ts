// AutoDM rules: when someone comments on a creator's Instagram post, decide
// whether an automation answers it and what the DM says. Pure (no app
// imports) so it can be unit tested.

export const MAX_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 40;
export const MAX_PUBLIC_REPLIES = 3;
// Instagram rejects longer messages; leave room for the link.
export const MAX_DM_LENGTH = 900;

export type MatchMode = "keywords" | "any";
export type PostScope = "all" | "selected";

export type AutomationRule = {
  id: string;
  active: boolean;
  postScope: PostScope;
  mediaIds: string[];
  matchMode: MatchMode;
  keywords: string[];
};

export type IncomingComment = {
  commentId: string;
  mediaId: string;
  text: string;
  fromId: string;
  // The Instagram account the comment was made on.
  accountId: string;
};

// "PDF, guide\nfree pdf" → ["pdf", "guide", "free pdf"]
export function parseKeywords(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[,\n]/)) {
    const k = normalize(raw);
    if (k && k.length <= MAX_KEYWORD_LENGTH) seen.add(k);
  }
  return [...seen].slice(0, MAX_KEYWORDS);
}

// Lowercase, Unicode-normalised, punctuation turned into spaces, so "PDF!!" and
// "pdf" match. Letters and numbers in any script (Hindi included) are kept.
export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Extended_Pictographic}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// A keyword matches as a whole word or phrase: "pdf" matches "send pdf pls"
// but not "pdfs" or "updf".
export function containsKeyword(text: string, keyword: string): boolean {
  const k = normalize(keyword);
  if (!k) return false;
  return ` ${normalize(text)} `.includes(` ${k} `);
}

export function ruleMatches(rule: AutomationRule, comment: IncomingComment): boolean {
  if (!rule.active) return false;
  if (rule.postScope === "selected" && !rule.mediaIds.includes(comment.mediaId)) return false;
  if (rule.matchMode === "any") return normalize(comment.text).length > 0;
  return rule.keywords.some((k) => containsKeyword(comment.text, k));
}

// The automation that answers a comment, or null. A rule for this exact post
// wins over an all-posts rule, so a creator can override the default per post.
export function pickAutomation<T extends AutomationRule>(rules: T[], comment: IncomingComment): T | null {
  if (comment.fromId === comment.accountId) return null; // the creator's own replies
  const matching = rules.filter((r) => ruleMatches(r, comment));
  return matching.find((r) => r.postScope === "selected") ?? matching[0] ?? null;
}

export function buildDm(message: string, linkUrl: string | null): string {
  const text = message.trim().slice(0, MAX_DM_LENGTH);
  return linkUrl ? `${text}\n\n${linkUrl}` : text;
}

// One of the creator's public reply variations, picked by the comment ID so a
// retry picks the same one. Varying replies looks less like a bot to Instagram.
export function pickPublicReply(replies: string[], commentId: string): string | null {
  const options = replies.map((r) => r.trim()).filter(Boolean);
  if (!options.length) return null;
  let h = 0;
  for (const ch of commentId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return options[h % options.length];
}

// Instagram allows one private reply per comment, within 7 days of it.
export const PRIVATE_REPLY_WINDOW_MS = 7 * 86_400_000;
export function withinReplyWindow(commentTime: Date, now = Date.now()): boolean {
  return now - commentTime.getTime() < PRIVATE_REPLY_WINDOW_MS;
}

// A comment we may answer, from a webhook or the sync.
export type CommentEvent = {
  igUserId: string; // the account the comment was made on
  commentId: string;
  mediaId: string;
  text: string;
  fromId: string;
  fromUsername?: string;
  timestamp?: string;
  // Read back by the sync, so it may be from before an automation existed.
  // Webhook comments are always new.
  fromSync?: boolean;
};

type CommentValue = { id?: string; text?: string; from?: { id?: string; username?: string }; media?: { id?: string } };
type WebhookPayload = { object?: string; entry?: { id?: string; time?: number; changes?: { field?: string; value?: CommentValue }[] }[] };

// Pulls the comment events out of a notification. Other fields (messages) are
// ignored for now.
export function commentEvents(input: unknown): CommentEvent[] {
  const payload = (input ?? {}) as WebhookPayload;
  if (payload.object !== "instagram") return [];
  const events: CommentEvent[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value;
      if (change.field !== "comments" || !entry.id || !v?.id || !v.media?.id || !v.from?.id || !v.text) continue;
      events.push({
        igUserId: entry.id,
        commentId: v.id,
        mediaId: v.media.id,
        text: v.text,
        fromId: v.from.id,
        fromUsername: v.from.username,
        timestamp: entry.time ? new Date(entry.time * (entry.time > 1e12 ? 1 : 1000)).toISOString() : undefined,
      });
    }
  }
  return events;
}

