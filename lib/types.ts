// Domain types. These mirror the Supabase tables in supabase/migrations one-to-one
// (snake_case there, camelCase here). Money is always integer paise.

export type PotKind = "rent" | "emergency" | "savings";
export const POT_KINDS: readonly PotKind[] = ["rent", "emergency", "savings"];
export type PotAmounts = Record<PotKind, number>;

export type PayoutSource = "rapido" | "zepto" | "swiggy" | "blinkit" | "cash" | "other";
export const PAYOUT_SOURCES: readonly PayoutSource[] = [
  "rapido",
  "zepto",
  "swiggy",
  "blinkit",
  "cash",
  "other",
];

export type EntryMethod = "manual" | "csv" | "seed";
export type Lang = "hi" | "kn" | "en";
export type Cohort = "pilot" | "control";
export type ConsentPurpose = "app_use" | "operator_share";
export type WithdrawalReason = "rent" | "emergency" | "user" | "correction";
export type WithdrawalStatus = "pending" | "done" | "cancelled";
export type RentStatus = "due" | "paid_on_time" | "paid_late" | "missed";
export type RentMethod = "upi_intent" | "manual_confirm" | "operator_reported";
export type ShockCover = "pot" | "borrowed" | "unpaid" | "other";

export interface Operator {
  id: string;
  name: string;
  city: string;
  contactName: string;
  contactPhone: string;
  /** Code a rider types at onboarding to join this fleet. */
  code: string;
  /** Default UPI payee for rent. */
  payeeVpa: string;
}

export interface SplitConfig {
  rentShareBp: number;
  emergencyShareBp: number;
  emergencyTargetPaise: number;
  savingsTargetPaise: number | null;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  operatorId: string | null;
  city: string;
  language: Lang;
  floorPaise: number;
  cohort: Cohort;
  split: SplitConfig;
  onboardedAt: string | null;
  createdAt: string;
}

export interface Consent {
  id: string;
  riderId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  version: string;
  grantedAt: string;
  withdrawnAt: string | null;
}

export interface Payout {
  id: string;
  riderId: string;
  amountPaise: number;
  source: PayoutSource;
  occurredAt: string;
  entryMethod: EntryMethod;
  createdAt: string;
}

/** Not in SPEC §4, but S1 needs "spent today" for the safe-to-spend hero. */
export interface Spend {
  id: string;
  riderId: string;
  amountPaise: number;
  occurredAt: string;
  entryMethod: EntryMethod;
  createdAt: string;
}

export interface Allocation {
  id: string;
  payoutId: string;
  potKind: PotKind;
  amountPaise: number;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  potKind: PotKind;
  amountPaise: number;
  reason: WithdrawalReason;
  status: WithdrawalStatus;
  requestedAt: string;
  /** For pending withdrawals this is the promised date ("by next working day"). */
  settledAt: string | null;
}

export interface RentAgreement {
  id: string;
  riderId: string;
  operatorId: string;
  amountPaise: number;
  cadence: "daily" | "weekly";
  dueWeekday: number | null;
  nextDueOn: string;
  payeeVpa: string;
  payeeName: string;
  active: boolean;
}

/**
 * The rider's self-report and the operator's report are stored separately so the
 * provisional signal is never confused with the authoritative one (SPEC S4).
 * `status` is the effective value: operator report, else rider report, else due/missed.
 */
export interface RentEvent {
  id: string;
  rentAgreementId: string;
  riderId: string;
  dueOn: string;
  amountPaise: number;
  status: RentStatus;
  paidAt: string | null;
  method: RentMethod | null;
  riderReport: RentStatus | null;
  riderReportedAt: string | null;
  operatorReport: RentStatus | null;
  operatorReportedAt: string | null;
}

export interface Nudge {
  id: string;
  riderId: string;
  kind: "rent_now";
  sentAt: string;
  actedAt: string | null;
  dismissedAt: string | null;
  context: { payoutId: string; rentEventId: string; amountPaise: number };
}

export interface ShockEvent {
  id: string;
  riderId: string;
  description: string;
  amountPaise: number;
  coveredBy: ShockCover;
  occurredAt: string;
}
