"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { buttonClass, cx } from "@/components/ui";
import { initPixel, trackPixel } from "@/components/meta-pixel";

type Props = {
  orderId: string;
  initialStatus: string;
  title: string;
  amountLabel: string;
  thankYouMessage: string;
  files: { id: string; file_name: string; size_bytes: number }[];
  pixel: { pixelId: string | null; eventId: string; data: Record<string, unknown> };
  retryHref: string;
};

const POLL_MS = 2000;
const MAX_WAIT_MS = 3 * 60 * 1000;

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function OrderStatusView({ orderId, initialStatus, title, amountLabel, thankYouMessage, files, pixel, retryHref }: Props) {
  const hasFiles = files.length > 0;
  const [status, setStatus] = useState(initialStatus);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const [links, setLinks] = useState<{ id: string; label: string; url: string }[]>([]);
  const [timedOut, setTimedOut] = useState(false);
  const purchaseFired = useRef(false);

  const isPaid = status === "paid" || status === "partially_refunded";

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    async function poll() {
      while (!stopped) {
        const res = await fetch(`/api/orders/${orderId}/status`, { cache: "no-store" }).catch(() => null);
        const data = res?.ok ? await res.json() : null;
        if (data) {
          setStatus(data.status);
          setDownloadToken(data.downloadToken);
          setLinks(Array.isArray(data.links) ? data.links : []);
          // "failed" can be a stale earlier attempt, so keep polling until paid or timeout.
          if (["paid", "partially_refunded", "refunded"].includes(data.status)) return;
        }
        if (Date.now() - started > MAX_WAIT_MS) {
          setTimedOut(true);
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    }
    poll();
    return () => {
      stopped = true;
    };
  }, [orderId]);

  // Browser half of the Purchase event; the server sends the same eventId via CAPI.
  useEffect(() => {
    if (!isPaid || !pixel.pixelId || purchaseFired.current) return;
    purchaseFired.current = true;
    const key = `purchase_sent_${orderId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    initPixel(pixel.pixelId);
    trackPixel(pixel.pixelId, "Purchase", pixel.data, pixel.eventId);
  }, [isPaid, orderId, pixel]);

  if (isPaid) {
    return (
      <div className="overflow-hidden rounded-3xl bg-canvas shadow-soft ring-1 ring-hairline">
        <div className="relative bg-dark px-8 py-10 text-white">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/40 blur-[90px]" />
          <span className="relative flex size-12 items-center justify-center rounded-full bg-up">
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden><path d="m5 12 4.5 4.5L19 7" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <h1 className="display relative mt-5 text-[36px]">Payment received</h1>
          <p className="relative mt-2 text-on-dark-soft">{title} · <span className="num text-white">{amountLabel}</span></p>
        </div>
        <div className="space-y-6 p-8">
          {hasFiles && downloadToken && (
            <div>
              <p className="text-[16px] font-semibold">Your files</p>
              <ul className="mt-3 divide-y divide-hairline-soft rounded-2xl border border-hairline">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block break-all text-[15px] font-medium">{f.file_name}</span>
                      <span className="num text-[12px] text-muted">{formatSize(f.size_bytes)}</span>
                    </span>
                    <a href={`/api/download/${downloadToken}/${f.id}`} className={cx(buttonClass.primary, "h-10 shrink-0 text-[14px]")}>Download</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {links.length > 0 && (
            <div>
              <p className="text-[16px] font-semibold">Your links</p>
              <ul className="mt-3 divide-y divide-hairline-soft rounded-2xl border border-hairline">
                {links.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="min-w-0 break-words text-[15px] font-medium">{l.label}</span>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className={cx(buttonClass.primary, "h-10 shrink-0 text-[14px]")}>Open</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {thankYouMessage && <p className="whitespace-pre-wrap rounded-2xl bg-surface-soft p-4 text-[15px] text-ink">{thankYouMessage}</p>}
          <p className="text-[14px] text-muted">
            {hasFiles || links.length
              ? `We've also emailed ${hasFiles && links.length ? "your files and links" : hasFiles ? "the files" : "your links"} to you. You can come back any time.`
              : "We've emailed you a confirmation."}
            {(hasFiles || links.length > 0) && downloadToken && (
              <> <Link href={`/d/${downloadToken}`} className="link">Open your downloads page</Link></>
            )}
          </p>
        </div>
      </div>
    );
  }

  if ((status === "failed" && timedOut) || status === "refunded") {
    return (
      <div className="rounded-3xl bg-canvas p-8 shadow-soft ring-1 ring-hairline">
        <h1 className="display text-[32px]">{status === "failed" ? "Payment didn't go through" : "Order refunded"}</h1>
        <p className="mt-3 text-[16px] text-body">If money left your account for this order, your bank will return it automatically, usually within 5 to 7 working days.</p>
        <Link href={retryHref} className={cx(buttonClass.primary, "mt-6")}>Try again</Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-canvas p-8 shadow-soft ring-1 ring-hairline">
      {!timedOut && <span className="block size-10 animate-spin rounded-full border-[3px] border-surface-strong border-t-primary" />}
      <h1 className="display mt-5 text-[32px]">{timedOut ? "Still confirming your payment" : "Confirming your payment"}</h1>
      <p className="mt-3 text-[16px] text-body">
        {timedOut
          ? "This is taking longer than usual. If the payment went through, your receipt and download link will arrive by email. You can close this page."
          : "This usually takes a few seconds. Please keep this page open."}
      </p>
      <p className="num mt-4 text-[12px] text-muted">Order {orderId}</p>
    </div>
  );
}
