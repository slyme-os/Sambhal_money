import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FLOOR_PAISE } from "@/lib/config";
import { reducer, safeToSpend } from "@/lib/state";
import { seedState } from "@/lib/seed";
import { sweep } from "@/lib/sweep";

const R = 100;

describe("sweep — the prompt's cases (amounts in paise)", () => {
  it("sweep(1400, 0, 300) → ₹300 floor, ₹1,100 surplus", () => {
    const r = sweep(1400 * R, 0, 300 * R);
    expect(r.toFloor).toBe(300 * R);
    expect(r.surplus).toBe(1100 * R);
    expect(r.swept).toBe(true);
  });

  it("sweep(250, 200, 300) → ₹100 floor, ₹150 surplus", () => {
    const r = sweep(250 * R, 200 * R, 300 * R);
    expect(r.toFloor).toBe(100 * R);
    expect(r.surplus).toBe(150 * R);
  });

  it("sweep(200, 0, 300) → ₹200 floor, nothing swept", () => {
    const r = sweep(200 * R, 0, 300 * R);
    expect(r.toFloor).toBe(200 * R);
    expect(r.surplus).toBe(0);
    expect(r.swept).toBe(false);
    expect(r.split).toEqual({ bike: 0, emergency: 0, savings: 0 });
  });

  it("sweep(500, 900, 300) → ₹0 floor, ₹500 surplus", () => {
    const r = sweep(500 * R, 900 * R, 300 * R);
    expect(r.toFloor).toBe(0);
    expect(r.surplus).toBe(500 * R);
  });

  it("split is 20% emergency, 30% savings, the rest (≈50%) bike & repairs", () => {
    const r = sweep(1400 * R, 0, 300 * R); // surplus ₹1,100
    expect(r.split.emergency).toBe(220 * R);
    expect(r.split.savings).toBe(330 * R);
    expect(r.split.bike).toBe(550 * R);
  });

  it("rejects negative and fractional amounts", () => {
    expect(() => sweep(-1, 0, 300 * R)).toThrow(RangeError);
    expect(() => sweep(10.5, 0, 300 * R)).toThrow(RangeError);
  });
});

describe("sweep — rounding always sums exactly", () => {
  it("property: split sums to the surplus, every part is a non-negative integer", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 0, max: 100_000 }),
        (payout, earned, floor) => {
          const r = sweep(payout, earned, floor);
          expect(r.toFloor + r.surplus).toBe(payout);
          expect(r.split.bike + r.split.emergency + r.split.savings).toBe(r.surplus);
          for (const v of [r.split.bike, r.split.emergency, r.split.savings]) {
            expect(Number.isInteger(v) && v >= 0).toBe(true);
          }
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("the floor is never swept: toFloor never exceeds what is left of the floor", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5_000_000 }), fc.integer({ min: 0, max: 5_000_000 }), (payout, earned) => {
        const r = sweep(payout, earned, FLOOR_PAISE);
        expect(r.toFloor).toBeLessThanOrEqual(Math.max(0, FLOOR_PAISE - earned));
      }),
    );
  });
});

describe("state — what the screens do", () => {
  it("opens at ₹730 earned, ₹300 safe to spend, pots as seeded", () => {
    const s = seedState();
    expect(s.earnedTodayPaise).toBe(730 * R);
    expect(safeToSpend(s)).toBe(300 * R);
    expect(s.pots).toEqual({ bike: 1750 * R, emergency: 640 * R, savings: 2180 * R });
    expect(s.sweptTodayPaise).toBe(430 * R);
  });

  it("seeded payouts split exactly like the sweep does", () => {
    const s = seedState();
    expect(s.payouts.reduce((t, p) => t + p.split.bike + p.split.emergency + p.split.savings, 0)).toBe(s.sweptTodayPaise);
  });

  it("a payout adds to today's earnings and to the pots, and the floor is never touched", () => {
    const before = seedState();
    const after = reducer(before, { type: "payout", id: "t", amountPaise: 1400 * R, source: "rapido" });
    expect(after.earnedTodayPaise).toBe(before.earnedTodayPaise + 1400 * R);
    // Earned is already past the floor, so the whole payout is surplus.
    expect(after.sweptTodayPaise - before.sweptTodayPaise).toBe(1400 * R);
    const added = (after.pots.bike - before.pots.bike) + (after.pots.emergency - before.pots.emergency) + (after.pots.savings - before.pots.savings);
    expect(added).toBe(1400 * R);
    expect(after.payouts[0].toFloorPaise).toBe(0);
  });

  it("a bad day sweeps nothing", () => {
    const empty = { ...seedState(), earnedTodayPaise: 0, sweptTodayPaise: 0, payouts: [] };
    const after = reducer(empty, { type: "payout", id: "t", amountPaise: 200 * R, source: "zepto" });
    expect(after.sweptTodayPaise).toBe(0);
    expect(after.pots).toEqual(empty.pots);
  });

  it("spending lowers safe-to-spend and never goes below zero", () => {
    let s = reducer(seedState(), { type: "spend", amountPaise: 120 * R });
    expect(safeToSpend(s)).toBe(180 * R);
    s = reducer(s, { type: "spend", amountPaise: 900 * R });
    expect(safeToSpend(s)).toBe(0);
  });
});
