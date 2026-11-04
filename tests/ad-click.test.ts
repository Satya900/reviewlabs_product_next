import { test } from "node:test";
import assert from "node:assert/strict";
import { attributionFrom, attributionLabel, fbcFor, parseAttribution } from "../src/lib/ad-click.ts";

const now = new Date("2026-11-04T10:00:00.000Z");

test("builds _fbc in Meta's format from an ad click", () => {
  assert.equal(fbcFor("IwAR2abc_DEF-123", undefined, 1700000000000), "fb.1.1700000000000.IwAR2abc_DEF-123");
});

test("keeps the existing _fbc for the same click, replaces it for a new one", () => {
  assert.equal(fbcFor("IwAR2abc_DEF-123", "fb.1.1690000000000.IwAR2abc_DEF-123"), null);
  assert.equal(fbcFor("IwAR2newclick99", "fb.1.1690000000000.IwAR2abc_DEF-123", 5), "fb.1.5.IwAR2newclick99");
});

test("ignores missing or malformed click IDs", () => {
  assert.equal(fbcFor(null, undefined), null);
  assert.equal(fbcFor("", undefined), null);
  assert.equal(fbcFor("short", undefined), null);
  assert.equal(fbcFor("has spaces in it here", undefined), null);
  assert.equal(fbcFor("abc;def=ghi1234", undefined), null);
});

test("reads UTM tags from an ad link", () => {
  const url = new URL("https://reviewlabs.space/pricing?utm_source=Facebook&utm_medium=paid&utm_campaign=Launch%20Nov&utm_content=reel-1&utm_term=creators&fbclid=IwAR2abc_DEF-123");
  assert.deepEqual(attributionFrom(url, now), {
    source: "facebook",
    medium: "paid",
    campaign: "Launch Nov",
    content: "reel-1",
    term: "creators",
    landing: "/pricing",
    at: "2026-11-04T10:00:00.000Z",
  });
});

test("a Meta click without UTM tags counts as meta, a plain visit counts as nothing", () => {
  assert.deepEqual(attributionFrom(new URL("https://reviewlabs.space/?fbclid=IwAR2abc_DEF-123"), now), { source: "meta", landing: "/", at: "2026-11-04T10:00:00.000Z" });
  assert.equal(attributionFrom(new URL("https://reviewlabs.space/pricing"), now), null);
  assert.equal(attributionFrom(new URL("https://reviewlabs.space/?fbclid=bad"), now), null);
});

test("round-trips through the cookie and rejects junk", () => {
  const a = attributionFrom(new URL("https://reviewlabs.space/?utm_source=ig&utm_campaign=x"), now);
  assert.deepEqual(parseAttribution(JSON.stringify(a)), a);
  assert.equal(parseAttribution(undefined), null);
  assert.equal(parseAttribution("not json"), null);
  assert.equal(parseAttribution(JSON.stringify({ source: 1 })), null);
  assert.deepEqual(parseAttribution(JSON.stringify({ source: "fb", landing: "/", at: "t", campaign: 5, evil: "x" })), { source: "fb", landing: "/", at: "t" });
});

test("labels attribution for the admin table", () => {
  assert.equal(attributionLabel(null), "Direct or unknown");
  assert.equal(attributionLabel({ source: "facebook", medium: "paid", campaign: "Launch" }), "facebook / paid / Launch");
  assert.equal(attributionLabel({ source: "meta" }), "meta");
});
