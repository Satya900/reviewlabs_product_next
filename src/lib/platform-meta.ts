import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/request";
import { ATTR_COOKIE, FBC_COOKIE, parseAttribution, type Attribution } from "@/lib/ad-click";
import { platformPixelId } from "@/lib/platform-pixel";

// Reviewlabs' own Meta pixel, for our ads: creators signing up and paying for
// a plan. Never loaded on creators' pages. Server events need META_CAPI_TOKEN;
// without it only the browser Pixel reports them.

// Shared with the browser Pixel so Meta can deduplicate the two sources.
export const platformEventIds = {
  registration: (creatorId: string) => `reg_${creatorId}`,
  // Once per creator: their first plan payment, not renewals or upgrades.
  subscribe: (creatorId: string) => `sub_${creatorId}`,
};

// Browser details from a request made by the creator's own browser.
export type ClickData = { fbp?: string; fbc?: string; client_ip?: string; user_agent?: string; source_url?: string };

// What signup saves on the profile: the UTM tags plus the Meta cookies, so a
// payment reported later by the webhook still matches the ad click.
export type SignupAttribution = Partial<Attribution> & { fbc?: string; fbp?: string };

function readCookies(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    (headers.get("cookie") ?? "").split(/;\s*/).filter(Boolean).map((c) => {
      const i = c.indexOf("=");
      return [c.slice(0, i), safeDecode(c.slice(i + 1))];
    }),
  );
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function clickDataFromHeaders(headers: Headers, sourceUrl?: string): ClickData {
  const cookies = readCookies(headers);
  return {
    fbp: cookies._fbp,
    fbc: cookies[FBC_COOKIE],
    client_ip: clientIp(headers),
    user_agent: headers.get("user-agent") ?? undefined,
    source_url: sourceUrl ?? headers.get("referer") ?? env.appUrl(),
  };
}

export function signupAttributionFromHeaders(headers: Headers): SignupAttribution | null {
  const cookies = readCookies(headers);
  const a: SignupAttribution = { ...parseAttribution(cookies[ATTR_COOKIE]) };
  if (cookies[FBC_COOKIE]) a.fbc = cookies[FBC_COOKIE].slice(0, 500);
  if (cookies._fbp) a.fbp = cookies._fbp.slice(0, 100);
  return Object.keys(a).length ? a : null;
}

function userData(creatorId: string, click: ClickData, profile: { email?: string | null; name?: string | null } | null) {
  const data: Record<string, unknown> = { external_id: [sha256(creatorId)] };
  if (profile?.email) data.em = [sha256(profile.email.trim().toLowerCase())];
  if (profile?.name) {
    const parts = profile.name.trim().toLowerCase().split(/\s+/);
    data.fn = [sha256(parts[0])];
    if (parts.length > 1) data.ln = [sha256(parts[parts.length - 1])];
  }
  if (click.client_ip) data.client_ip_address = click.client_ip;
  if (click.user_agent) data.client_user_agent = click.user_agent;
  if (click.fbp) data.fbp = click.fbp;
  if (click.fbc) data.fbc = click.fbc;
  return data;
}

type PlatformEvent = {
  eventName: "CompleteRegistration" | "Subscribe";
  eventId: string;
  creatorId: string;
  click?: ClickData;
  customData?: Record<string, unknown>;
};

// Sends a server event to our pixel once per event ID. The first caller claims
// the platform_events row, so two requests (or Checkout and the webhook) never
// both send it.
async function sendPlatformEvent(event: PlatformEvent): Promise<void> {
  const token = process.env.META_CAPI_TOKEN;
  if (!platformPixelId || !token) return;

  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("platform_events")
    .upsert({ creator_id: event.creatorId, event_name: event.eventName, event_id: event.eventId }, { onConflict: "event_name,event_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const { data: profile } = await admin.from("profiles").select("email, name, signup_attribution").eq("id", event.creatorId).maybeSingle();
  // The webhook has no browser: fall back to the click saved at signup.
  const saved = (profile?.signup_attribution ?? {}) as SignupAttribution;
  const click: ClickData = { source_url: env.appUrl(), ...event.click };
  click.fbc ??= saved.fbc;
  click.fbp ??= saved.fbp;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: click.source_url,
        user_data: userData(event.creatorId, click, profile),
        custom_data: event.customData,
      },
    ],
  };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  let status: "sent" | "failed" = "failed";
  let response: unknown = null;
  let error: string | null = null;
  try {
    const res = await fetch(`https://graph.facebook.com/${env.metaGraphVersion()}/${encodeURIComponent(platformPixelId)}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    response = await res.json().catch(() => null);
    if (res.ok) status = "sent";
    else error = `HTTP ${res.status}`;
  } catch (e) {
    error = (e as Error).message;
  }
  if (status === "failed") console.warn(`[platform-meta] ${event.eventName} failed:`, error, JSON.stringify(response));
  await admin.from("platform_events").update({ status, last_error: error, response: (response as object) ?? null }).eq("id", claimed.id);
}

// Sent when the signup form creates the account, while we still have this
// browser's ad click.
export function sendRegistrationEvent(creatorId: string, click?: ClickData) {
  return sendPlatformEvent({
    eventName: "CompleteRegistration",
    eventId: platformEventIds.registration(creatorId),
    creatorId,
    click,
    customData: { content_name: "Creator signup" },
  });
}

// The creator's first plan payment, or null when it isn't one (a renewal, an
// upgrade, or someone who paid before). Both Checkout and the webhook ask.
export async function firstPlanPayment(creatorId: string): Promise<{ eventId: string; value: number; plan: string } | null> {
  const admin = createAdminClient();
  const { data: payments } = await admin
    .from("subscription_payments")
    .select("amount_paise")
    .eq("creator_id", creatorId)
    .in("status", ["captured", "authorized"])
    .limit(2);
  if (payments?.length !== 1) return null;
  const { data: profile } = await admin.from("profiles").select("plan").eq("id", creatorId).maybeSingle();
  return { eventId: platformEventIds.subscribe(creatorId), value: payments[0].amount_paise / 100, plan: profile?.plan === "pro" ? "Pro plan" : "Creator plan" };
}

export async function sendSubscribeEvent(creatorId: string, click?: ClickData) {
  const first = await firstPlanPayment(creatorId);
  if (!first) return;
  await sendPlatformEvent({
    eventName: "Subscribe",
    eventId: first.eventId,
    creatorId,
    click,
    customData: { value: first.value, currency: "INR", content_name: first.plan },
  });
}
