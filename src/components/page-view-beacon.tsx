"use client";

import { useEffect } from "react";

// Counts one view per page per browser session for creator analytics.
export function PageViewBeacon({ pageId }: { pageId: string }) {
  useEffect(() => {
    const key = `viewed_${pageId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch("/api/views", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageId }),
      keepalive: true,
    }).catch(() => {});
  }, [pageId]);
  return null;
}
