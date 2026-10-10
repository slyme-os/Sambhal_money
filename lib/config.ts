import { RUPEE } from "./money";

export const APP_NAME = "Sambhal";
export const APP_NAME_HI = "संभल";

/** Petrol + food. Filled first every day; never swept. */
export const FLOOR_PAISE = 300 * RUPEE;

/** Income sources. One palette everywhere, so no per-brand colours. */
export const SOURCES = [
  { id: "rapido", label: "Rapido" },
  { id: "zepto", label: "Zepto" },
  { id: "swiggy", label: "Swiggy" },
  { id: "blinkit", label: "Blinkit" },
  { id: "cash", label: "कैश" },
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
