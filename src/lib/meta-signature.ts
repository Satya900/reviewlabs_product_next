import crypto from "node:crypto";

// Security checks for Meta: webhook signatures and the signed `state` we pass
// through Facebook Login. Pure (no app imports) so it can be unit tested.

// Meta signs every webhook body with the app secret: "sha256=<hex>".
export function verifyWebhookSignature(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

// `state` for the login redirect: who started it, a nonce that must match the
// browser's cookie, and an expiry. base64url(json) + "." + HMAC.
export const STATE_TTL_SECONDS = 15 * 60;

function sign(key: Buffer, body: string): string {
  return crypto.createHmac("sha256", key).update(body).digest("base64url");
}

export function createState(key: Buffer, userId: string, nonce: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: userId, n: nonce, x: Math.floor(now / 1000) + STATE_TTL_SECONDS })).toString("base64url");
  return `${body}.${sign(key, body)}`;
}

// The user ID if the state is genuine, unexpired and was started in this
// browser (nonce matches its cookie); otherwise null.
export function readState(key: Buffer, state: string, nonce: string | undefined, now = Date.now()): string | null {
  if (!nonce || state.length > 1000) return null;
  const [body, sig, extra] = state.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = Buffer.from(sign(key, body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.u !== "string" || typeof data.n !== "string" || typeof data.x !== "number") return null;
    if (data.x * 1000 < now || data.n !== nonce) return null;
    return data.u;
  } catch {
    return null;
  }
}

// Meta's signed_request (data deletion and deauthorise callbacks):
// base64url(signature) + "." + base64url(json), HMAC-SHA256 with the app secret.
export function parseSignedRequest(appSecret: string, signedRequest: string): Record<string, unknown> | null {
  const [sig, payload, extra] = signedRequest.split(".");
  if (!sig || !payload || extra !== undefined) return null;
  const expected = crypto.createHmac("sha256", appSecret).update(payload).digest();
  const given = Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}
