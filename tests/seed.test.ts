import { describe, expect, it } from "vitest";
import { addDays, diffDays, istDate, workDay } from "@/lib/day";
import { potBalances, replayFrom } from "@/lib/ledger";
import { buildOperatorView, toOperatorInput } from "@/lib/operator";
import { DEMO_RIDER_INDEX, generateFleet, generateRider, SEED_DAYS } from "@/lib/seed";
import { buildSeedSql } from "../scripts/seed";
import { as, createDb } from "./helpers/pg";

const NOW = "2026-10-10T08:30:00.000Z"; // 2pm IST
const fleet = generateFleet({ now: NOW });

describe("seed shape (SPEC §8)", () => {
  it("one operator, 25 pilot and 25 control riders", () => {
    expect(fleet.riders.filter((b) => b.rider.cohort === "pilot")).toHaveLength(25);
    expect(fleet.riders.filter((b) => b.rider.cohort === "control")).toHaveLength(25);
  });

  it("is deterministic for a given moment", () => {
    expect(generateRider(7, "pilot", { now: NOW })).toEqual(generateRider(7, "pilot", { now: NOW }));
  });

  it("every row is marked seed and phone numbers cannot be real", () => {
    for (const b of fleet.riders) {
      expect(b.payouts.every((p) => p.entryMethod === "seed")).toBe(true);
      expect(b.spends.every((s) => s.entryMethod === "seed")).toBe(true);
      expect(b.rider.phone.startsWith("+910")).toBe(true);
    }
    expect(fleet.operator.payeeVpa.endsWith("@example")).toBe(true);
  });

  it("30 days of income: ₹450–1,900 a day, 3–7 payouts, some zero days", () => {
    const today = workDay(NOW);
    let zeroDays = 0;
    for (const b of fleet.riders) {
      const byDay = new Map<string, number[]>();
      for (const p of b.payouts) {
        const d = workDay(p.occurredAt);
        byDay.set(d, [...(byDay.get(d) ?? []), p.amountPaise]);
      }
      for (let d = addDays(today, -SEED_DAYS); d < addDays(today, -1); d = addDays(d, 1)) {
        const amounts = byDay.get(d);
        if (!amounts) {
          zeroDays++;
          continue;
        }
        const total = amounts.reduce((s, a) => s + a, 0);
        expect(total).toBeGreaterThanOrEqual(450 * 100);
        expect(total).toBeLessThanOrEqual(1920 * 100); // per-payout ₹20 minimum can nudge the top by a few rupees
        expect(amounts.length).toBeGreaterThanOrEqual(3);
        expect(amounts.length).toBeLessThanOrEqual(7);
      }
    }
    expect(zeroDays).toBeGreaterThan(0);
  });
});

describe("seeded ledgers obey the same rules as live ones", () => {
  it("replaying payouts + withdrawals reproduces the seeded allocations exactly", () => {
    for (const b of fleet.riders) {
      const replayed = replayFrom({
        fromDay: addDays(workDay(NOW), -SEED_DAYS - 1),
        payouts: b.payouts,
        withdrawals: b.withdrawals,
        frozenAllocations: [],
        floorPaise: b.rider.floorPaise,
        rentTargetPaise: b.rentAgreement.amountPaise,
        split: b.rider.split,
      });
      const key = (a: { payoutId: string; potKind: string; amountPaise: number }) => `${a.payoutId}|${a.potKind}|${a.amountPaise}`;
      expect(replayed.allocations.map(key).sort()).toEqual(b.allocations.map(key).sort());
    }
  });

  it("no pot ever ends negative and rent is never overfunded", () => {
    for (const b of fleet.riders) {
      const bal = potBalances(b.allocations, b.withdrawals);
      expect(bal.rent).toBeGreaterThanOrEqual(0);
      expect(bal.emergency).toBeGreaterThanOrEqual(0);
      expect(bal.savings).toBeGreaterThanOrEqual(0);
      expect(bal.rent).toBeLessThanOrEqual(b.rentAgreement.amountPaise);
    }
  });

  it("control riders get no nudges", () => {
    expect(fleet.riders.filter((b) => b.rider.cohort === "control").every((b) => b.nudges.length === 0)).toBe(true);
  });

  it("the pilot cohort pays rent on time more often than control (the bounce pattern is real)", () => {
    const inputs = fleet.riders.map((b) => toOperatorInput(b)).filter((x) => x !== null);
    const view = buildOperatorView(inputs, istDate(NOW));
    expect(view.cumulative.pilot.rate!).toBeGreaterThan(view.cumulative.control.rate! + 0.1);
  });

  it("some riders have not consented, and the dashboard hides them", () => {
    const hidden = fleet.riders.filter((b) => toOperatorInput(b) === null);
    expect(hidden.length).toBeGreaterThanOrEqual(2);
  });
});

describe("the demo rider is set up to show the product", () => {
  const demo = fleet.riders[DEMO_RIDER_INDEX];
  it("has earnings today", () => {
    expect(demo.payouts.some((p) => workDay(p.occurredAt) === workDay(NOW))).toBe(true);
  });
  it("has rent falling due in two days", () => {
    expect(diffDays(istDate(NOW), demo.rentAgreement.nextDueOn)).toBe(2);
  });
});

describe("supabase/seed.sql", () => {
  it("loads into the real schema; trigger-maintained balances match the generator", async () => {
    const subset = { operator: fleet.operator, riders: [...fleet.riders.slice(0, 3), ...fleet.riders.slice(25, 28)] };
    const db = await createDb();
    await db.exec(buildSeedSql(subset));

    for (const b of subset.riders) {
      const expected = potBalances(b.allocations, b.withdrawals);
      const res = await db.query<{ kind: "rent" | "emergency" | "savings"; balance_paise: string }>(
        `select kind, balance_paise from pots where rider_id = $1`, [b.rider.id]);
      for (const row of res.rows) expect(Number(row.balance_paise)).toBe(expected[row.kind]);
    }

    const opUser = "a1000000-0000-0000-0000-000000000099";
    await db.query(`insert into operator_members (auth_user_id, operator_id) values ($1, $2)`, [opUser, fleet.operator.id]);
    const seen = await as(db, { role: "authenticated", userId: opUser }, async () => ({
      payouts: (await db.query<{ n: number }>(`select count(*)::int n from payouts`)).rows[0].n,
      riders: (await db.query(`select * from operator_riders()`)).rows.length,
      events: (await db.query<{ n: number }>(`select count(*)::int n from rent_events`)).rows[0].n,
    }));
    expect(seen.payouts).toBe(0);
    expect(seen.riders).toBe(subset.riders.filter((b) => toOperatorInput(b) !== null).length);
    expect(seen.events).toBeGreaterThan(0);
  }, 120_000);
});
