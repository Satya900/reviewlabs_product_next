import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySource } from "../src/lib/traffic-source.ts";

const own = "reviewlabs.space";
const page = "https://reviewlabs.space/p/guide";

test("utm_source wins, AutoDM links are credited to AutoDM", () => {
  assert.equal(classifySource(`${page}?utm_source=autodm`, "https://l.instagram.com/", own), "autodm");
  assert.equal(classifySource(`${page}?utm_source=YT`, "", own), "youtube");
  assert.equal(classifySource(`${page}?utm_source=podcast`, "", own), "other");
});

test("referrers map to channels", () => {
  assert.equal(classifySource(page, "https://l.instagram.com/?u=x", own), "instagram");
  assert.equal(classifySource(page, "https://www.instagram.com/", own), "instagram");
  assert.equal(classifySource(page, "https://lm.facebook.com/", own), "facebook");
  assert.equal(classifySource(page, "https://www.youtube.com/", own), "youtube");
  assert.equal(classifySource(page, "https://www.google.co.in/", own), "google");
  assert.equal(classifySource(page, "https://t.co/abc", own), "x");
  assert.equal(classifySource(page, "https://t.me/channel", own), "telegram");
  assert.equal(classifySource(page, "https://someblog.in/post", own), "other");
});

test("own storefront, no referrer, junk", () => {
  assert.equal(classifySource(page, "https://reviewlabs.space/@satya", own), "storefront");
  assert.equal(classifySource(page, "https://www.reviewlabs.space/dashboard", own), "direct");
  assert.equal(classifySource(page, "", own), "direct");
  assert.equal(classifySource(page, "not a url", own), "direct");
});
