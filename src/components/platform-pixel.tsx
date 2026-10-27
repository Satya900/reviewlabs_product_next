"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initPixel, newEventId, trackPixel } from "@/components/meta-pixel";
import { PLATFORM_EVENT_COOKIE, platformPixelId } from "@/lib/platform-pixel";

// Reviewlabs' own pixel, for our ads. Only rendered on our marketing pages and
// the creator dashboard, never on creators' public pages, which use their own pixels.

const pageContent: Record<string, string> = {
  "/pricing": "Pricing",
  "/features": "Features",
  "/compare/superprofile": "Compare Superprofile",
  "/import": "Import from Superprofile",
};

// Fires a conversion the server already sent (same event ID), then clears it.
function firePendingEvent(pixelId: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${PLATFORM_EVENT_COOKIE}=([^;]*)`));
  if (!match) return;
  document.cookie = `${PLATFORM_EVENT_COOKIE}=; path=/; max-age=0`;
  const [event, eventId] = decodeURIComponent(match[1]).split(":");
  if (!eventId) return;
  if (event === "CompleteRegistration") trackPixel(pixelId, event, { content_name: "Creator signup" }, eventId);
  if (event === "PublishPage") trackPixel(pixelId, event, { content_name: "First live page" }, eventId, true);
}

// pageViews: PageView (and ViewContent on key pages) on every route change.
// Off in the dashboard, where only conversions are sent.
export function PlatformPixel({ pageViews = true }: { pageViews?: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!platformPixelId) return;
    const pixelId = platformPixelId;
    initPixel(pixelId);
    firePendingEvent(pixelId);
    if (!pageViews) return;
    trackPixel(pixelId, "PageView", {}, newEventId("pv"));
    const content = pageContent[pathname];
    if (content) trackPixel(pixelId, "ViewContent", { content_name: content, content_type: "product" }, newEventId("vc"));
  }, [pathname, pageViews]);

  return null;
}

// Browser half of a plan purchase; the server sends the same event ID.
export function trackPlatformEvent(event: "Subscribe" | "Purchase", eventId: string, data: Record<string, unknown>) {
  if (!platformPixelId) return;
  initPixel(platformPixelId);
  trackPixel(platformPixelId, event, data, eventId);
}
