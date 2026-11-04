"use client";

import { useEffect } from "react";
import { classifySource } from "@/lib/traffic-source";

// The source of this visit, and the first one this browser session (kept for
// checkout, so a sale is credited to where the buyer first came from).
export function visitSource(): string {
  return classifySource(window.location.href, document.referrer, window.location.host);
}
export function firstSource(): string {
  try {
    const saved = sessionStorage.getItem("rl_src");
    if (saved) return saved;
    const now = visitSource();
    sessionStorage.setItem("rl_src", now);
    return now;
  } catch {
    return visitSource();
  }
}

// Remembers the session's first source (used on the storefront).
export function SourceMemo() {
  useEffect(() => { firstSource(); }, []);
  return null;
}

// Counts one view per page per browser session for creator analytics.
export function PageViewBeacon({ pageId }: { pageId: string }) {
  useEffect(() => {
    firstSource();
    const key = `viewed_${pageId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch("/api/views", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageId, source: visitSource() }),
      keepalive: true,
    }).catch(() => {});
  }, [pageId]);
  return null;
}
