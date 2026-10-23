"use client";

import Link from "next/link";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { buttonClass } from "@/components/ui";

// Shown when a page throws. Payments are recorded by webhooks, so a page
// error never loses an order; the buyer can safely retry or come back.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="max-w-md text-center">
        <h1 className="display text-[40px]">Something went wrong</h1>
        <p className="mt-3 text-[16px] text-body">
          This page hit an unexpected error. If you just paid, your payment is safe and your files will arrive by email.
        </p>
        {error.digest && <p className="num mt-3 text-[12px] text-muted">Reference {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className={buttonClass.primary}>Try again</button>
          <Link href="/" className={buttonClass.secondary}>Home</Link>
        </div>
      </div>
    </main>
  );
}
