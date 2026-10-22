import { test } from "node:test";
import assert from "node:assert/strict";
import {
  convertDescription,
  descriptionImages,
  faceFor,
  importPayloadSchema,
  isImportableImage,
  isSuperprofileUrl,
  mapField,
  markdownToPlain,
  parsePricePaise,
  planImport,
  type ImportPayload,
} from "../src/lib/superprofile-import.ts";
import { sanitizeDescription } from "../src/lib/rich-text.ts";

const CDN = "https://media-cdn.cosmofeed.com/chat";

// Shaped like what public/superprofile-import.js returns for a real page.
function payload(overrides: Partial<ImportPayload> = {}): ImportPayload {
  return importPayloadSchema.parse({
    v: 1,
    url: "https://superprofile.bio/vp/sample-product",
    title: "📹 CCTV Quotation, GST Invoice aur Dues, Sab Kuch Ek Jagah",
    description: `<h1>₹399</h1><p><del>₹1499</del></p><figure><img src="${CDN}/a.png"></figure><p>Hello <strong>world</strong></p>`,
    cta: "Get it now",
    currency: "INR",
    cover: `${CDN}/cover.png`,
    price: "₹399",
    compareAt: "₹1,499",
    testimonials: [
      { name: "Small CCTV Installer, Delhi", comment: "Ab quotation banane mein time nahi lagta.", rating: 5, photo: "laughingEmoji" },
      { name: "CCTV Dealer, Lucknow", comment: "Bahut accha.", rating: 4, photo: "sunglassEmoji" },
    ],
    faqs: [{ question: "Kya ye normal billing software hai", answer: "<p>Nahi. Ye <b>CCTV</b> ke liye hai.</p>" }],
    offer: { title: "🔥 Make Your CCTV Documents Look More Professional", description: "<p>🎁 Professional Document Pack</p>", cta: "Avail the offer", image: `${CDN}/offer.png`, price: 299, discountedPrice: 149 },
    fields: [{ label: "Phone number", type: "phone", required: true, options: [] }],
    refundPolicy: "# Refund Policy\n\n**Last Updated:** October 2026\n\n- Item one",
    terms: "# Terms & Conditions\n\nWelcome",
    ...overrides,
  });
}

test("prices are read from Superprofile's price text", () => {
  assert.equal(parsePricePaise("₹399"), 39900);
  assert.equal(parsePricePaise("₹1,499"), 149900);
  assert.equal(parsePricePaise("Rs. 99.50"), 9950);
  assert.equal(parsePricePaise(""), null);
  assert.equal(parsePricePaise("Free"), null);
  assert.equal(parsePricePaise("₹0"), null);
  assert.equal(parsePricePaise("₹9,99,99,999"), null); // above our ₹5,00,000 limit
});

test("a real-shaped page maps onto a Reviewlabs draft", () => {
  const plan = planImport(payload());
  assert.equal(plan.title, "📹 CCTV Quotation, GST Invoice aur Dues, Sab Kuch Ek Jagah");
  assert.equal(plan.pricePaise, 39900);
  assert.equal(plan.compareAtPaise, 149900);
  assert.equal(plan.buttonLabel, "Get it now");
  assert.equal(plan.cover, `${CDN}/cover.png`);
  assert.deepEqual(plan.testimonials.map((t) => [t.face, t.rating]), [["laugh", 5], ["sunglasses", 4]]);
  assert.deepEqual(plan.faqs, [{ question: "Kya ye normal billing software hai", answer: "Nahi. Ye CCTV ke liye hai." }]);
  assert.equal(plan.fields.length, 0, "phone is already collected by our checkout");
  assert.deepEqual(plan.offer, {
    headline: "Avail the offer",
    title: "🔥 Make Your CCTV Documents Look More Professional",
    description: "🎁 Professional Document Pack",
    image: `${CDN}/offer.png`,
    pricePaise: 14900,
    compareAtPaise: 29900,
  });
  assert.equal(plan.refundPolicy, "Refund Policy\n\nLast Updated: October 2026\n\n• Item one");
  assert.deepEqual(plan.notes, []);
});

test("description HTML is reshaped into tags our editor supports", () => {
  const html = convertDescription(
    `<h1 style="color:red">Big</h1><div>Line</div><p><del>₹1499</del> <span style="font-size: 19px">mid</span> <span style="font-size:30px">huge</span></p>` +
      `<table><tbody><tr><th>Plan</th><th>Price</th></tr><tr><td>Basic</td><td>₹399</td></tr></tbody></table><h5>Small</h5>`,
  );
  assert.equal(
    html,
    `<h2>Big</h2><p>Line</p><p><s>₹1499</s> <span style="font-size:20px">mid</span> <span style="font-size:26px">huge</span></p><p>Plan · Price</p><p>Basic · ₹399</p><h4>Small</h4>`,
  );
});

test("dangerous HTML never survives the import", () => {
  const evil = `<p onclick="steal()">Hi</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a><iframe src="https://evil.example"></iframe><style>body{}</style>`;
  const out = sanitizeDescription(convertDescription(evil));
  assert.ok(!/script|onerror|onclick|javascript:|iframe|<style/i.test(out), out);
  assert.match(out, /<p>Hi<\/p>/);
});

test("only Superprofile-hosted images are copied", () => {
  assert.equal(isImportableImage(`${CDN}/a.png`), true);
  assert.equal(isImportableImage("https://cdn.superprofile.bio/a.png"), true);
  assert.equal(isImportableImage("http://media-cdn.cosmofeed.com/a.png"), false, "https only");
  assert.equal(isImportableImage("https://evil.com/a.png"), false);
  assert.equal(isImportableImage("https://cosmofeed.com.evil.com/a.png"), false);
  assert.equal(isImportableImage("https://169.254.169.254/latest"), false);
  assert.equal(isImportableImage("not a url"), false);
  assert.deepEqual(descriptionImages(`<img src="${CDN}/a.png?x=1&amp;y=2"><img src="https://evil.com/b.png"><img src="${CDN}/a.png?x=1&amp;y=2">`), [`${CDN}/a.png?x=1&y=2`]);
});

test("superprofile URLs are recognised and look-alikes are not", () => {
  assert.equal(isSuperprofileUrl("https://superprofile.bio/vp/x"), true);
  assert.equal(isSuperprofileUrl("https://superprofile.bio.evil.com/vp/x"), false);
  assert.equal(isSuperprofileUrl("https://evilsuperprofile.bio/vp/x"), false);
});

test("emoji avatars map to our faces", () => {
  assert.equal(faceFor("laughingEmoji"), "laugh");
  assert.equal(faceFor("sunglassEmoji"), "sunglasses");
  assert.equal(faceFor("heartEyesEmoji"), "hearts");
  assert.equal(faceFor("winkEmoji"), "wink");
  assert.equal(faceFor("somethingNew"), "calm");
});

test("checkout questions map to our field types", () => {
  assert.equal(mapField("phone"), null);
  assert.equal(mapField("email"), null);
  assert.equal(mapField("Full Name"), null);
  assert.equal(mapField("text"), "text");
  assert.equal(mapField("longText"), "textarea");
  assert.equal(mapField("dropdown"), "select");
  assert.equal(mapField("number"), "number");
  assert.equal(mapField("somethingNew"), "text");
  const plan = planImport(payload({
    fields: [
      { label: "City", type: "dropdown", required: true, options: ["Delhi", " ", "Pune"] },
      { label: "Pick one", type: "dropdown", required: false, options: [] },
      { label: "About you", type: "longText", required: false, options: [] },
    ],
  }));
  assert.deepEqual(plan.fields, [
    { label: "City", type: "select", required: true, options: ["Delhi", "Pune"] },
    { label: "Pick one", type: "text", required: false, options: [] }, // a select with no options can't work
    { label: "About you", type: "textarea", required: false, options: [] },
  ]);
});

test("our length and count limits are respected, with a note to the creator", () => {
  const long = "x".repeat(400);
  const plan = planImport(payload({
    title: "T".repeat(300),
    cta: "C".repeat(60),
    testimonials: Array.from({ length: 25 }, (_, i) => ({ name: `Buyer ${i}`, comment: long, rating: 9, photo: "" })),
    faqs: Array.from({ length: 30 }, (_, i) => ({ question: `Q${i} ${long}`, answer: long.repeat(4) })),
    refundPolicy: "r".repeat(5000),
  }));
  assert.equal(plan.title.length, 200);
  assert.equal(plan.buttonLabel.length, 40);
  assert.equal(plan.testimonials.length, 20);
  assert.ok(plan.testimonials.every((t) => t.comment.length <= 300 && t.rating === 5));
  assert.equal(plan.faqs.length, 20);
  assert.ok(plan.faqs.every((f) => f.question.length <= 150 && f.answer.length <= 1000));
  assert.equal(plan.refundPolicy.length, 3000);
  assert.ok(plan.notes.some((n) => n.includes("first 20 testimonials")));
  assert.ok(plan.notes.some((n) => n.includes("shortened to 300")));
  assert.ok(plan.notes.some((n) => n.includes("first 20 FAQs")));
  assert.ok(plan.notes.some((n) => n.includes("Policies were shortened")));
});

test("missing or odd prices are handled", () => {
  let plan = planImport(payload({ price: "", compareAt: "" }));
  assert.equal(plan.pricePaise, null);
  assert.ok(plan.notes[0].includes("couldn't read the price"));
  plan = planImport(payload({ price: "₹399", compareAt: "₹299" }));
  assert.equal(plan.compareAtPaise, null, "a 'was' price below the price is ignored");
  plan = planImport(payload({ currency: "USD" }));
  assert.ok(plan.notes.some((n) => n.includes("USD")));
  plan = planImport(payload({ offer: { title: "Free gift", description: "", cta: "", image: "", price: 0, discountedPrice: 0 } }));
  assert.equal(plan.offer, null, "an offer without a price can't be sold");
});

test("bad input is rejected or defaulted, never thrown", () => {
  assert.equal(importPayloadSchema.safeParse(null).success, false);
  assert.equal(importPayloadSchema.safeParse({ v: 1 }).success, false, "a title is required");
  const odd = importPayloadSchema.parse({ v: 1, title: "Ok", testimonials: "nope", faqs: [{ question: 5 }], offer: 7, fields: null });
  assert.deepEqual([odd.testimonials, odd.offer, odd.fields], [[], null, []]);
  assert.deepEqual(odd.faqs, [{ question: "", answer: "" }]);
  assert.doesNotThrow(() => planImport(odd));
});

test("markdown policies become readable plain text", () => {
  assert.equal(markdownToPlain("## Heading\n\n**Bold** and *it*\n\n* item\n[Site](https://x.com)\n\n\n\nEnd"), "Heading\n\nBold and it\n\n• item\nSite (https://x.com)\n\nEnd");
});
