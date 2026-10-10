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
  borrowMonthlyPaise: 50_000, // illustrative: ₹500/month interest outside
  sambhalMonthlyPaise: 15_000, // illustrative: ₹150/month through Sambhal
} as const;
