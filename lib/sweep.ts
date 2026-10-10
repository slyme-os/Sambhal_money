// The sweep engine (SPEC §5). Pure functions, no I/O, integer paise only.
//
// Rule: the daily floor (petrol + food) is filled first and completely. Only money
// above the floor is surplus, and only surplus is split across pots:
//   1. rent gets up to 70% of surplus until it reaches this cycle's target — never more;
//   2. the rest splits 40% emergency / 60% savings until emergency hits its target;
//   3. after that, 100% savings.
// Surplus under the minimum sweep (₹20) is not allocated; it is carried to the next
// payout of the same working day.
//
// Rounding: the rent share is rounded up, so the paise remainder goes to rent as
// SPEC §5 requires; within the emergency/savings split emergency is rounded down and
// savings takes what is left. Allocations always sum to the surplus exactly.

import type { PotAmounts, SplitConfig } from "./types";

export interface FloorSplit {
  toFloorPaise: number;
  surplusPaise: number;
}

/** How much of one payout fills the floor and how much is surplus. */
export function splitFloor(
  floorPaise: number,
  earnedTodayBeforePaise: number,
  payoutPaise: number,
): FloorSplit {
  assertPaise(floorPaise, "floorPaise");
  assertPaise(earnedTodayBeforePaise, "earnedTodayBeforePaise");
  assertPaise(payoutPaise, "payoutPaise");
  const floorRemaining = Math.max(0, floorPaise - earnedTodayBeforePaise);
  const toFloorPaise = Math.min(payoutPaise, floorRemaining);
  return { toFloorPaise, surplusPaise: payoutPaise - toFloorPaise };
}

/** Basis-point share of an amount, rounded up (ceil) or down (floor). Integer-exact. */
function share(amount: number, bp: number, round: "up" | "down"): number {
  const scaled = amount * bp;
  return round === "up" ? Math.ceil(scaled / 10_000) : Math.floor(scaled / 10_000);
}

/** Splits a surplus across pots given current balances. Sum of result === surplus. */
export function splitSurplus(
  surplusPaise: number,
  balances: PotAmounts,
  rentTargetPaise: number,
  split: SplitConfig,
): PotAmounts {
  assertPaise(surplusPaise, "surplusPaise");
  const rentNeed = Math.max(0, rentTargetPaise - balances.rent);
  const rent = Math.min(share(surplusPaise, split.rentShareBp, "up"), rentNeed);
  const rest = surplusPaise - rent;

  const emergencyNeed = Math.max(0, split.emergencyTargetPaise - balances.emergency);
  const emergency =
    emergencyNeed > 0 ? Math.min(share(rest, split.emergencyShareBp, "down"), emergencyNeed) : 0;

  return { rent, emergency, savings: rest - emergency };
}

export interface SweepInput {
  payoutPaise: number;
  /** Sum of this working day's payouts processed before this one. */
  earnedTodayBeforePaise: number;
  /** Sub-minimum surplus carried from earlier payouts of the same working day. */
  carryInPaise: number;
  balances: PotAmounts;
  floorPaise: number;
  rentTargetPaise: number;
  split: SplitConfig;
  minSweepPaise: number;
}

export interface SweepResult {
  toFloorPaise: number;
  /** Surplus available to sweep, including carry-in. */
  surplusPaise: number;
  allocations: PotAmounts;
  carryOutPaise: number;
  swept: boolean;
}

const ZERO: PotAmounts = Object.freeze({ rent: 0, emergency: 0, savings: 0 });

/** Processes one payout. */
export function sweepPayout(input: SweepInput): SweepResult {
  assertPaise(input.carryInPaise, "carryInPaise");
  const { toFloorPaise, surplusPaise: fresh } = splitFloor(
    input.floorPaise,
    input.earnedTodayBeforePaise,
    input.payoutPaise,
  );
  const surplusPaise = fresh + input.carryInPaise;

  if (surplusPaise < input.minSweepPaise) {
    return { toFloorPaise, surplusPaise, allocations: ZERO, carryOutPaise: surplusPaise, swept: false };
  }
  return {
    toFloorPaise,
    surplusPaise,
    allocations: splitSurplus(surplusPaise, input.balances, input.rentTargetPaise, input.split),
    carryOutPaise: 0,
    swept: true,
  };
}

function assertPaise(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of paise, got ${value}`);
  }
}
