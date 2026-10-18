import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import type { Order, Tracking } from "@/lib/types";
import { creatorHasPlan } from "@/lib/plans-server";

export type MetaEventName = "PageView" | "ViewContent" | "InitiateCheckout" | "Purchase" | "Lead";

type Buyer = { email?: string; phone?: string; name?: string };

type MetaEvent = {
  eventName: MetaEventName;
  eventId: string;
  tracking: Tracking;
  buyer?: Buyer;
  customData?: Record<string, unknown>;
};

type SendResult = { status: "sent" | "failed" | "skipped"; response?: unknown; error?: string };

// Shared with the browser Pixel so Meta can deduplicate the two sources.
export const eventIds = {
  initiateCheckout: (orderId: string) => `ic_${orderId}`,
  purchase: (orderId: string) => `purchase_${orderId}`,
  lead: (orderId: string) => `lead_${orderId}`,
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

function userData(tracking: Tracking, buyer?: Buyer) {
  const data: Record<string, unknown> = {};
  if (buyer?.email) {
    const email = buyer.email.trim().toLowerCase();
    data.em = [sha256(email)];
    data.external_id = [sha256(email)];
  }
  if (buyer?.phone) data.ph = [sha256(normalizePhone(buyer.phone))];
  if (buyer?.name) {
    const parts = buyer.name.trim().toLowerCase().split(/\s+/);
    data.fn = [sha256(parts[0])];
    if (parts.length > 1) data.ln = [sha256(parts[parts.length - 1])];
  }
  if (tracking.client_ip) data.client_ip_address = tracking.client_ip;
  if (tracking.user_agent) data.client_user_agent = tracking.user_agent;
  if (tracking.fbp) data.fbp = tracking.fbp;
  if (tracking.fbc) data.fbc = tracking.fbc;
  return data;
}

// Which pixel an event belongs to: the page's own pixel if it has one,
// otherwise the creator's account pixel. A Pixel ID alone is enough for the
// browser; server events also need that pixel's Conversions API token.
export type MetaTarget = { creatorId: string; pageId?: string | null };

type PixelRow = { pixel_id: string | null; capi_token_encrypted: string | null; test_event_code: string | null };

export async function resolvePixelRow(target: MetaTarget): Promise<PixelRow | null> {
  // Meta tracking is a Creator plan feature.
  if (!(await creatorHasPlan(target.creatorId))) return null;
  const admin = createAdminClient();
  if (target.pageId) {
    const { data } = await admin
      .from("page_pixel_settings")
      .select("pixel_id, capi_token_encrypted, test_event_code")
      .eq("page_id", target.pageId)
      .maybeSingle<PixelRow>();
    if (data?.pixel_id) return data;
  }
  const { data } = await admin
    .from("creator_pixel_settings")
    .select("pixel_id, capi_token_encrypted, test_event_code")
    .eq("creator_id", target.creatorId)
    .maybeSingle<PixelRow>();
  return data?.pixel_id ? data : null;
}

async function loadPixel(target: MetaTarget) {
  const row = await resolvePixelRow(target);
  // Pixel-only setups get browser events only.
  if (!row?.capi_token_encrypted) return null;
  return { pixelId: row.pixel_id as string, token: decrypt(row.capi_token_encrypted as string), testCode: row.test_event_code };
}

export async function sendMetaEvent(target: MetaTarget, event: MetaEvent): Promise<SendResult> {
  let pixel;
  try {
    pixel = await loadPixel(target);
  } catch (e) {
    return { status: "failed", error: `pixel settings: ${(e as Error).message}` };
  }
  if (!pixel) return { status: "skipped" };

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.tracking.source_url,
        user_data: userData(event.tracking, event.buyer),
        custom_data: event.customData,
      },
    ],
  };
  if (pixel.testCode) body.test_event_code = pixel.testCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${env.metaGraphVersion()}/${encodeURIComponent(pixel.pixelId)}/events?access_token=${encodeURIComponent(pixel.token)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) },
    );
    const json = await res.json().catch(() => null);
    return res.ok ? { status: "sent", response: json } : { status: "failed", response: json, error: `HTTP ${res.status}` };
  } catch (e) {
    return { status: "failed", error: (e as Error).message };
  }
}

// Lead magnet responses: a Lead event, sent once and logged like order events.
export async function sendLeadResponseEvent(response: {
  id: string;
  creator_id: string;
  magnet_id: string;
  name: string;
  email: string;
  phone: string;
  tracking: Tracking | null;
}, title: string) {
  const admin = createAdminClient();
  const eventId = eventIds.lead(response.id);
  const { data: existing } = await admin.from("meta_events").select("status, attempts").eq("event_name", "Lead").eq("event_id", eventId).maybeSingle();
  if (existing && existing.status !== "failed") return;

  const result = await sendMetaEvent({ creatorId: response.creator_id }, {
    eventName: "Lead",
    eventId,
    tracking: response.tracking ?? {},
    buyer: { email: response.email, phone: response.phone, name: response.name },
    customData: { content_ids: [response.magnet_id], content_name: title, content_type: "product", value: 0, currency: "INR" },
  });
  await admin.from("meta_events").upsert(
    {
      creator_id: response.creator_id,
      event_name: "Lead",
      event_id: eventId,
      status: result.status,
      attempts: (existing?.attempts ?? 0) + 1,
      last_error: result.error ?? null,
      response: (result.response as object) ?? null,
    },
    { onConflict: "event_name,event_id" },
  );
}

// Sends an order-level event once and records the outcome in meta_events.
async function sendLoggedOrderEvent(order: Order, eventName: "InitiateCheckout" | "Purchase", eventId: string) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("meta_events")
    .select("status, attempts")
    .eq("event_name", eventName)
    .eq("event_id", eventId)
    .maybeSingle();
  if (existing && existing.status !== "failed") return;

  const result = await sendMetaEvent({ creatorId: order.creator_id, pageId: order.page_id }, {
    eventName,
    eventId,
    tracking: order.tracking ?? {},
    buyer: { email: order.buyer_email, phone: order.buyer_phone, name: order.buyer_name },
    customData: {
      currency: order.currency,
      value: order.amount_paise / 100,
      content_ids: order.offer_id ? [order.page_id, order.offer_id] : [order.page_id],
      num_items: order.offer_id ? 2 : 1,
      content_name: order.page_title,
      content_type: "product",
      ...(eventName === "Purchase" ? { order_id: order.id } : {}),
    },
  });

  await admin.from("meta_events").upsert(
    {
      creator_id: order.creator_id,
      order_id: order.id,
      event_name: eventName,
      event_id: eventId,
      status: result.status,
      attempts: (existing?.attempts ?? 0) + 1,
      last_error: result.error ?? null,
      response: (result.response as object) ?? null,
    },
    { onConflict: "event_name,event_id" },
  );
}

export function sendInitiateCheckoutEvent(order: Order) {
  return sendLoggedOrderEvent(order, "InitiateCheckout", eventIds.initiateCheckout(order.id));
}

export function sendPurchaseEvent(order: Order) {
  return sendLoggedOrderEvent(order, "Purchase", eventIds.purchase(order.id));
}
