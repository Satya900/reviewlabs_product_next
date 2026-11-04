import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInWords, financialYear, invoiceNumber, isValidGstin, splitInclusive, stateName } from "../src/lib/gst.ts";

test("GSTIN: format, state code and check digit", () => {
  assert.equal(isValidGstin("27AAPFU0939F1ZV"), true);
  assert.equal(isValidGstin("27aapfu0939f1zv"), true);
  assert.equal(isValidGstin("27AAPFU0939F1ZW"), false); // wrong check digit
  assert.equal(isValidGstin("99AAPFU0939F1ZV"), false); // no such state
  assert.equal(isValidGstin("27AAPFU0939F1V"), false);
  assert.equal(stateName("21"), "Odisha");
});

test("GST-inclusive split: same state CGST+SGST, other state IGST", () => {
  assert.deepEqual(splitInclusive(79900, "21", "21"), { taxable: 67712, cgst: 6094, sgst: 6094, igst: 0 });
  assert.deepEqual(splitInclusive(199900, "21", "29"), { taxable: 169407, cgst: 0, sgst: 0, igst: 30493 });
  const odd = splitInclusive(799000, "21", "21");
  assert.equal(odd.taxable + odd.cgst + odd.sgst, 799000);
});

test("financial year in IST and invoice numbers", () => {
  assert.equal(financialYear(new Date("2026-11-04T12:00:00Z")), "26-27");
  assert.equal(financialYear(new Date("2027-03-31T18:00:00Z")), "26-27"); // 23:30 IST on 31 March
  assert.equal(financialYear(new Date("2027-03-31T18:31:00Z")), "27-28"); // 00:01 IST on 1 April
  assert.equal(invoiceNumber("26-27", 7), "RL/26-27/00007");
  assert.ok(invoiceNumber("26-27", 99999).length <= 16);
});

test("amount in words", () => {
  assert.equal(amountInWords(79900), "Rupees Seven Hundred Ninety Nine Only");
  assert.equal(amountInWords(1999000), "Rupees Nineteen Thousand Nine Hundred Ninety Only");
  assert.equal(amountInWords(12345678), "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only");
});
