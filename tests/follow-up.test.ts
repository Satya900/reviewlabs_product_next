import { test } from "node:test";
import assert from "node:assert/strict";
import { browserParams, cleanSearch, followUpLinks, followUpMessage, istDayEnd, istDayStart, paymentFilter, whatsappNumber } from "../src/lib/follow-up.ts";

test("WhatsApp numbers", () => {
  assert.equal(whatsappNumber("9876543210"), "919876543210");
  assert.equal(whatsappNumber("+91 98765-43210"), "919876543210");
  assert.equal(whatsappNumber("09876543210"), "919876543210");
  assert.equal(whatsappNumber("919876543210"), "919876543210");
  assert.equal(whatsappNumber("+1 415 555 0100"), "14155550100");
  assert.equal(whatsappNumber("12345"), null);
  assert.equal(whatsappNumber("1234567890"), null); // 10 digits not starting 6-9 isn't an Indian mobile
});

test("messages per stage", () => {
  assert.match(followUpMessage("abandoned", "Asha Verma", "CCTV Kit", "https://x/p/a"), /^Hi Asha, I noticed you started checking out "CCTV Kit".*https:\/\/x\/p\/a$/);
  assert.match(followUpMessage("failed", "Asha", "CCTV Kit", "L"), /didn't go through\. You can try again here: L/);
  assert.match(followUpMessage("paid", "A", "CCTV Kit", "L"), /^Hi there, thank you for buying/);
});

test("follow-up links are encoded", () => {
  const l = followUpLinks({ stage: "abandoned", buyer_name: "Asha & Co", buyer_email: "a+b@x.co", buyer_phone: "9876543210", page_title: "Kit #1" }, "https://r.space/p/kit");
  assert.ok(l.whatsapp!.startsWith("https://wa.me/919876543210?text="));
  assert.ok(decodeURIComponent(l.whatsapp!.split("text=")[1]).includes('"Kit #1"'));
  assert.ok(l.email.startsWith("mailto:a%2Bb%40x.co?subject="));
  assert.equal(followUpLinks({ stage: "failed", buyer_name: "A", buyer_email: "a@x.co", buyer_phone: "123", page_title: "K" }, "L").whatsapp, null);
});

test("search is cleaned for the database filter", () => {
  assert.equal(cleanSearch(`asha"),buyer_email.eq.x`), "ashabuyer_email.eq.x"); // no quotes, commas or brackets survive
  assert.equal(cleanSearch("  +91 98765 "), "+91 98765");
  assert.equal(cleanSearch("आशा"), "आशा");
  assert.equal(cleanSearch(undefined), "");
});

test("India-time day bounds", () => {
  assert.equal(istDayStart("2026-10-23"), "2026-10-22T18:30:00.000Z");
  assert.equal(istDayEnd("2026-10-23"), "2026-10-23T18:30:00.000Z");
  assert.equal(istDayStart("23-10-2026"), null);
  assert.equal(istDayStart("2026-13-40"), null);
});

test("URL params", () => {
  assert.equal(paymentFilter("nope").key, "all");
  const p = browserParams({ filter: "not_completed", q: "asha*", from: "2026-10-01", to: "bad", page: "-3", product: "x" });
  assert.deepEqual(p, { filter: "not_completed", q: "asha", from: "2026-10-01", to: "", page: 1, product: "" });
});
