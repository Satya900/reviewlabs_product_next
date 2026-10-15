"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Thin bar at the top of the page from the moment a link is clicked until the
// new page has rendered. Also shown for form posts that navigate.
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  const done = useCallback(() => {
    if (safety.current) clearTimeout(safety.current);
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setWidth(100);
    setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 300);
  }, []);

  const start = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    setVisible(true);
    setWidth(12);
    // Creep towards 90% so long loads still look alive.
    timer.current = setInterval(() => setWidth((w) => (w < 90 ? w + (90 - w) * 0.08 : w)), 200);
    // If the click never changes the URL (same page, failed request), don't hang.
    if (safety.current) clearTimeout(safety.current);
    safety.current = setTimeout(done, 10000);
  }, [done]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    }
    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement;
      const action = form.getAttribute("action");
      // Server-action forms (React sets a javascript: action) show button spinners instead.
      if (e.defaultPrevented || action?.startsWith("javascript:")) return;
      if (action || form.method.toLowerCase() === "get") start();
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [start]);

  // The URL changed: the new page is on screen.
  useEffect(() => {
    if (timer.current) done();
  }, [pathname, search, done]);

  if (!visible) return null;
  return <div className="nav-progress" style={{ width: `${width}%`, opacity: width >= 100 ? 0 : 1 }} aria-hidden />;
}
