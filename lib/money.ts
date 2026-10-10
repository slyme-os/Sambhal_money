// Money is stored as integer paise (₹1 = 100 paise). Only formatting touches rupees.

export const RUPEE = 100;

const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,23,456 — Indian digit grouping, whole rupees. */
export function formatINR(paise: number): string {
  const rupees = Math.round(paise / RUPEE);
  return `${rupees < 0 ? "-" : ""}₹${grouped.format(Math.abs(rupees))}`;
}

/** Keypad digits ("1420") → paise. */
export function digitsToPaise(digits: string): number {
  return digits ? Number(digits) * RUPEE : 0;
}
