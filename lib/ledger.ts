// Ledger replay: turns payouts + withdrawals into allocations by running the sweep
// engine over events in time order. Pure and deterministic — the same inputs in any
// order produce identical allocations, which is what makes backdated CSV imports
// safe: we recompute from the affected working day rather than appending.

import { DEFAULTS } from "./config";
import { workDay, workDayStart } from "./day";
import { sweepPayout } from "./sweep";
import type { Allocation, Payout, PotAmounts, PotKind, SplitConfig, Spend, Withdrawal } from "./types";
import { POT_KINDS } from "./types";

export type LedgerPayout = Pick<Payout, "id" | "amountPaise" | "occurredAt">;
export type LedgerWithdrawal = Pick<Withdrawal, "id" | "potKind" | "amountPaise" | "requestedAt" | "status">;
export type AllocationDraft = Pick<Allocation, "payoutId" | "potKind" | "amountPaise">;

export interface PayoutOutcome {
  payoutId: string;
  workDay: string;
  amountPaise: number;
  toFloorPaise: number;
  surplusPaise: number;
  carryInPaise: number;
  carryOutPaise: number;
  allocations: PotAmounts;
}

export interface ReplayInput {
  /** First working day to recompute. Allocations for earlier payouts are frozen. */
  fromDay: string;
  payouts: readonly LedgerPayout[];
  withdrawals: readonly LedgerWithdrawal[];
  /** Existing allocations; only those belonging to payouts before `fromDay` are kept. */
  frozenAllocations: readonly AllocationDraft[];
  floorPaise: number;
  rentTargetPaise: number;
  split: SplitConfig;
  minSweepPaise?: number;
}

export interface ReplayResult {
  /** Outcomes for payouts on or after `fromDay`, in processing order. */
  outcomes: PayoutOutcome[];
  /** Fresh allocation rows for payouts on or after `fromDay` (non-zero amounts only). */
  allocations: AllocationDraft[];
  /** Pot balances after every event. */
  balances: PotAmounts;
}

type Event =
  | { type: "payout"; at: number; id: string; payout: LedgerPayout }
  | { type: "withdrawal"; at: number; id: string; withdrawal: LedgerWithdrawal };

export function emptyPots(): PotAmounts {
  return { rent: 0, emergency: 0, savings: 0 };
}

export function replayFrom(input: ReplayInput): ReplayResult {
  const minSweepPaise = input.minSweepPaise ?? DEFAULTS.minSweepPaise;
  const cutoff = Date.parse(workDayStart(input.fromDay));
  const payoutDay = new Map(input.payouts.map((p) => [p.id, workDay(p.occurredAt)]));

  const balances = emptyPots();
  for (const a of input.frozenAllocations) {
    const day = payoutDay.get(a.payoutId);
    if (day !== undefined && day < input.fromDay) balances[a.potKind] += a.amountPaise;
  }

  const events: Event[] = [];
  for (const p of input.payouts) {
    if (payoutDay.get(p.id)! >= input.fromDay) {
      events.push({ type: "payout", at: Date.parse(p.occurredAt), id: p.id, payout: p });
    }
  }
  for (const w of input.withdrawals) {
    if (w.status === "cancelled") continue;
    const at = Date.parse(w.requestedAt);
    if (at < cutoff) balances[w.potKind] -= w.amountPaise;
    else events.push({ type: "withdrawal", at, id: w.id, withdrawal: w });
  }
  // Time order; payouts before withdrawals at the same instant; id breaks ties so
  // input order never matters.
  events.sort(
    (a, b) =>
      a.at - b.at ||
      (a.type === b.type ? 0 : a.type === "payout" ? -1 : 1) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const outcomes: PayoutOutcome[] = [];
  const allocations: AllocationDraft[] = [];
  let currentDay = "";
  let earnedBefore = 0;
  let carry = 0;

  for (const event of events) {
    if (event.type === "withdrawal") {
      balances[event.withdrawal.potKind] -= event.withdrawal.amountPaise;
      continue;
    }
    const day = payoutDay.get(event.id)!;
    if (day !== currentDay) {
      currentDay = day;
      earnedBefore = 0;
      carry = 0; // sub-₹20 carry does not cross the 4am day boundary
    }
    const result = sweepPayout({
      payoutPaise: event.payout.amountPaise,
      earnedTodayBeforePaise: earnedBefore,
      carryInPaise: carry,
      balances: { ...balances },
      floorPaise: input.floorPaise,
      rentTargetPaise: input.rentTargetPaise,
      split: input.split,
      minSweepPaise,
    });
    outcomes.push({
      payoutId: event.id,
      workDay: day,
      amountPaise: event.payout.amountPaise,
      toFloorPaise: result.toFloorPaise,
      surplusPaise: result.surplusPaise,
      carryInPaise: carry,
      carryOutPaise: result.carryOutPaise,
      allocations: result.allocations,
    });
    for (const kind of POT_KINDS) {
      const amount = result.allocations[kind];
      if (amount > 0) {
        allocations.push({ payoutId: event.id, potKind: kind, amountPaise: amount });
        balances[kind] += amount;
      }
    }
    earnedBefore += event.payout.amountPaise;
    carry = result.carryOutPaise;
  }

  return { outcomes, allocations, balances };
}

/** Pot balance = SUM(allocations) − SUM(non-cancelled withdrawals). The ledger invariant. */
export function potBalances(
  allocations: readonly Pick<Allocation, "potKind" | "amountPaise">[],
  withdrawals: readonly Pick<Withdrawal, "potKind" | "amountPaise" | "status">[],
): PotAmounts {
  const balances = emptyPots();
  for (const a of allocations) balances[a.potKind] += a.amountPaise;
  for (const w of withdrawals) if (w.status !== "cancelled") balances[w.potKind] -= w.amountPaise;
  return balances;
}

export interface DaySummary {
  day: string;
  earnedPaise: number;
  payoutCount: number;
  /** Floor held back = min(earned, floor). Stays spendable; never swept. */
  floorHeldPaise: number;
  sweptPaise: number;
  sweptByPot: PotAmounts;
  spentPaise: number;
  /** SPEC S1: min(earnedToday, floor) − spentToday, never negative. */
  safeToSpendPaise: number;
}

export function daySummary(args: {
  day: string;
  floorPaise: number;
  payouts: readonly Pick<Payout, "id" | "amountPaise" | "occurredAt">[];
  spends: readonly Pick<Spend, "amountPaise" | "occurredAt">[];
  allocations: readonly AllocationDraft[];
}): DaySummary {
  const todays = args.payouts.filter((p) => workDay(p.occurredAt) === args.day);
  const ids = new Set(todays.map((p) => p.id));
  const earnedPaise = todays.reduce((s, p) => s + p.amountPaise, 0);
  const sweptByPot = emptyPots();
  for (const a of args.allocations) if (ids.has(a.payoutId)) sweptByPot[a.potKind] += a.amountPaise;
  const spentPaise = args.spends
    .filter((s) => workDay(s.occurredAt) === args.day)
    .reduce((s, x) => s + x.amountPaise, 0);
  const floorHeldPaise = Math.min(earnedPaise, args.floorPaise);
  return {
    day: args.day,
    earnedPaise,
    payoutCount: todays.length,
    floorHeldPaise,
    sweptPaise: sweptByPot.rent + sweptByPot.emergency + sweptByPot.savings,
    sweptByPot,
    spentPaise,
    safeToSpendPaise: Math.max(0, floorHeldPaise - spentPaise),
  };
}

export function totalOf(pots: PotAmounts, kinds: readonly PotKind[] = POT_KINDS): number {
  return kinds.reduce((s, k) => s + pots[k], 0);
}
