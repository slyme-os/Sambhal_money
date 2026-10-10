// Rent cycle maths, the S4 nudge trigger and the UPI intent link. Pure functions.
//
// HR-1: we never touch money. "Pay rent now" opens a UPI intent that the rider
// approves inside his own UPI app; we only record what he tells us happened.

import { DEFAULTS } from "./config";
import { addDays, diffDays, weekday } from "./day";
import { paiseToUpiAmount } from "./money";
import type { Cohort, RentAgreement, RentEvent, RentStatus } from "./types";

/** Next due date on or after `today` for an agreement. */
export function nextDueOn(agreement: Pick<RentAgreement, "cadence" | "dueWeekday">, today: string): string {
  if (agreement.cadence === "daily" || agreement.dueWeekday === null) return today;
  const offset = (agreement.dueWeekday - weekday(today) + 7) % 7;
  return addDays(today, offset);
}

/** Every due date in [from, to] inclusive. */
export function dueDatesBetween(
  agreement: Pick<RentAgreement, "cadence" | "dueWeekday">,
  from: string,
  to: string,
): string[] {
  const step = agreement.cadence === "daily" ? 1 : 7;
  const dates: string[] = [];
  for (let d = nextDueOn(agreement, from); d <= to; d = addDays(d, step)) dates.push(d);
  return dates;
}

export function isPaid(status: RentStatus | null | undefined): boolean {
  return status === "paid_on_time" || status === "paid_late";
}

/** Status a payment made on `paidOn` gets against a due date. */
export function paidStatusFor(dueOn: string, paidOn: string): RentStatus {
  return paidOn <= dueOn ? "paid_on_time" : "paid_late";
}

/** Operator report wins; else the rider's self-report; else due/missed by date. */
export function effectiveRentStatus(
  ev: Pick<RentEvent, "dueOn" | "riderReport" | "operatorReport">,
  today: string,
): RentStatus {
  if (ev.operatorReport) return ev.operatorReport;
  if (ev.riderReport) return ev.riderReport;
  return today > ev.dueOn ? "missed" : "due";
}

export interface NudgeCheck {
  cohort: Cohort;
  /** A payout was just logged. The nudge only ever fires on a fresh payout. */
  payoutJustLanded: boolean;
  today: string;
  /** The earliest unpaid rent event, if any. */
  unpaid: Pick<RentEvent, "dueOn" | "amountPaise"> | null;
  rentPotPaise: number;
  /** Already dismissed for this rent event today. */
  dismissedToday: boolean;
  windowDays?: number;
}

/**
 * SPEC S4 trigger: a payout lands AND rent is due within 3 days (or already overdue)
 * AND the rent pot covers at least one instalment. Control riders never get nudged.
 */
export function shouldNudge(c: NudgeCheck): boolean {
  if (c.cohort !== "pilot" || !c.payoutJustLanded || c.dismissedToday || !c.unpaid) return false;
  const days = diffDays(c.today, c.unpaid.dueOn);
  return days <= (c.windowDays ?? DEFAULTS.nudgeWindowDays) && c.rentPotPaise >= c.unpaid.amountPaise;
}

export interface UpiIntent {
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  /** Shown to the payee: who is paying and for what. */
  note: string;
  /** Our reference, unique per attempt; alphanumeric, max 35 chars. */
  txnRef: string;
}

const VPA = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/;

export function isValidVpa(vpa: string): boolean {
  return VPA.test(vpa);
}

/** upi://pay?pa=…&pn=…&am=…&cu=INR&tn=…&tr=… (NPCI UPI linking spec). */
export function buildUpiIntent(intent: UpiIntent): string {
  if (!isValidVpa(intent.payeeVpa)) throw new Error(`Invalid payee VPA: ${intent.payeeVpa}`);
  if (!Number.isSafeInteger(intent.amountPaise) || intent.amountPaise <= 0) {
    throw new Error("UPI amount must be a positive number of paise");
  }
  const tr = intent.txnRef.replace(/[^a-zA-Z0-9]/g, "").slice(0, 35);
  const params = [
    ["pa", intent.payeeVpa],
    ["pn", intent.payeeName],
    ["am", paiseToUpiAmount(intent.amountPaise)],
    ["cu", "INR"],
    ["tn", intent.note.slice(0, 50)],
    ["tr", tr],
  ];
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

/** Days from today until a due date (negative = overdue). */
export function daysUntil(today: string, dueOn: string): number {
  return diffDays(today, dueOn);
}
