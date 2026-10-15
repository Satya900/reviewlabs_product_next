"use client";

import { useEffect } from "react";
import { initPixel, newEventId, trackPixel } from "@/components/meta-pixel";

// Browser PageView for the creator's own pixel on their storefront.
export function StorefrontPixel({ pixelId }: { pixelId: string | null }) {
  useEffect(() => {
    if (!pixelId) return;
    void initPixel(pixelId).then(() => trackPixel(pixelId, "PageView", {}, newEventId("pv")));
  }, [pixelId]);
  return null;
}
