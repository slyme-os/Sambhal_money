import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FLOOR_PAISE } from "@/lib/config";
import {
  DEFAULT_POTS, allocate, earnedToday, movedToday, potBalance, recomputeDay, reducer, safeToSpend,
  seedState, setAsideToday, totalInPots, type Entry, type State,
} from "@/lib/ledger";
import { dayKey } from "@/lib/time";
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

// 11 Oct 2026, 12:00 IST.
const NOON = Date.UTC(2026, 9, 11, 6, 30);
const seed = () => seedState(NOON);
const pay = (s: State, id: string, rupees: number, at = NOON) =>
  reducer(s, { type: "payout", id, at, amountPaise: rupees * R, source: "rapido" });
const emptyDay = (): State => ({ ...seed(), entries: seed().entries.filter((e) => e.kind === "opening") });

describe("ledger — what the screens show", () => {
  it("opens at ₹730 earned, ₹300 safe to spend, pots at ₹1,750 / ₹640 / ₹2,180", () => {
    const s = seed();
    expect(earnedToday(s)).toBe(730 * R);
    expect(safeToSpend(s)).toBe(300 * R);
    expect(movedToday(s)).toBe(430 * R);
    expect(potBalance(s, "bike")).toBe(1750 * R);
    expect(potBalance(s, "emergency")).toBe(640 * R);
    expect(potBalance(s, "savings")).toBe(2180 * R);
  });

  it("a payment adds to today's earnings and to the pots; essentials are never moved", () => {
    const before = seed();
    const after = pay(before, "t", 1400);
    expect(earnedToday(after)).toBe(earnedToday(before) + 1400 * R);
    expect(totalInPots(after) - totalInPots(before)).toBe(1400 * R);
    expect(setAsideToday(after)).toBe(300 * R);
  });

  it("a bad day moves nothing to pots", () => {
    const s = pay(emptyDay(), "t", 200);
    expect(movedToday(s)).toBe(0);
    expect(setAsideToday(s)).toBe(200 * R);
  });

  it("spending lowers safe-to-spend and goes negative to show a shortfall", () => {
    let s = reducer(seed(), { type: "spend", id: "s1", at: NOON, amountPaise: 120 * R });
    expect(safeToSpend(s)).toBe(180 * R);
    s = reducer(s, { type: "spend", id: "s2", at: NOON, amountPaise: 225 * R });
    expect(safeToSpend(s)).toBe(-45 * R);
  });
});

describe("ledger — allocation and balances", () => {
  it("property: default pots split exactly like sweep()", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), (surplus) => {
        const r = sweep(surplus, 10_000_000, 0);
        expect(allocate(surplus, DEFAULT_POTS)).toEqual(r.split);
      }),
    );
  });

  it("property: every pot balance equals openings + allocations − withdrawals", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 5_000 }), { maxLength: 12 }), (amounts) => {
        let s = seed();
        amounts.forEach((a, i) => (s = pay(s, `p${i}`, a, NOON + i)));
        s = reducer(s, { type: "withdraw", id: "w", at: NOON, potId: "bike", amountPaise: 100 * R, reason: "repair" });
        for (const pot of s.pots) {
          const sum = s.entries.reduce((t, e: Entry) => {
            if (e.kind === "opening" && e.potId === pot.id) return t + e.amountPaise;
            if (e.kind === "payout") return t + (e.alloc[pot.id] ?? 0);
            if (e.kind === "withdraw" && e.potId === pot.id) return t - e.amountPaise;
            return t;
          }, 0);
          expect(potBalance(s, pot.id)).toBe(sum);
        }
      }),
    );
  });

  it("removing a payment recomputes the day, and recomputing twice changes nothing", () => {
    let s = emptyDay();
    s = pay(s, "a", 200, NOON);
    s = pay(s, "b", 500, NOON + 1);
    // With "a" gone, "b" must now fill the ₹300 essentials first.
    s = reducer(s, { type: "remove", id: "a" });
    const b = s.entries.find((e) => e.id === "b");
    expect(b?.kind === "payout" && b.toEssentialsPaise).toBe(300 * R);
    expect(movedToday(s)).toBe(200 * R);
    const again = recomputeDay(s.entries, s.day, s.essentialsPaise, s.pots);
    expect(again).toEqual(s.entries);
  });

  it("a withdrawal lowers the pot; more than the balance is refused", () => {
    const s = seed();
    const w = reducer(s, { type: "withdraw", id: "w", at: NOON, potId: "emergency", amountPaise: 140 * R, reason: "emergency" });
    expect(potBalance(w, "emergency")).toBe(500 * R);
    const tooMuch = reducer(s, { type: "withdraw", id: "w2", at: NOON, potId: "emergency", amountPaise: 641 * R, reason: "other" });
    expect(tooMuch).toBe(s);
  });

  it("a new pot with a share takes money from the first pot only", () => {
    let s = reducer(emptyDay(), { type: "createPot", pot: { id: "phone", label: "Phone", icon: "phone", goalPaise: 8000 * R, weight: 10 } });
    s = pay(pay(s, "a", 300), "b", 1000, NOON + 1);
    expect(s.entries.at(-1)).toMatchObject({ alloc: { bike: 400 * R, emergency: 200 * R, savings: 300 * R, phone: 100 * R } });
  });
});

describe("ledger — the demo script", () => {
  it("a ₹1,400 payment after essentials are filled splits 50/20/30: ₹700 bike, ₹280 emergency, ₹420 savings", () => {
    const s = pay(seed(), "t", 1400);
    expect(s.entries.at(-1)).toMatchObject({ toEssentialsPaise: 0, alloc: { bike: 700 * R, emergency: 280 * R, savings: 420 * R } });
  });

  it("a ₹1,400 first payment of the day keeps ₹300 for essentials and splits ₹1,100", () => {
    const s = pay(emptyDay(), "t", 1400);
    expect(s.entries.at(-1)).toMatchObject({ toEssentialsPaise: 300 * R, alloc: { bike: 550 * R, emergency: 220 * R, savings: 330 * R } });
  });

  it("one payment is capped at ₹5,000", () => {
    expect(earnedToday(pay(seed(), "ok", 5000))).toBe((730 + 5000) * R);
    const s = seed();
    expect(pay(s, "big", 5001)).toBe(s);
  });

  it("reset restores the exact seed after anything the rider did", () => {
    let s = pay(seed(), "a", 2000);
    s = reducer(s, { type: "withdraw", id: "w", at: NOON, potId: "bike", amountPaise: 100 * R, reason: "repair" });
    s = reducer(s, { type: "updatePot", id: "emergency", patch: { goalPaise: 5000 * R, weight: 40 } });
    s = reducer(s, { type: "reset", now: NOON });
    expect(earnedToday(s)).toBe(730 * R);
    expect(potBalance(s, "bike")).toBe(1750 * R);
    expect(potBalance(s, "emergency")).toBe(640 * R);
    expect(potBalance(s, "savings")).toBe(2180 * R);
    expect(s.pots).toEqual(DEFAULT_POTS);
  });
});

describe("ledger — goals", () => {
  it("a full pot's share goes to Savings: bike stops at ₹2,500", () => {
    // Bike ₹1,750 → +₹700 → ₹2,450. Of the next ₹400, bike's ₹200 share has room for ₹50.
    const s = pay(pay(seed(), "a", 1400), "b", 400, NOON + 1);
    expect(potBalance(s, "bike")).toBe(2500 * R);
    expect(s.entries.at(-1)).toMatchObject({ alloc: { bike: 50 * R, emergency: 80 * R, savings: 120 * R + 150 * R } });
  });

  it("when Savings is full too, the rest goes to a pot that still has room", () => {
    // Savings ₹2,600 after the first ₹1,400 has room for ₹400 more; the rest goes to emergency.
    const s = pay(pay(seed(), "a", 1400), "b", 1400, NOON + 1);
    expect(potBalance(s, "savings")).toBe(3000 * R);
    expect(s.entries.at(-1)).toMatchObject({ alloc: { bike: 50 * R, emergency: 950 * R, savings: 400 * R } });
  });

  it("when every pot is full, the extra is not moved: it stays in the bank", () => {
    let s = seed();
    for (let i = 0; i < 6; i++) s = pay(s, `p${i}`, 5000, NOON + i);
    for (const p of s.pots) expect(potBalance(s, p.id)).toBe(p.goalPaise);
    const before = totalInPots(s);
    expect(totalInPots(pay(s, "x", 1000, NOON + 9))).toBe(before);
  });

  it("property: no payment ever fills a pot past its goal, and nothing is lost or invented", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 5_000 }), { maxLength: 15 }), (amounts) => {
        let s = seed();
        amounts.forEach((a, i) => {
          const before = totalInPots(s);
          s = pay(s, `p${i}`, a, NOON + i);
          const p = s.entries.at(-1)!;
          const moved = p.kind === "payout" ? Object.values(p.alloc).reduce((x, y) => x + y, 0) : 0;
          const surplus = p.kind === "payout" ? p.amountPaise - p.toEssentialsPaise : 0;
          expect(moved).toBeLessThanOrEqual(surplus);
          expect(totalInPots(s) - before).toBe(moved);
        });
        for (const pot of s.pots) expect(potBalance(s, pot.id)).toBeLessThanOrEqual(pot.goalPaise);
      }),
    );
  });

  it("removing a payment replays the day with goals in mind", () => {
    let s = pay(seed(), "a", 1400, NOON);
    s = pay(s, "b", 1400, NOON + 1);
    s = reducer(s, { type: "remove", id: "a" });
    expect(s.entries.find((e) => e.id === "b")).toMatchObject({ alloc: { bike: 700 * R, emergency: 280 * R, savings: 420 * R } });
  });
});

describe("working day", () => {
  it("starts at 4 AM India time: a 1 AM payment belongs to the previous day", () => {
    expect(dayKey(Date.UTC(2026, 9, 11, 19, 30))).toBe("2026-10-11"); // 12 Oct, 1:00 IST
    expect(dayKey(Date.UTC(2026, 9, 11, 22, 30))).toBe("2026-10-12"); // 12 Oct, 4:00 IST
  });

  it("rollover starts a fresh day and keeps the pots", () => {
    const s = seed();
    const next = reducer(s, { type: "rollover", now: NOON + 86_400_000 });
    expect(earnedToday(next)).toBe(0);
    expect(totalInPots(next)).toBe(totalInPots(s));
    expect(next.history.at(-1)).toEqual({ day: s.day, movedPaise: 430 * R });
    expect(reducer(next, { type: "rollover", now: NOON + 86_400_000 })).toBe(next);
  });
});
