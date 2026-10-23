import { test } from "node:test";
import assert from "node:assert/strict";
import { bankDetailsError, chequeFileError, isValidIfsc, maskAccountNumber, payoutAmountError, PAYOUT_REQUEST_MIN_PAISE } from "../src/lib/bank-details.ts";

const ok = { accountName: "Satya Mohanty", accountNumber: "50100123456789", confirmAccountNumber: "50100123456789", ifsc: "HDFC0001234" };

test("valid bank details pass", () => {
  assert.equal(bankDetailsError(ok), null);
  assert.equal(bankDetailsError({ ...ok, ifsc: " hdfc0001234 ", confirmAccountNumber: "5010 0123 4567 89" }), null);
});

test("account numbers must match and be 9-18 digits", () => {
  assert.match(bankDetailsError({ ...ok, confirmAccountNumber: "50100123456780" })!, /don't match/);
  assert.match(bankDetailsError({ ...ok, accountNumber: "12345678", confirmAccountNumber: "12345678" })!, /9 to 18/);
  assert.match(bankDetailsError({ ...ok, accountNumber: "1234567890123456789", confirmAccountNumber: "1234567890123456789" })!, /9 to 18/);
  assert.match(bankDetailsError({ ...ok, accountNumber: "50100ABC456789", confirmAccountNumber: "50100ABC456789" })!, /valid account number/);
});

test("IFSC format", () => {
  for (const good of ["HDFC0001234", "SBIN0000001", "ICIC0ABC123"]) assert.ok(isValidIfsc(good), good);
  for (const bad of ["HDFC1001234", "HDF00001234", "HDFC000123", "HDFC00012345", ""]) assert.ok(!isValidIfsc(bad), bad);
});

test("holder name", () => {
  assert.match(bankDetailsError({ ...ok, accountName: "AB" })!, /holder's name/);
  assert.match(bankDetailsError({ ...ok, accountName: "Satya <script>" })!, /only have letters/);
  assert.equal(bankDetailsError({ ...ok, accountName: "Veyrn Labs & Co." }), null);
  assert.equal(bankDetailsError({ ...ok, accountName: "सत्यब्रत महंती" }), null);
});

test("cheque file", () => {
  assert.equal(chequeFileError({ size: 200_000, type: "image/jpeg" }), null);
  assert.equal(chequeFileError({ size: 200_000, type: "application/pdf" }), null);
  assert.match(chequeFileError({ size: 200_000, type: "image/heic" })!, /JPG or PNG/);
  assert.match(chequeFileError({ size: 6 * 1024 * 1024, type: "image/png" })!, /5 MB/);
  assert.match(chequeFileError({ size: 0, type: "image/png" })!, /empty/);
});

test("payout amount: ₹500 minimum, never above the available balance", () => {
  assert.equal(PAYOUT_REQUEST_MIN_PAISE, 50_000);
  assert.equal(payoutAmountError(50_000, 50_000), null);
  assert.equal(payoutAmountError(120_050, 200_000), null);
  assert.match(payoutAmountError(49_999, 200_000)!, /minimum payout is ₹500/);
  assert.match(payoutAmountError(200_001, 200_000)!, /more than your available balance/);
  assert.match(payoutAmountError(50_000, 40_000)!, /at least ₹500 available/);
  assert.match(payoutAmountError(null, 200_000)!, /Enter the amount/);
  assert.match(payoutAmountError(0, 200_000)!, /Enter the amount/);
  assert.match(payoutAmountError(-100, 200_000)!, /Enter the amount/);
});

test("masking", () => {
  assert.equal(maskAccountNumber("50100123456789"), "•••• 6789");
});
