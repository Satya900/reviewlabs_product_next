import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry-options";

// Error tracking in the browser (same rules as the server). No session
// replays: checkout pages show buyers' names, emails and phone numbers.
Sentry.init({
  ...sentryOptions(process.env.NEXT_PUBLIC_VERCEL_ENV),
  // Browser noise that isn't our bug.
  ignoreErrors: ["ResizeObserver loop", "Non-Error promise rejection captured", /Loading chunk \d+ failed/],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
