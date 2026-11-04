"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PLATFORM_EVENT_COOKIE, platformPixelId } from "@/lib/platform-pixel";

// Reviewlabs' own Meta pixel, for our ads. Only rendered on our marketing
// pages and the creator dashboard, never on creators' public pages.

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: Fbq; disablePushState?: boolean };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let started = false;

// Standard Meta Pixel bootstrap: a queueing stub, then the real script.
function initPixel(pixelId: string) {
  if (started) return;
  started = true;
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    // Next.js changes pages client-side; without this the Pixel reports every
    // route change as an extra PageView on top of the ones we send.
    fbq.disablePushState = true;
    window.fbq = fbq;
    window._fbq = fbq;
  }
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script); // Blocked by an ad blocker: CAPI still covers conversions.
  // Turn off Meta's automatic event detection, which guesses events from
  // button clicks. We send every event ourselves.
  window.fbq("set", "autoConfig", false, pixelId);
  window.fbq("init", pixelId);
}

function track(event: string, data: Record<string, unknown>, eventId: string) {
  if (!platformPixelId) return;
  initPixel(platformPixelId);
  window.fbq?.("trackSingle", platformPixelId, event, data, { eventID: eventId });
}

const newEventId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const pageContent: Record<string, string> = {
  "/pricing": "Pricing",
  "/features": "Features",
  "/how-it-works": "How it works",
  "/compare/superprofile": "Compare Superprofile",
  "/import": "Import from Superprofile",
  "/signup": "Signup",
};

// Fires a conversion the server already sent (same event ID), then clears it.
function firePendingEvent() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${PLATFORM_EVENT_COOKIE}=([^;]*)`));
  if (!match) return;
  document.cookie = `${PLATFORM_EVENT_COOKIE}=; path=/; max-age=0`;
  const [event, eventId] = decodeURIComponent(match[1]).split(":");
  if (event === "CompleteRegistration" && eventId) track(event, { content_name: "Creator signup" }, eventId);
}

// pageViews: PageView (and ViewContent on key pages) on every route change.
// Off in the dashboard, where only conversions are sent.
export function PlatformPixel({ pageViews = true }: { pageViews?: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!platformPixelId) return;
    initPixel(platformPixelId);
    firePendingEvent();
    if (!pageViews) return;
    track("PageView", {}, newEventId("pv"));
    const content = pageContent[pathname];
    if (content) track("ViewContent", { content_name: content, content_type: "product" }, newEventId("vc"));
  }, [pathname, pageViews]);

  return null;
}

// Browser-only funnel step: the creator opened the plan checkout.
export function trackCheckoutStart(plan: string, value: number) {
  track("InitiateCheckout", { content_name: plan, value, currency: "INR" }, newEventId("ic"));
}

// Browser half of the first plan payment; the server sends the same event ID.
export function trackSubscribe(eventId: string, data: { value: number; plan: string }) {
  track("Subscribe", { value: data.value, currency: "INR", content_name: data.plan }, eventId);
}
