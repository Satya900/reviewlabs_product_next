import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";

// Shared by the account-level Settings form and the per-page tracking form.
export const pixelSchema = z.object({
  pixel_id: z.union([z.string().trim().regex(/^\d{10,20}$/, "Pixel ID is the 15 or 16 digit number from Events Manager"), z.literal("")]),
  capi_token: z.union([z.string().trim().regex(/^[A-Za-z0-9_-]{50,}$/, "That doesn't look like a Conversions API token. It usually starts with EAA."), z.literal("")]),
  test_event_code: z.string().trim().max(50),
});

// Asks Meta whether this token can send events to this pixel. The event has
// deliberately too little customer data: Meta checks the token and pixel
// first, then rejects the event (subcode 2804050) without recording it, so a
// valid token never adds a fake event to the creator's data. Only runs when
// the creator supplied a test code. (A plain GET on the pixel fails with
// "Missing Permission" even for valid Conversions API tokens, so it can't be used.)
export async function checkTokenWithMeta(pixelId: string, token: string, testEventCode: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${env.metaGraphVersion()}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              event_name: "PageView",
              event_time: Math.floor(Date.now() / 1000),
              event_id: `setup_check_${crypto.randomUUID()}`,
              action_source: "website",
              event_source_url: env.appUrl(),
              user_data: { client_user_agent: "Reviewlabs setup check" },
            },
          ],
          test_event_code: testEventCode,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.ok) return null;
    const body = await res.json().catch(() => null);
    const code = body?.error?.code;
    // Token and pixel accepted; only the (intentionally empty) event was refused.
    if (code === 100 && body?.error?.error_subcode === 2804050) return null;
    if (code === 190) return "the token is invalid or has expired";
    if (code === 100 && body?.error?.error_subcode === 33) return "this token doesn't have access to that pixel";
    return body?.error?.message ?? `Meta returned HTTP ${res.status}`;
  } catch {
    // Network trouble shouldn't block saving; the test button will show problems.
    return null;
  }
}
