import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { TOKEN_TTL_SECONDS, createToken, hashEmail, readToken } from "../src/lib/verification-token.ts";

const key = crypto.randomBytes(32);
const id = "4f1c2a9e-0000-4000-8000-000000000001";

test("a fresh token reads back the user and email hash", () => {
  const claim = readToken(key, createToken(key, id, "Creator@Example.com"));
  assert.deepEqual(claim, { userId: id, emailHash: hashEmail("creator@example.com") });
});

test("the email is not readable from the token", () => {
  const token = createToken(key, id, "creator@example.com");
  assert.ok(!Buffer.from(token.split(".")[0], "base64url").toString().includes("creator@example.com"));
});

test("expired tokens are refused", () => {
  const now = Date.now();
  const token = createToken(key, id, "a@b.co", now);
  assert.ok(readToken(key, token, now + (TOKEN_TTL_SECONDS - 60) * 1000));
  assert.equal(readToken(key, token, now + (TOKEN_TTL_SECONDS + 1) * 1000), null);
});

test("tampered, re-signed with another key, or malformed tokens are refused", () => {
  const token = createToken(key, id, "a@b.co");
  const [body, sig] = token.split(".");
  const forgedBody = Buffer.from(JSON.stringify({ u: "someone-else", e: hashEmail("a@b.co"), x: 9e9 })).toString("base64url");
  assert.equal(readToken(key, `${forgedBody}.${sig}`), null);
  assert.equal(readToken(crypto.randomBytes(32), token), null);
  assert.equal(readToken(key, createToken(crypto.randomBytes(32), id, "a@b.co")), null);
  for (const bad of ["", ".", body, `${body}.`, `${token}.x`, "x".repeat(2000), `${body}.${sig.slice(1)}`]) assert.equal(readToken(key, bad), null, bad.slice(0, 20));
});
