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
 * Underwriting inputs for the credit screen. Demo figures, not computed from the
 * ledger, so the pitch is the same every time.
 */
export const CREDIT = {
  streakDays: 74,
  streakGoal: 90,
  daysWorked: 81,
  avgDailyEarnPaise: 105_000,
  eligiblePaise: 800_000,
} as const;

/**
 * Outside-lender vs Sambhal cost comparison on the Loan screen. Leave as null and the
 * card does not render. Fill it in only with sourced figures, and always with a source
 * line, e.g. { outsidePaise: 50_000, sambhalPaise: 15_000, source: "3 riders, Bengaluru, 11 Oct 2026" }.
 */
export const LENDER_COMPARISON: { outsidePaise: number; sambhalPaise: number; source: string } | null = null;
