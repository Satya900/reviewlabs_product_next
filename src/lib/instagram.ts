import "server-only";
import { env } from "@/lib/env";

// Meta's Graph API for the Instagram API with Unified Login. Requests go to
// graph.facebook.com with the creator's business integration system user
// token, using their Instagram professional account ID in the path.

export class GraphError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number, readonly subcode?: number) {
    super(message);
  }
}

const api = (path: string) => `${env.metaGraphBase()}/${env.metaGraphVersion()}${path}`;

async function graph<T>(path: string, init: { method?: string; token?: string; params?: Record<string, string>; body?: unknown } = {}): Promise<T> {
  const url = new URL(api(path));
  for (const [k, v] of Object.entries(init.params ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { error?: { message?: string; code?: number; error_subcode?: number } } | null;
  if (!res.ok || json?.error) {
    const e = json?.error;
    throw new GraphError(e?.message ?? `Instagram API error (HTTP ${res.status})`, res.status, e?.code, e?.error_subcode);
  }
  return json as T;
}

// Where the creator logs in with Instagram or Facebook and picks the account.
export function loginUrl(redirectUri: string, state: string): string {
  const url = new URL(`https://www.facebook.com/${env.metaGraphVersion()}/dialog/oauth`);
  url.searchParams.set("client_id", env.metaAppId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("config_id", env.metaLoginConfigId());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("override_default_response_type", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const data = await graph<{ access_token: string }>("/oauth/access_token", {
    params: { client_id: env.metaAppId(), client_secret: env.metaAppSecret(), redirect_uri: redirectUri, code },
  });
  return data.access_token;
}

export type IgAccount = { id: string; username?: string; name?: string; profile_picture_url?: string };

// The Instagram accounts the creator gave us access to during login.
export async function assignedAccounts(token: string): Promise<IgAccount[]> {
  const data = await graph<{ data: { id: string; username?: string }[] }>("/me/assigned_instagram_accounts", { token, params: { fields: "id,username" } });
  return data.data ?? [];
}

export async function accountProfile(token: string, igUserId: string): Promise<IgAccount> {
  return graph<IgAccount>(`/${igUserId}`, { token, params: { fields: "id,username,name,profile_picture_url" } });
}

export const WEBHOOK_FIELDS = "comments,messages";

export async function subscribeWebhooks(token: string, igUserId: string): Promise<void> {
  await graph(`/${igUserId}/subscribed_apps`, { method: "POST", token, params: { subscribed_fields: WEBHOOK_FIELDS } });
}

export async function unsubscribeWebhooks(token: string, igUserId: string): Promise<void> {
  await graph(`/${igUserId}/subscribed_apps`, { method: "DELETE", token });
}

export type IgMedia = { id: string; caption?: string; media_type?: string; media_url?: string; thumbnail_url?: string; permalink?: string; timestamp?: string };

export async function recentMedia(token: string, igUserId: string, limit = 24): Promise<IgMedia[]> {
  const data = await graph<{ data: IgMedia[] }>(`/${igUserId}/media`, {
    token,
    params: { fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp", limit: String(limit) },
  });
  return data.data ?? [];
}

export type IgComment = { id: string; text?: string; timestamp?: string; from?: { id: string; username?: string } };

export async function mediaComments(token: string, mediaId: string): Promise<IgComment[]> {
  const data = await graph<{ data: IgComment[] }>(`/${mediaId}/comments`, { token, params: { fields: "id,text,timestamp,from", limit: "50" } });
  return data.data ?? [];
}

// A DM to the person who wrote the comment. Instagram allows one per comment,
// within 7 days of it.
export async function sendPrivateReply(token: string, igUserId: string, commentId: string, text: string): Promise<string | null> {
  const data = await graph<{ message_id?: string }>(`/${igUserId}/messages`, {
    method: "POST",
    token,
    body: { recipient: { comment_id: commentId }, message: { text } },
  });
  return data.message_id ?? null;
}

// A public reply under the comment.
export async function replyToComment(token: string, commentId: string, message: string): Promise<string | null> {
  const data = await graph<{ id?: string }>(`/${commentId}/replies`, { method: "POST", token, params: { message } });
  return data.id ?? null;
}

// The token no longer works: the creator removed the app, changed their
// password, or moved the account to another business portfolio.
export function isTokenProblem(e: unknown): boolean {
  return e instanceof GraphError && (e.code === 190 || e.code === 102 || e.status === 401);
}
