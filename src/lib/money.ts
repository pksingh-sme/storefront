// All money values are integer minor units (cents). Never use floats for arithmetic.

export function formatMoney(cents: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/**
 * Parses a user-entered decimal amount such as "120", "120.5" or "1,250.00" into cents.
 * Returns null for empty input and NaN for invalid input.
 */
export function parseMoneyToCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  const trimmed = String(input).trim().replace(/,/g, "");
  if (trimmed === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return Number.NaN;
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}
