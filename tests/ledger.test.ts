import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { istInstant } from "@/lib/day";
import { daySummary, potBalances, replayFrom, type LedgerWithdrawal } from "@/lib/ledger";
import type { PotKind, SplitConfig } from "@/lib/types";

const R = 100;
const SPLIT: SplitConfig = {
  rentShareBp: 7000,
  emergencyShareBp: 4000,
  emergencyTargetPaise: 3000 * R,
  savingsTargetPaise: null,
};

describe("ledger invariant: balance = SUM(allocations) − SUM(withdrawals)", () => {
  it("holds for random sequences of payouts and withdrawals", () => {
    const kinds: PotKind[] = ["rent", "emergency", "savings"];
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            day: fc.integer({ min: 1, max: 9 }),
            hour: fc.integer({ min: 5, max: 23 }),
            rupees: fc.integer({ min: 1, max: 1900 }),
          }),
          { maxLength: 60 },
        ),
        fc.array(
          fc.record({
            day: fc.integer({ min: 1, max: 9 }),
            kind: fc.constantFrom(...kinds),
            rupees: fc.integer({ min: 1, max: 500 }),
            cancelled: fc.boolean(),
          }),
          { maxLength: 10 },
        ),
        (ps, ws) => {
          const payouts = ps.map((p, i) => ({
            id: `p${i}`,
            amountPaise: p.rupees * R,
            occurredAt: istInstant(`2026-03-0${p.day}`, p.hour, i % 60),
          }));
          const withdrawals: LedgerWithdrawal[] = ws.map((w, i) => ({
            id: `w${i}`,
            potKind: w.kind,
            amountPaise: w.rupees * R,
            requestedAt: istInstant(`2026-03-0${w.day}`, 21),
            status: w.cancelled ? "cancelled" : "done",
          }));
          const result = replayFrom({
            fromDay: "2026-03-01",
            payouts,
            withdrawals,
            frozenAllocations: [],
            floorPaise: 300 * R,
            rentTargetPaise: 2450 * R,
            split: SPLIT,
          });
          expect(result.balances).toEqual(potBalances(result.allocations, withdrawals));
        },
      ),
      { numRuns: 300 },
    );
  });

  it("paying rent empties the rent pot and re-opens the next cycle's target", () => {
    const payouts = [
      { id: "a", amountPaise: 1900 * R, occurredAt: istInstant("2026-03-02", 10) },
      { id: "b", amountPaise: 1900 * R, occurredAt: istInstant("2026-03-03", 10) },
      { id: "c", amountPaise: 1900 * R, occurredAt: istInstant("2026-03-04", 10) },
      { id: "d", amountPaise: 1900 * R, occurredAt: istInstant("2026-03-05", 10) },
    ];
    const noWithdrawal = replayFrom({
      fromDay: "2026-03-02",
      payouts,
      withdrawals: [],
      frozenAllocations: [],
      floorPaise: 300 * R,
      rentTargetPaise: 2450 * R,
      split: SPLIT,
    });
    expect(noWithdrawal.balances.rent).toBe(2450 * R); // capped, not overfunded

    const paidRent: LedgerWithdrawal = {
      id: "w",
      potKind: "rent",
      amountPaise: 2450 * R,
      requestedAt: istInstant("2026-03-04", 12), // after "c" fills the pot to 2,450
      status: "done",
    };
    const withRent = replayFrom({
      fromDay: "2026-03-02",
      payouts,
      withdrawals: [paidRent],
      frozenAllocations: [],
      floorPaise: 300 * R,
      rentTargetPaise: 2450 * R,
      split: SPLIT,
    });
    const d = withRent.outcomes.find((o) => o.payoutId === "d")!;
    expect(d.allocations.rent).toBe(1120 * R); // 70% of ₹1,600 surplus, new cycle
    expect(withRent.balances.rent).toBe(1120 * R);
  });
});

describe("day summary (S1 hero)", () => {
  const payouts = [
    { id: "a", amountPaise: 200 * R, occurredAt: istInstant("2026-03-02", 9) },
    { id: "b", amountPaise: 500 * R, occurredAt: istInstant("2026-03-02", 14) },
  ];

  it("safe to spend = min(earned, floor) − spent", () => {
    const s = daySummary({
      day: "2026-03-02",
      floorPaise: 300 * R,
      payouts,
      spends: [{ amountPaise: 120 * R, occurredAt: istInstant("2026-03-02", 13) }],
      allocations: [{ payoutId: "b", potKind: "rent", amountPaise: 280 * R }],
    });
    expect(s.earnedPaise).toBe(700 * R);
    expect(s.floorHeldPaise).toBe(300 * R);
    expect(s.safeToSpendPaise).toBe(180 * R);
    expect(s.sweptPaise).toBe(280 * R);
  });

  it("is never negative", () => {
    const s = daySummary({
      day: "2026-03-02",
      floorPaise: 300 * R,
      payouts,
      spends: [{ amountPaise: 900 * R, occurredAt: istInstant("2026-03-02", 13) }],
      allocations: [],
    });
    expect(s.safeToSpendPaise).toBe(0);
  });

  it("only counts the current working day (4am boundary)", () => {
    const s = daySummary({
      day: "2026-03-03",
      floorPaise: 300 * R,
      payouts: [...payouts, { id: "c", amountPaise: 100 * R, occurredAt: istInstant("2026-03-03", 2) }],
      spends: [],
      allocations: [],
    });
    expect(s.earnedPaise).toBe(0);
  });
});
