// GST rules for Reviewlabs' own tax invoices (plan payments). Pure, so the
// node test runner can import it. The database applies the same tax split
// when it issues an invoice (public.issue_plan_invoice).

export const GST_RATE_PERCENT = 18;
// IT design and development services.
export const PLAN_SAC = "998314";

// GST state codes (first two digits of a GSTIN).
export const GST_STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

export const stateName = (code: string | null | undefined) => GST_STATES.find((s) => s.code === code)?.name ?? null;

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Format, a known state code and the check digit (the last character).
export function isValidGstin(input: string): boolean {
  const g = input.trim().toUpperCase();
  if (!GSTIN_RE.test(g) || !stateName(g.slice(0, 2))) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = CHARS.indexOf(g[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36] === g[14];
}

export type TaxSplit = { taxable: number; cgst: number; sgst: number; igst: number };

// Splits a GST-inclusive amount (paise). Same state: CGST + SGST; otherwise IGST.
export function splitInclusive(totalPaise: number, sellerState: string, placeOfSupply: string): TaxSplit {
  const taxable = Math.round((totalPaise * 100) / (100 + GST_RATE_PERCENT));
  const tax = totalPaise - taxable;
  if (sellerState === placeOfSupply) {
    const cgst = Math.floor(tax / 2);
    return { taxable, cgst, sgst: tax - cgst, igst: 0 };
  }
  return { taxable, cgst: 0, sgst: 0, igst: tax };
}

// Indian financial year (April to March, in IST) as "26-27".
export function financialYear(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCFullYear() - (ist.getUTCMonth() < 3 ? 1 : 0);
  return `${String(y % 100).padStart(2, "0")}-${String((y + 1) % 100).padStart(2, "0")}`;
}

export const invoiceNumber = (fy: string, seq: number) => `RL/${fy}/${String(seq).padStart(5, "0")}`;

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function below1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? " " + ONES[r % 10] : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", rest].filter(Boolean).join(" ");
}
function words(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  for (const [size, label] of [[10_000_000, "Crore"], [100_000, "Lakh"], [1000, "Thousand"]] as const) {
    if (n >= size) { parts.push(`${words(Math.floor(n / size))} ${label}`); n %= size; }
  }
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}

// "Rupees Seven Hundred Ninety Nine Only", with paise when there are any.
export function amountInWords(paise: number): string {
  const r = Math.floor(paise / 100), p = paise % 100;
  return `Rupees ${words(r)}${p ? ` and ${words(p)} Paise` : ""} Only`;
}
