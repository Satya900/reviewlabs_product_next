import crypto from "node:crypto";

// Signed, expiring email-verification tokens. Pure (no app imports) so it can be
// unit tested; src/lib/email-verification.ts supplies the key.
// Token = base64url({ u: user id, e: sha256(email), x: expiry }) + "." + HMAC.
// The email hash makes a link stop working if the email changes, and keeps the
// address out of the URL.

export const TOKEN_TTL_SECONDS = 7 * 24 * 3600;

export type VerificationClaim = { userId: string; emailHash: string };

export function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function sign(key: Buffer, body: string): string {
  return crypto.createHmac("sha256", key).update(body).digest("base64url");
}

export function createToken(key: Buffer, userId: string, email: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: userId, e: hashEmail(email), x: Math.floor(now / 1000) + TOKEN_TTL_SECONDS })).toString("base64url");
  return `${body}.${sign(key, body)}`;
}

// Null if the token was tampered with, is malformed or has expired.
export function readToken(key: Buffer, token: string, now = Date.now()): VerificationClaim | null {
  if (token.length > 1000) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = Buffer.from(sign(key, body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.u !== "string" || typeof data.e !== "string" || typeof data.x !== "number") return null;
    if (data.x * 1000 < now) return null;
    return { userId: data.u, emailHash: data.e };
  } catch {
    return null;
  }
}
