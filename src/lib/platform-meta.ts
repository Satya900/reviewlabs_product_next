import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { postMetaEvent, type MetaEventName } from "@/lib/meta";
import { clientIp } from "@/lib/request";
import type { Tracking } from "@/lib/types";

// Reviewlabs' own Meta pixel, for our ads (creators signing up and upgrading).
// Separate from the creators' pixels in meta.ts, and never loaded on their pages.

// Shared with the browser Pixel so Meta can deduplicate the two sources.
export const platformEventIds = {
  registration: (creatorId: string) => `reg_${creatorId}`,
  subscribe: (subscriptionId: string) => `sub_${subscriptionId}`,
  lifetime: (orderId: string) => `lifetime_${orderId}`,
  firstPage: (creatorId: string) => `page_${creatorId}`,
};

// Browser details from a request made by the creator's own browser.
export function trackingFromRequest(request: Request, sourceUrl?: string): Tracking {
  return trackingFromHeaders(request.headers, sourceUrl);
}

export function trackingFromHeaders(headers: Headers, sourceUrl?: string): Tracking {
  const cookies = Object.fromEntries(
    (headers.get("cookie") ?? "").split(/;\s*/).filter(Boolean).map((c) => {
      const i = c.indexOf("=");
      return [c.slice(0, i), safeDecode(c.slice(i + 1))];
    }),
  );
  return {
    fbp: cookies._fbp,
    fbc: cookies._fbc,
    client_ip: clientIp(headers),
    user_agent: headers.get("user-agent") ?? undefined,
    source_url: sourceUrl ?? headers.get("referer") ?? env.appUrl(),
  };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type PlatformEvent = {
  eventName: Extract<MetaEventName, "CompleteRegistration" | "Subscribe" | "Purchase" | "PublishPage">;
  eventId: string;
  creatorId: string;
  tracking?: Tracking;
  customData?: Record<string, unknown>;
};

// Sends a server event to our pixel once per event ID. The first caller claims
// the meta_events row, so two requests (or the webhook and reconcile) never
// both send it.
// Without META_CAPI_TOKEN only the browser Pixel reports these events.
export async function sendPlatformEvent(event: PlatformEvent): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return;

  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("meta_events")
    .upsert({ creator_id: event.creatorId, event_name: event.eventName, event_id: event.eventId, status: "pending" }, { onConflict: "event_name,event_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const { data: profile } = await admin.from("profiles").select("email, name").eq("id", event.creatorId).maybeSingle();
  const result = await postMetaEvent(
    { pixelId, token, testCode: process.env.META_TEST_EVENT_CODE || null },
    {
      eventName: event.eventName,
      eventId: event.eventId,
      tracking: event.tracking ?? { source_url: env.appUrl() },
      buyer: { email: profile?.email ?? undefined, name: profile?.name ?? undefined },
      customData: event.customData,
    },
  );
  if (result.status === "failed") console.warn(`[platform-meta] ${event.eventName} failed:`, result.error);
  await admin
    .from("meta_events")
    .update({ status: result.status, attempts: 1, last_error: result.error ?? null, response: (result.response as object) ?? null })
    .eq("id", claimed.id);
}

// Sent when the signup form creates the account (email verification comes
// later and is often done on another device, which loses the ad click).
export function sendRegistrationEvent(creatorId: string, tracking?: Tracking) {
  return sendPlatformEvent({ eventName: "CompleteRegistration", eventId: platformEventIds.registration(creatorId), creatorId, tracking, customData: { content_name: "Creator signup" } });
}

// A creator's first live product page: the sign they're actually using
// Reviewlabs. Custom event; in Ads Manager, make a custom conversion from it.
export function sendFirstPageEvent(creatorId: string, tracking?: Tracking) {
  return sendPlatformEvent({ eventName: "PublishPage", eventId: platformEventIds.firstPage(creatorId), creatorId, tracking, customData: { content_name: "First live page" } });
}

// First charge of a Creator subscription. Renewals aren't sent; Meta should
// optimise for new subscribers.
export function sendSubscribeEvent(creatorId: string, subscriptionId: string, amountPaise: number, tracking?: Tracking) {
  return sendPlatformEvent({
    eventName: "Subscribe",
    eventId: platformEventIds.subscribe(subscriptionId),
    creatorId,
    tracking,
    customData: { value: amountPaise / 100, currency: "INR", content_name: "Creator plan" },
  });
}

export function sendLifetimeEvent(creatorId: string, orderId: string, amountPaise: number, tracking?: Tracking) {
  return sendPlatformEvent({
    eventName: "Purchase",
    eventId: platformEventIds.lifetime(orderId),
    creatorId,
    tracking,
    customData: { value: amountPaise / 100, currency: "INR", content_name: "Creator lifetime", content_type: "product", content_ids: ["creator_lifetime"] },
  });
}
