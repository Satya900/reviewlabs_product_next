const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

export function formatPaise(paise: number): string {
  return inr.format(paise / 100);
}

// "499" or "499.50" -> 49950. Returns null for invalid input.
export function rupeesToPaise(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function paiseToRupeesString(paise: number): string {
  return (paise / 100).toFixed(2).replace(/\.00$/, "");
}
