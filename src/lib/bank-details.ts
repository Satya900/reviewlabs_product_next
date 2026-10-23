// Bank details and payout request rules. Pure (no app imports) so it can be
// unit tested and used on both the client and the server.

export const PAYOUT_REQUEST_MIN_PAISE = 50_000; // ₹500
export const CHEQUE_MAX_BYTES = 5 * 1024 * 1024;
export const CHEQUE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export function normalizeIfsc(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

// 4 letters (bank), a zero, then 6 letters or digits (branch).
export function isValidIfsc(value: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizeIfsc(value));
}

export function normalizeAccountNumber(value: string): string {
  return value.replace(/[\s-]+/g, "");
}

// Indian bank account numbers are 9 to 18 digits.
export function isValidAccountNumber(value: string): boolean {
  return /^\d{9,18}$/.test(normalizeAccountNumber(value));
}

export function cleanHolderName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export type BankDetailsInput = { accountName: string; accountNumber: string; confirmAccountNumber: string; ifsc: string };

// First problem with the details, or null when they're fine.
export function bankDetailsError(input: BankDetailsInput): string | null {
  const name = cleanHolderName(input.accountName);
  if (name.replace(/[^\p{L}]/gu, "").length < 3 || name.length > 100) return "Enter the account holder's name as the bank has it";
  if (!/^[\p{L}\p{M} .'&-]+$/u.test(name)) return "The account holder's name can only have letters, spaces and . ' & -";
  if (!isValidAccountNumber(input.accountNumber)) return "Enter a valid account number (9 to 18 digits)";
  if (normalizeAccountNumber(input.accountNumber) !== normalizeAccountNumber(input.confirmAccountNumber)) return "The two account numbers don't match";
  if (!isValidIfsc(input.ifsc)) return "Enter a valid IFSC, like HDFC0001234";
  return null;
}

export function chequeFileError(file: { size: number; type: string }): string | null {
  if (!(CHEQUE_TYPES as readonly string[]).includes(file.type)) return "Upload a photo (JPG or PNG) or a PDF of the cancelled cheque";
  if (file.size > CHEQUE_MAX_BYTES) return "The cheque file must be 5 MB or smaller";
  if (file.size === 0) return "That file is empty";
  return null;
}

// Why an amount can't be requested, or null when it can.
export function payoutAmountError(amountPaise: number | null, availablePaise: number): string | null {
  if (amountPaise === null || !Number.isInteger(amountPaise) || amountPaise <= 0) return "Enter the amount you want to withdraw";
  if (availablePaise < PAYOUT_REQUEST_MIN_PAISE) return "You need at least ₹500 available to request a payout";
  if (amountPaise < PAYOUT_REQUEST_MIN_PAISE) return "The minimum payout is ₹500";
  if (amountPaise > availablePaise) return "You can't request more than your available balance";
  return null;
}

export function maskAccountNumber(value: string): string {
  const n = normalizeAccountNumber(value);
  return n.length <= 4 ? n : `•••• ${n.slice(-4)}`;
}
