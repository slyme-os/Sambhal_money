import { RUPEE } from "./config";

const grouping = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const groupingPaise = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * ₹1,23,456 — Indian digit grouping. Paise are shown only for amounts under ₹100
 * that are not whole rupees (₹12.50); everything else is rounded to the rupee.
 */
export function formatINR(paise: number): string {
  const sign = paise < 0 ? "−" : "";
  const abs = Math.abs(paise);
  if (abs < 100 * RUPEE && abs % RUPEE !== 0) {
    return `${sign}₹${groupingPaise.format(abs / RUPEE)}`;
  }
  return `${sign}₹${grouping.format(Math.round(abs / RUPEE))}`;
}

/** Parses what a rider types on the keypad ("1420", "1,420", "99.5") into paise. */
export function rupeesToPaise(input: string): number {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return 0;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * RUPEE + Number(frac.padEnd(2, "0"));
}

/** UPI `am` parameter: rupees with exactly two decimals, no grouping. */
export function paiseToUpiAmount(paise: number): string {
  const whole = Math.floor(paise / RUPEE);
  const frac = String(paise % RUPEE).padStart(2, "0");
  return `${whole}.${frac}`;
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
