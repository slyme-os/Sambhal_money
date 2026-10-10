// Single source of truth for product constants. The app name is a working name
// (SPEC §11 Q4) — change it here and it changes everywhere.
export const APP_NAME = "Gmoney";
export const APP_SHORT_NAME = "Gmoney";

/** Money is always integer paise. ₹1 = 100 paise. */
export const RUPEE = 100;

export const DEFAULTS = {
  floorPaise: 300 * RUPEE, // SPEC §5: default floor ₹300
  rentShareBp: 7000, // 70% of surplus to rent until the cycle target is met
  emergencyShareBp: 4000, // 40% of the remainder to emergency until its target
  emergencyTargetPaise: 3000 * RUPEE, // SPEC §5: default emergency target ₹3,000
  minSweepPaise: 20 * RUPEE, // surplus below ₹20 is carried, not allocated
  weeklyRentPaise: 2450 * RUPEE,
  nudgeWindowDays: 3, // rent due within 3 days triggers the nudge
} as const;

/**
 * SPEC §11 Q2 is still open (should the control cohort see the app?). Until it is
 * answered the control cohort gets the savings app with nudges switched off, which
 * is what SPEC §7 describes ("gets no nudges but is still tracked").
 */
export const CONTROL_SEES_APP = true;

/** Payout sources in the order riders see them, with their chip colour. */
export const PLATFORMS = [
  { value: "rapido", label: "Rapido", color: "var(--platform-rapido)" },
  { value: "zepto", label: "Zepto", color: "var(--platform-zepto)" },
  { value: "swiggy", label: "Swiggy", color: "var(--platform-swiggy)" },
  { value: "blinkit", label: "Blinkit", color: "var(--platform-blinkit)" },
  { value: "cash", label: "sourceCash", color: "var(--platform-cash)" },
  { value: "other", label: "sourceOther", color: "var(--platform-other)" },
] as const;
