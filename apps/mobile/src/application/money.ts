export const maxMoneyPaise = 100_000_000_000;

// Parse currency as whole-number paise; never round an input with floating point.
export function parseRupees(input: string): number | null {
  const value = input
    .trim()
    .replace(/[₹,\s]/g, "")
    .replace(/[०-९]/g, (digit) => String(digit.charCodeAt(0) - 0x0966));
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [rupees = "", fraction = ""] = value.split(".");
  const amount = BigInt(rupees) * 100n + BigInt(fraction.padEnd(2, "0"));
  return amount <= BigInt(maxMoneyPaise) ? Number(amount) : null;
}
export function rupeeInput(paise: number): string {
  const whole = Math.floor(paise / 100),
    fraction = paise % 100;
  return fraction
    ? `${whole}.${String(fraction).padStart(2, "0")}`
    : String(whole);
}
export function formatMoney(paise: number, hi = false): string {
  return new Intl.NumberFormat(hi ? "hi-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}
