import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubSentryUrl, sentryOptions } from "../src/lib/sentry-options.ts";

test("one-time links are scrubbed before reaching Sentry", () => {
  assert.equal(scrubSentryUrl("https://reviewlabs.space/d/abc123XYZ?x=1"), "https://reviewlabs.space/d/[token]?x=1");
  assert.equal(scrubSentryUrl("https://reviewlabs.space/auth/verify-email?t=eyJ.sig"), "https://reviewlabs.space/auth/verify-email?t=[filtered]");
  assert.equal(scrubSentryUrl("/auth/confirm?type=signup&token=abc&next=/dashboard"), "/auth/confirm?type=signup&token=[filtered]&next=/dashboard");
  assert.equal(scrubSentryUrl("/dashboard/orders?filter=paid"), "/dashboard/orders?filter=paid");
  assert.equal(scrubSentryUrl(undefined), undefined);
});

test("off without a DSN; errors only and nothing personal when on", () => {
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  assert.equal(sentryOptions("production").enabled, false);
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://k@o1.ingest.sentry.io/1";
  const o = sentryOptions(undefined);
  assert.equal(o.enabled, true);
  assert.equal(o.environment, "development");
  assert.equal(o.tracesSampleRate, 0);
  assert.deepEqual([o.dataCollection.cookies, o.dataCollection.userInfo, o.dataCollection.httpBodies, o.dataCollection.stackFrameVariables], [false, false, [], false]);
  const ev = o.beforeSend({ type: undefined, request: { url: "https://x/d/secret", headers: { referer: "https://x/auth/verify-email?t=s" } }, breadcrumbs: [{ data: { url: "/d/zzz" } }] } as never);
  assert.equal(ev.request!.url, "https://x/d/[token]");
  assert.equal(ev.request!.headers!.referer, "https://x/auth/verify-email?t=[filtered]");
  assert.equal(ev.breadcrumbs![0].data!.url, "/d/[token]");
});
