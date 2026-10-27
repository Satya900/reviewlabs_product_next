"use client";

import { useEffect, useRef } from "react";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: Fbq; disablePushState?: boolean };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const initialised = new Set<string>();
let scriptPromise: Promise<void> | null = null;

// Standard Meta Pixel bootstrap: a queueing stub, then the real script.
function loadPixelScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
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
  scriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.onload = () => resolve();
    script.onerror = () => resolve(); // Blocked by an ad blocker: CAPI still covers us.
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function initPixel(pixelId: string): Promise<void> {
  const ready = loadPixelScript();
  if (!initialised.has(pixelId)) {
    initialised.add(pixelId);
    // Turn off Meta's automatic event detection, which guesses events from
    // button clicks (e.g. reports "Buy now" as Subscribe). We send every event ourselves.
    window.fbq?.("set", "autoConfig", false, pixelId);
    window.fbq?.("init", pixelId);
  }
  return ready;
}

// custom: an event that isn't one of Meta's standard events.
export function trackPixel(pixelId: string | null, event: string, data: Record<string, unknown>, eventId: string, custom = false) {
  if (!pixelId || !window.fbq) return;
  window.fbq(custom ? "trackSingleCustom" : "trackSingle", pixelId, event, data, { eventID: eventId });
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

// _fbp / _fbc cookies improve CAPI match quality. Build fbc from fbclid if needed.
export function getMetaCookies(): { fbp?: string; fbc?: string } {
  const fbp = readCookie("_fbp");
  let fbc = readCookie("_fbc");
  if (!fbc) {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
  }
  return { fbp, fbc };
}

export function newEventId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

type Props = {
  pixelId: string | null;
  pageId: string;
  // Fires PageView + ViewContent (browser and server). Off for the success page.
  trackPageEvents?: boolean;
  content?: { name: string; value: number; currency: string };
};

export function MetaPixel({ pixelId, pageId, trackPageEvents = true, content }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (!pixelId || fired.current) return;
    fired.current = true;

    const ready = initPixel(pixelId);
    if (!trackPageEvents) return;

    const pageViewId = newEventId("pv");
    const viewContentId = newEventId("vc");
    trackPixel(pixelId, "PageView", {}, pageViewId);
    if (content) {
      trackPixel(
        pixelId,
        "ViewContent",
        { content_ids: [pageId], content_name: content.name, content_type: "product", value: content.value, currency: content.currency },
        viewContentId,
      );
    }

    // Mirror to CAPI once the script has had a chance to set _fbp.
    ready.then(() => {
      const cookies = getMetaCookies();
      const send = (eventName: string, eventId: string) =>
        fetch("/api/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageId, eventName, eventId, sourceUrl: window.location.href, ...cookies }),
          keepalive: true,
        }).catch(() => {});
      send("PageView", pageViewId);
      if (content) send("ViewContent", viewContentId);
    });
  }, [pixelId, pageId, trackPageEvents, content]);

  return null;
}
