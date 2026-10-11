import { RUPEE } from "./money";

export const APP_NAME = "Sambhal";
export const APP_NAME_HI = "संभल";

/**
 * Daily essentials (petrol + food), the default a rider starts with. Filled first
 * every day and never moved to pots. Riders can change it in onboarding.
 */
export const FLOOR_PAISE = 300 * RUPEE;
export const ESSENTIALS_CHOICES_PAISE = [200, 300, 400, 500].map((r) => r * RUPEE);

/** A payment above this asks the rider to double-check the amount. */
export const LARGE_PAYMENT_PAISE = 2_000 * RUPEE;
/** Demo hard cap: a single payment above this can't be added. */
export const MAX_PAYMENT_PAISE = 5_000 * RUPEE;

/** Income sources. Brand names are descriptive only; one palette, no brand colours. */
export const SOURCES = [
  { id: "swiggy", label: "Swiggy" },
  { id: "zomato", label: "Zomato" },
  { id: "uber", label: "Uber" },
  { id: "rapido", label: "Rapido" },
  { id: "zepto", label: "Zepto" },
  { id: "cash", label: null },
  { id: "other", label: null },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];

/**
 * Demo constants for the Loan screen. Not computed from the ledger, so the pitch is
 * the same every time. All of them live here and nowhere else.
 */
export const DEMO_CREDIT = {
  streakDays: 74,
  streakGoal: 90,
  daysWorked: 81,
  avgDailyEarnPaise: 1_050 * RUPEE,
} as const;

/**
 * Eligibility shown on the Loan screen: Savings pot × 3.5, rounded to the nearest ₹500,
 * capped at ₹15,000. Eligibility only, never an offer. With the seed's ₹2,180: ₹7,500.
 */
export const ELIGIBILITY = {
  multiplierTenths: 35,
  roundToPaise: 500 * RUPEE,
  capPaise: 15_000 * RUPEE,
} as const;

export function eligibilityPaise(savingsPaise: number): number {
  const raw = (Math.max(0, savingsPaise) * ELIGIBILITY.multiplierTenths) / 10;
  const rounded = Math.round(raw / ELIGIBILITY.roundToPaise) * ELIGIBILITY.roundToPaise;
  return Math.min(rounded, ELIGIBILITY.capPaise);
}

/**
 * Outside-lender vs Sambhal monthly cost on the Loan screen. While null, the card does
 * not render. Fill it in only with figures from rider interviews, always with the
 * source line, e.g.
 *   { lenderPerMonthPaise: 1_500 * RUPEE, sambhalPerMonthPaise: 400 * RUPEE, source: "6 riders, Bengaluru, 11 Oct" }
 */
export const SOURCED_COMPARISON: { lenderPerMonthPaise: number; sambhalPerMonthPaise: number; source: string } | null = null;
