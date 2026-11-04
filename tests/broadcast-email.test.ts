import { test } from "node:test";
import assert from "node:assert/strict";
import { broadcastFrom, paragraphs, renderBroadcast } from "../src/lib/broadcast-email.ts";

test("paragraphs split on blank lines", () => {
  assert.deepEqual(paragraphs("Hi all,\n\nNew guide is out.\nGrab it.\r\n\r\n\n Thanks "), ["Hi all,", "New guide is out.\nGrab it.", "Thanks"]);
});

test("render escapes text, links https URLs, adds button and unsubscribe", () => {
  const { html, text } = renderBroadcast(
    { subject: "s", body: "<b>Hi</b> & welcome\n\nSee https://reviewlabs.space/p/guide.", buttonLabel: "Get the guide", buttonUrl: "https://reviewlabs.space/p/guide", creatorName: "Satya" },
    "https://reviewlabs.space/u/tok123",
  );
  assert.ok(html.includes("&lt;b&gt;Hi&lt;/b&gt; &amp; welcome"));
  assert.ok(html.includes('<a href="https://reviewlabs.space/p/guide" style="color:#0052ff;">https://reviewlabs.space/p/guide</a>.'));
  assert.ok(html.includes(">Get the guide</a>"));
  assert.ok(html.includes('href="https://reviewlabs.space/u/tok123"'));
  assert.ok(text.includes("Get the guide: https://reviewlabs.space/p/guide"));
  assert.ok(text.endsWith("Unsubscribe: https://reviewlabs.space/u/tok123"));
});

test("no button without both label and URL", () => {
  assert.ok(!renderBroadcast({ subject: "s", body: "x", buttonLabel: "Go", buttonUrl: null, creatorName: "A" }, "u").html.includes("border-radius:100px"));
});

test("from: creator name via Reviewlabs on the platform address", () => {
  assert.equal(broadcastFrom("Satya M", "Reviewlabs <no-reply@reviewlabs.space>"), '"Satya M via Reviewlabs" <no-reply@reviewlabs.space>');
  assert.equal(broadcastFrom('Evil"<x>\n', "no-reply@reviewlabs.space"), '"Evilx via Reviewlabs" <no-reply@reviewlabs.space>');
  assert.equal(broadcastFrom("", "no-reply@reviewlabs.space"), '"A creator via Reviewlabs" <no-reply@reviewlabs.space>');
});
