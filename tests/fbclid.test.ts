import { test } from "node:test";
import assert from "node:assert/strict";
import { fbcFor } from "../src/lib/fbclid.ts";

test("builds _fbc in Meta's format from an ad click", () => {
  assert.equal(fbcFor("IwAR2abc_DEF-123", undefined, 1700000000000), "fb.1.1700000000000.IwAR2abc_DEF-123");
});

test("keeps the existing cookie for the same click, replaces it for a new one", () => {
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
