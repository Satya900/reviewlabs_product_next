"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Last-resort error screen when the root layout itself fails.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "-apple-system, system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, color: "#0a0b0d" }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 20 }}>
          <h1 style={{ fontWeight: 400, fontSize: 36, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#5b616e" }}>Please try again. If you just paid, your payment is safe and your files will arrive by email.</p>
          <button onClick={reset} style={{ background: "#0052ff", color: "#fff", border: 0, borderRadius: 100, padding: "12px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
