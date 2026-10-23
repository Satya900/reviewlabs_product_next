import type { ErrorEvent } from "@sentry/nextjs";

// Shared by the browser, Node and Edge Sentry setups. Errors only (no
// performance tracing), and none of the data that can hold buyers' details or
// logins: no request bodies, cookies, user info, local variables or DB data.
const TOKEN_PATHS: [RegExp, string][] = [
  [/\/d\/[^/?#]+/g, "/d/[token]"], // buyer download links
  [/([?&](t|token|code)=)[^&#]+/g, "$1[filtered]"], // verify-email and other one-time links
];

function scrubUrl(url: string | undefined) {
  return url ? TOKEN_PATHS.reduce((u, [re, to]) => u.replace(re, to), url) : url;
}

export function sentryOptions(environment: string | undefined) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return {
    dsn,
    enabled: Boolean(dsn),
    // SENTRY_DEBUG=1 prints what the SDK sends (for checking the setup).
    debug: process.env.SENTRY_DEBUG === "1",
    environment: environment ?? "development",
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["user-agent", "content-type", "referer"] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    beforeSend(event: ErrorEvent) {
      if (event.request) {
        event.request.url = scrubUrl(event.request.url);
        if (event.request.headers?.referer) event.request.headers.referer = scrubUrl(event.request.headers.referer)!;
      }
      for (const b of event.breadcrumbs ?? []) {
        if (typeof b.data?.url === "string") b.data.url = scrubUrl(b.data.url);
        if (typeof b.data?.to === "string") b.data.to = scrubUrl(b.data.to);
        if (typeof b.data?.from === "string") b.data.from = scrubUrl(b.data.from);
      }
      return event;
    },
  };
}

export { scrubUrl as scrubSentryUrl };
