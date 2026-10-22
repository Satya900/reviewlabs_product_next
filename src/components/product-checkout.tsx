"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";

// Where the checkout lives on a product page.
// Wide (desktop): a sticky card beside the content, as before.
// Narrow (phone): a bar pinned to the bottom with the price and the buy button;
// tapping it opens the checkout as a full screen. The phone's back button
// closes it, like a separate page, without losing what the buyer typed.
// Sizes follow the container, so the editor's phone preview behaves the same.
export function ProductCheckout({
  priceLabel,
  buttonLabel,
  preview,
  children,
}: {
  priceLabel: string;
  buttonLabel: string;
  preview?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pushed = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  const show = useCallback(() => {
    setOpen(true);
    if (!preview) {
      window.history.pushState({ ...window.history.state, checkout: true }, "");
      pushed.current = true;
    }
  }, [preview]);

  const hide = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back(); // popstate closes it
    } else {
      setOpen(false);
    }
  }, []);

  // Back button / swipe back closes the checkout instead of leaving the page.
  useEffect(() => {
    if (preview) return;
    const onPop = () => {
      pushed.current = false;
      setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [preview]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && hide();
    window.addEventListener("keydown", onKey);
    // Stop the page behind from scrolling while the checkout is open.
    const lock = !preview && window.innerWidth < 900;
    const previous = document.body.style.overflow;
    if (lock) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      if (lock) document.body.style.overflow = previous;
    };
  }, [open, preview, hide]);

  return (
    <>
      <div
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label={open ? "Checkout" : undefined}
        className={cx(
          "@3xl:static @3xl:block @3xl:overflow-visible @3xl:bg-transparent",
          open ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-canvas" : "hidden",
        )}
      >
        {open && (
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-5 @3xl:hidden">
            <p className="text-[14px] font-semibold uppercase tracking-wider">Checkout</p>
            <button
              ref={closeButton}
              type="button"
              onClick={hide}
              aria-label="Close checkout"
              className="-mr-2 flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface-soft"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
        <div className={cx(open && "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain @3xl:block @3xl:overflow-visible")}>
          {children}
          <p className="mt-4 hidden text-center text-[13px] text-muted @3xl:block">Payments secured by Razorpay · UPI, cards, netbanking</p>
        </div>
      </div>

      {/* Phone: price and buy button pinned to the bottom of the screen. */}
      {!open && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas/95 px-5 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] backdrop-blur pb-[max(12px,env(safe-area-inset-bottom))] @3xl:hidden">
          <div className="mx-auto flex max-w-[560px] items-center gap-4">
            <div className="shrink-0">
              <p className="text-[12px] text-muted">Total</p>
              <p className="num text-[20px] font-semibold leading-tight">{priceLabel}</p>
            </div>
            <button
              type="button"
              onClick={show}
              className="flex h-13 min-w-0 flex-1 items-center justify-between gap-3 rounded-full bg-primary px-6 text-[16px] font-semibold text-white transition active:scale-[0.98] active:bg-primary-active"
            >
              <span className="truncate">{buttonLabel}</span>
              <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
