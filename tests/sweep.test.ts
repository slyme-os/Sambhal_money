import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { istInstant } from "@/lib/day";
import { replayFrom, type LedgerPayout } from "@/lib/ledger";
import { splitFloor, splitSurplus, sweepPayout, type SweepInput } from "@/lib/sweep";
import type { SplitConfig } from "@/lib/types";

const R = 100; // ₹1 in paise
const SPLIT: SplitConfig = {
  rentShareBp: 7000,
  emergencyShareBp: 4000,
  emergencyTargetPaise: 3000 * R,
  savingsTargetPaise: null,
};
const RENT_TARGET = 2450 * R;
const EMPTY = { rent: 0, emergency: 0, savings: 0 };

function sweep(overrides: Partial<SweepInput>) {
  return sweepPayout({
    payoutPaise: 0,
    earnedTodayBeforePaise: 0,
    carryInPaise: 0,
    balances: EMPTY,
    floorPaise: 300 * R,
    rentTargetPaise: RENT_TARGET,
    split: SPLIT,
    minSweepPaise: 20 * R,
    ...overrides,
  });
}

function replay(payouts: LedgerPayout[], fromDay = "2026-01-01") {
  return replayFrom({
    fromDay,
    payouts,
    withdrawals: [],
    frozenAllocations: [],
    floorPaise: 300 * R,
    rentTargetPaise: RENT_TARGET,
    split: SPLIT,
  });
}

const payout = (id: string, rupees: number, date: string, hour: number, minute = 0): LedgerPayout => ({
  id,
  amountPaise: rupees * R,
  occurredAt: istInstant(date, hour, minute),
});

describe("floor first", () => {
  it("fills the floor completely before anything is surplus", () => {
    expect(splitFloor(300 * R, 0, 200 * R)).toEqual({ toFloorPaise: 200 * R, surplusPaise: 0 });
    expect(splitFloor(300 * R, 300 * R, 50 * R)).toEqual({ toFloorPaise: 0, surplusPaise: 50 * R });
  });

  it("partial floor: earned ₹200, floor ₹300, payout ₹250 → ₹100 floor, ₹150 surplus", () => {
    expect(splitFloor(300 * R, 200 * R, 250 * R)).toEqual({ toFloorPaise: 100 * R, surplusPaise: 150 * R });
  });

  it("first payout larger than the floor: ₹1,400 → ₹300 floor, ₹1,100 surplus", () => {
    expect(splitFloor(300 * R, 0, 1400 * R)).toEqual({ toFloorPaise: 300 * R, surplusPaise: 1100 * R });
  });

  it("rejects negative or fractional paise", () => {
    expect(() => splitFloor(300 * R, 0, -1)).toThrow(RangeError);
    expect(() => splitFloor(300 * R, 0, 10.5)).toThrow(RangeError);
  });
});

describe("bad day", () => {
  it("earnings below the floor sweep nothing — no partial sweep, no negative balance", () => {
    const result = replay([
      payout("a", 120, "2026-03-02", 9),
      payout("b", 90, "2026-03-02", 13),
      payout("c", 60, "2026-03-02", 19),
    ]);
    expect(result.allocations).toEqual([]);
    expect(result.balances).toEqual(EMPTY);
    expect(result.outcomes.every((o) => o.surplusPaise === 0)).toBe(true);
  });

  it("does not 'catch up' a bad day tomorrow: each day refills its own floor", () => {
    const result = replay([payout("a", 100, "2026-03-02", 10), payout("b", 400, "2026-03-03", 10)]);
    const b = result.outcomes.find((o) => o.payoutId === "b")!;
    expect(b.toFloorPaise).toBe(300 * R);
    expect(b.surplusPaise).toBe(100 * R);
  });
});

describe("split priority", () => {
  it("rent first: 70% of surplus to rent while below target, then 40/60 emergency/savings", () => {
    const r = sweep({ payoutPaise: 1400 * R });
    expect(r.allocations).toEqual({ rent: 770 * R, emergency: 132 * R, savings: 198 * R });
  });

  it("partial-floor payout splits only the ₹150 surplus", () => {
    const r = sweep({ payoutPaise: 250 * R, earnedTodayBeforePaise: 200 * R });
    expect(r.toFloorPaise).toBe(100 * R);
    expect(r.allocations).toEqual({ rent: 105 * R, emergency: 18 * R, savings: 27 * R });
  });

  it("never overfunds rent: caps at the cycle target and passes the rest on", () => {
    const r = sweep({ payoutPaise: 1400 * R, balances: { rent: RENT_TARGET - 50 * R, emergency: 0, savings: 0 } });
    expect(r.allocations.rent).toBe(50 * R);
    expect(r.allocations).toEqual({ rent: 50 * R, emergency: 420 * R, savings: 630 * R });
  });

  it("gives rent nothing once the cycle target is met", () => {
    const r = sweep({ payoutPaise: 1300 * R, balances: { rent: RENT_TARGET, emergency: 0, savings: 0 } });
    expect(r.allocations).toEqual({ rent: 0, emergency: 400 * R, savings: 600 * R });
  });

  it("caps emergency at its target", () => {
    const r = sweep({
      payoutPaise: 1300 * R,
      balances: { rent: RENT_TARGET, emergency: 3000 * R - 10 * R, savings: 0 },
    });
    expect(r.allocations).toEqual({ rent: 0, emergency: 10 * R, savings: 990 * R });
  });

  it("sends 100% to savings once rent and emergency are full", () => {
    const r = sweep({ payoutPaise: 800 * R, balances: { rent: RENT_TARGET, emergency: 3000 * R, savings: 0 } });
    expect(r.allocations).toEqual({ rent: 0, emergency: 0, savings: 500 * R });
  });
});

describe("minimum sweep", () => {
  it("surplus below ₹20 creates no allocation rows and is carried", () => {
    const r = sweep({ payoutPaise: 315 * R });
    expect(r.swept).toBe(false);
    expect(r.allocations).toEqual(EMPTY);
    expect(r.carryOutPaise).toBe(15 * R);
  });

  it("carry is added to the next payout's surplus on the same day", () => {
    const result = replay([payout("a", 315, "2026-03-02", 9), payout("b", 10, "2026-03-02", 10)]);
    const [a, b] = result.outcomes;
    expect(a.allocations).toEqual(EMPTY);
    expect(b.carryInPaise).toBe(15 * R);
    expect(b.surplusPaise).toBe(25 * R);
    expect(result.allocations.filter((x) => x.payoutId === "a")).toEqual([]);
    expect(result.allocations.reduce((s, x) => s + x.amountPaise, 0)).toBe(25 * R);
  });

  it("exactly ₹20 is swept", () => {
    expect(sweep({ payoutPaise: 320 * R }).swept).toBe(true);
  });

  it("carry does not cross the day boundary", () => {
    const result = replay([payout("a", 310, "2026-03-02", 22), payout("b", 400, "2026-03-03", 9)]);
    expect(result.outcomes[1].carryInPaise).toBe(0);
  });
});

describe("day boundary is 4am IST, not midnight", () => {
  it("a 1am payout belongs to the previous working day", () => {
    const result = replay([payout("eve", 300, "2026-03-02", 20), payout("late", 200, "2026-03-03", 1)]);
    const late = result.outcomes.find((o) => o.payoutId === "late")!;
    expect(late.workDay).toBe("2026-03-02");
    expect(late.toFloorPaise).toBe(0); // floor already met by the evening payout
    expect(late.surplusPaise).toBe(200 * R);
  });

  it("a 4am payout starts a fresh day with an empty floor", () => {
    const result = replay([payout("eve", 300, "2026-03-02", 20), payout("dawn", 200, "2026-03-03", 4)]);
    const dawn = result.outcomes.find((o) => o.payoutId === "dawn")!;
    expect(dawn.workDay).toBe("2026-03-03");
    expect(dawn.toFloorPaise).toBe(200 * R);
    expect(dawn.surplusPaise).toBe(0);
  });

  it("3:59am still belongs to yesterday", () => {
    const result = replay([payout("x", 400, "2026-03-03", 3, 59)]);
    expect(result.outcomes[0].workDay).toBe("2026-03-02");
  });
});

describe("rounding", () => {
  it("gives the paise remainder of the rent share to rent", () => {
    // surplus 2,001 paise: 70% = 1,400.7 → rent gets 1,401
    const a = splitSurplus(2001, EMPTY, RENT_TARGET, SPLIT);
    expect(a.rent).toBe(1401);
    expect(a.rent + a.emergency + a.savings).toBe(2001);
  });

  it("property: allocations always sum to the surplus exactly, never negative, never overfund", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 600_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (surplus, rentBal, emBal, rentTarget, emTarget, rentBp, emBp) => {
          const split = { ...SPLIT, rentShareBp: rentBp, emergencyShareBp: emBp, emergencyTargetPaise: emTarget };
          const a = splitSurplus(surplus, { rent: rentBal, emergency: emBal, savings: 0 }, rentTarget, split);
          expect(a.rent + a.emergency + a.savings).toBe(surplus);
          expect(a.rent).toBeGreaterThanOrEqual(0);
          expect(a.emergency).toBeGreaterThanOrEqual(0);
          expect(a.savings).toBeGreaterThanOrEqual(0);
          expect(a.rent).toBeLessThanOrEqual(Math.max(0, rentTarget - rentBal));
          expect(a.rent).toBeLessThanOrEqual(Math.ceil((surplus * rentBp) / 10_000));
          expect(a.emergency).toBeLessThanOrEqual(Math.max(0, emTarget - emBal));
          expect(Number.isInteger(a.rent) && Number.isInteger(a.emergency)).toBe(true);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("property: over a whole day, swept + floor + carry-out accounts for every paisa earned", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 300_000 }), { minLength: 1, maxLength: 40 }),
        (amounts) => {
          const ps = amounts.map((amt, i) => ({
            id: `p${String(i).padStart(2, "0")}`,
            amountPaise: amt,
            occurredAt: istInstant("2026-03-02", 6, i * 20),
          }));
          const result = replay(ps);
          const swept = result.allocations.reduce((s, a) => s + a.amountPaise, 0);
          const floor = result.outcomes.reduce((s, o) => s + o.toFloorPaise, 0);
          const lastCarry = result.outcomes.at(-1)!.carryOutPaise;
          expect(swept + floor + lastCarry).toBe(amounts.reduce((s, a) => s + a, 0));
          expect(floor).toBeLessThanOrEqual(300 * R);
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe("cash payouts", () => {
  it("are maths-identical to platform payouts (the source is a flag, not an input)", () => {
    const platform = replay([{ ...payout("a", 900, "2026-03-02", 10) }]);
    const cash = replay([{ ...payout("a", 900, "2026-03-02", 10), source: "cash" } as LedgerPayout]);
    expect(cash.allocations).toEqual(platform.allocations);
  });
});

describe("backdated payouts and idempotency", () => {
  const day1 = [payout("a", 700, "2026-03-02", 9), payout("b", 450, "2026-03-02", 15)];
  const day2 = [payout("c", 900, "2026-03-03", 11), payout("d", 300, "2026-03-03", 18)];

  it("re-running the same payouts produces identical allocations", () => {
    expect(replay([...day1, ...day2])).toEqual(replay([...day1, ...day2]));
  });

  it("input order does not matter", () => {
    expect(replay([...day2, ...day1].reverse()).allocations).toEqual(replay([...day1, ...day2]).allocations);
  });

  it("a backdated payout recomputes that day from scratch, matching a full rebuild", () => {
    const before = replay([...day1, ...day2]);
    const backdated = payout("z", 250, "2026-03-02", 7); // CSV import of an early-morning payout
    const all = [...day1, ...day2, backdated];

    const incremental = replayFrom({
      fromDay: "2026-03-02",
      payouts: all,
      withdrawals: [],
      frozenAllocations: before.allocations,
      floorPaise: 300 * R,
      rentTargetPaise: RENT_TARGET,
      split: SPLIT,
    });
    const rebuilt = replay(all);
    expect(incremental.allocations).toEqual(rebuilt.allocations);
    // "z" now fills the floor, so "a" — previously partly floor — is now mostly surplus
    const a = incremental.outcomes.find((o) => o.payoutId === "a")!;
    expect(a.toFloorPaise).toBe(50 * R);
  });

  it("recomputing from a later day keeps earlier days frozen", () => {
    const full = replay([...day1, ...day2]);
    const fromDay2 = replayFrom({
      fromDay: "2026-03-03",
      payouts: [...day1, ...day2],
      withdrawals: [],
      frozenAllocations: full.allocations,
      floorPaise: 300 * R,
      rentTargetPaise: RENT_TARGET,
      split: SPLIT,
    });
    expect(fromDay2.outcomes.map((o) => o.payoutId)).toEqual(["c", "d"]);
    expect(fromDay2.balances).toEqual(full.balances);
  });
});
