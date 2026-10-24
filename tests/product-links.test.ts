import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanLinkUrl, linkLabelError, suggestLinkLabel } from "../src/lib/product-links.ts";

test("accepts real https links, adds https:// when missing", () => {
  assert.equal(cleanLinkUrl("https://www.notion.so/Template-abc123"), "https://www.notion.so/Template-abc123");
  assert.equal(cleanLinkUrl("  drive.google.com/drive/folders/xyz  "), "https://drive.google.com/drive/folders/xyz");
  assert.equal(cleanLinkUrl("https://chat.whatsapp.com/AbCdEf"), "https://chat.whatsapp.com/AbCdEf");
});

test("refuses unsafe or non-public links", () => {
  for (const bad of ["javascript:alert(1)", "data:text/html,hi", "http://example.com", "https://localhost/x", "https://127.0.0.1/x", "https://user:pw@site.com", "https://nodot", "ftp://x.com", "https://exa mple.com", "", "https://[::1]/"]) {
    assert.equal(cleanLinkUrl(bad), null, bad);
  }
  assert.equal(cleanLinkUrl("https://x.com/" + "a".repeat(2000)), null);
});

test("labels", () => {
  assert.equal(linkLabelError(""), "Give the link a name buyers will recognise, like “Notion template”");
  assert.equal(linkLabelError("x".repeat(81)), "Keep the name under 80 characters");
  assert.equal(linkLabelError("Course login"), null);
  assert.equal(suggestLinkLabel("https://www.notion.so/abc"), "Notion template");
  assert.equal(suggestLinkLabel("https://t.me/+abc"), "Telegram group");
  assert.equal(suggestLinkLabel("https://docs.google.com/x"), "Google Drive");
  assert.equal(suggestLinkLabel("https://mysite.com/course"), "Access link");
});
