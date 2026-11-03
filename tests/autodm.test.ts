import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { buildDm, containsKeyword, parseKeywords, pickAutomation, pickPublicReply, withinReplyWindow, type AutomationRule } from "../src/lib/autodm.ts";
import { createState, parseSignedRequest, readState, verifyWebhookSignature } from "../src/lib/meta-signature.ts";

const rule = (over: Partial<AutomationRule>): AutomationRule => ({ id: "r", active: true, postScope: "all", mediaIds: [], matchMode: "keywords", keywords: ["pdf"], ...over });
const comment = (text: string, over = {}) => ({ commentId: "c1", mediaId: "m1", text, fromId: "u9", accountId: "acct", ...over });

test("keywords are trimmed, lowercased, deduplicated and capped", () => {
  assert.deepEqual(parseKeywords(" PDF, Guide\nfree  pdf ,pdf,, "), ["pdf", "guide", "free pdf"]);
  assert.equal(parseKeywords(Array.from({ length: 30 }, (_, i) => `k${i}`).join(",")).length, 20);
  assert.deepEqual(parseKeywords("x".repeat(41)), []);
});

test("a keyword matches as a whole word or phrase, in any case and script", () => {
  assert.ok(containsKeyword("Please send the PDF!!", "pdf"));
  assert.ok(containsKeyword("pdf", "PDF"));
  assert.ok(containsKeyword("I want the free pdf please", "free pdf"));
  assert.ok(!containsKeyword("send pdfs", "pdf"));
  assert.ok(!containsKeyword("updf", "pdf"));
  assert.ok(containsKeyword("मुझे गाइड चाहिए", "गाइड"));
  assert.ok(containsKeyword("yes 🔥", "🔥"));
});

test("picks the matching automation; a rule for this post beats an all-posts rule", () => {
  const all = rule({ id: "all" });
  const post = rule({ id: "post", postScope: "selected", mediaIds: ["m1"] });
  const other = rule({ id: "other", postScope: "selected", mediaIds: ["m2"] });
  assert.equal(pickAutomation([all, post, other], comment("pdf"))?.id, "post");
  assert.equal(pickAutomation([all, other], comment("pdf"))?.id, "all");
  assert.equal(pickAutomation([all], comment("hello")), null);
  assert.equal(pickAutomation([rule({ matchMode: "any" })], comment("nice reel"))?.id, "r");
  assert.equal(pickAutomation([rule({ matchMode: "any" })], comment("  ")), null);
  assert.equal(pickAutomation([rule({ active: false })], comment("pdf")), null);
});

test("never answers the creator's own comments", () => {
  assert.equal(pickAutomation([rule({})], comment("pdf", { fromId: "acct" })), null);
});

test("DM text gets the link on its own line and is capped", () => {
  assert.equal(buildDm(" Here you go ", "https://reviewlabs.space/go/abc"), "Here you go\n\nhttps://reviewlabs.space/go/abc");
  assert.equal(buildDm("Hi", null), "Hi");
  assert.equal(buildDm("x".repeat(2000), null).length, 900);
});

test("public reply variation is stable per comment", () => {
  const replies = ["Sent!", "Check your DMs", ""];
  assert.equal(pickPublicReply(replies, "c42"), pickPublicReply(replies, "c42"));
  assert.ok(["Sent!", "Check your DMs"].includes(pickPublicReply(replies, "c42")!));
  assert.equal(pickPublicReply(["", " "], "c1"), null);
});

test("private replies only within 7 days of the comment", () => {
  const now = Date.parse("2026-11-10T00:00:00Z");
  assert.ok(withinReplyWindow(new Date("2026-11-04T00:00:00Z"), now));
  assert.ok(!withinReplyWindow(new Date("2026-11-02T23:59:00Z"), now));
});

test("webhook signatures are checked against the app secret", () => {
  const body = '{"object":"instagram"}';
  const good = "sha256=" + crypto.createHmac("sha256", "s3cret").update(body).digest("hex");
  assert.ok(verifyWebhookSignature("s3cret", body, good));
  assert.ok(!verifyWebhookSignature("other", body, good));
  assert.ok(!verifyWebhookSignature("s3cret", body + " ", good));
  assert.ok(!verifyWebhookSignature("s3cret", body, null));
  assert.ok(!verifyWebhookSignature("s3cret", body, "sha1=abc"));
});

test("login state must be genuine, fresh and from the same browser", () => {
  const key = crypto.randomBytes(32), now = Date.now();
  const s = createState(key, "user-1", "nonce-a", now);
  assert.equal(readState(key, s, "nonce-a", now), "user-1");
  assert.equal(readState(key, s, "nonce-b", now), null);
  assert.equal(readState(key, s, undefined, now), null);
  assert.equal(readState(crypto.randomBytes(32), s, "nonce-a", now), null);
  assert.equal(readState(key, s, "nonce-a", now + 16 * 60_000), null);
  assert.equal(readState(key, s.replace(/.$/, (c) => (c === "A" ? "B" : "A")), "nonce-a", now), null);
});

test("signed_request from Meta is verified before use", () => {
  const payload = Buffer.from(JSON.stringify({ user_id: "123", algorithm: "HMAC-SHA256" })).toString("base64url");
  const sig = crypto.createHmac("sha256", "s3cret").update(payload).digest("base64url");
  assert.deepEqual(parseSignedRequest("s3cret", `${sig}.${payload}`), { user_id: "123", algorithm: "HMAC-SHA256" });
  assert.equal(parseSignedRequest("other", `${sig}.${payload}`), null);
  assert.equal(parseSignedRequest("s3cret", "garbage"), null);
});
