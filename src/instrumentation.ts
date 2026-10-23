import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

// Error tracking on the server. Off until NEXT_PUBLIC_SENTRY_DSN is set, so
// local development sends nothing. What's collected: src/lib/sentry-options.ts.
export async function register() {
  const options = sentryOptions(process.env.VERCEL_ENV);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      ...options,
      // Failures we already log with console.error ("[checkout] …", "[payouts] …")
      // become Sentry issues too, so handled problems aren't missed.
      integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
    });
  }
  if (process.env.NEXT_RUNTIME === "edge") Sentry.init(options);
}

// Errors thrown while rendering pages, server actions and route handlers.
export const onRequestError = Sentry.captureRequestError;
