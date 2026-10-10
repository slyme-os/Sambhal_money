import { describe, expect, it } from "vitest";
import { buildOperatorView, comparisonCsv, maskPhone, toOperatorInput, type OperatorRiderInput } from "@/lib/operator";
import type { RentEvent } from "@/lib/types";

const TODAY = "2026-03-16"; // a Monday

function ev(dueOn: string, overrides: Partial<RentEvent> = {}): RentEvent {
  return {
    id: `e-${dueOn}`,
    rentAgreementId: "a",
    riderId: "r",
    dueOn,
    amountPaise: 245000,
    status: "due",
    paidAt: null,
    method: null,
    riderReport: null,
    riderReportedAt: null,
    operatorReport: null,
    operatorReportedAt: null,
    ...overrides,
  };
}

describe("HR-7 projection", () => {
  const rider = { id: "r", name: "Ravi", phone: "+919812345123", cohort: "pilot" as const };
  const shareConsent = { purpose: "operator_share" as const, granted: true, withdrawnAt: null };

  it("returns nothing without a live operator_share consent", () => {
    expect(toOperatorInput({ rider, consents: [], rentEvents: [ev("2026-03-07")] })).toBeNull();
    expect(
      toOperatorInput({ rider, consents: [{ ...shareConsent, withdrawnAt: "2026-03-01T00:00:00Z" }], rentEvents: [] }),
    ).toBeNull();
  });

  it("carries only directory fields and rent status — no money fields at all", () => {
    const leaky = {
      rider: { ...rider, floorPaise: 30000, split: {} },
      consents: [shareConsent],
      rentEvents: [ev("2026-03-07")],
      payouts: [{ amountPaise: 1 }],
      pots: { rent: 1 },
    };
    const out = toOperatorInput(leaky)!;
    expect(Object.keys(out).sort()).toEqual(["cohort", "name", "phone", "rentEvents", "riderId"]);
    expect(Object.keys(out.rentEvents[0]).sort()).toEqual(
      ["amountPaise", "dueOn", "id", "method", "operatorReport", "paidAt", "riderReport"].sort(),
    );
    expect(JSON.stringify(out)).not.toMatch(/floor|split|payout|pots|balance/i);
  });
});

describe("operator view", () => {
  const pilot: OperatorRiderInput = {
    riderId: "p1",
    name: "Pilot One",
    phone: "+919800000001",
    cohort: "pilot",
    rentEvents: [
      ev("2026-02-28", { operatorReport: "missed" }),
      ev("2026-03-07", { operatorReport: "paid_on_time" }),
      ev("2026-03-14", { riderReport: "paid_on_time" }), // provisional
      ev("2026-03-21"),
    ],
  };
  const control: OperatorRiderInput = {
    riderId: "c1",
    name: "Control One",
    phone: "+919800000002",
    cohort: "control",
    rentEvents: [
      ev("2026-03-07", { operatorReport: "paid_late" }),
      ev("2026-03-14"), // never paid → missed
    ],
  };
  const view = buildOperatorView([pilot, control], TODAY);

  it("counts streaks of on-time payments and flags provisional statuses", () => {
    const p = view.rows.find((r) => r.riderId === "p1")!;
    expect(p.onTimeStreak).toBe(2);
    expect(p.last).toMatchObject({ dueOn: "2026-03-14", status: "paid_on_time", provisional: true });
    expect(p.upcoming).toMatchObject({ dueOn: "2026-03-21", provisionalPaid: false });
  });

  it("treats unpaid past rent as missed", () => {
    const c = view.rows.find((r) => r.riderId === "c1")!;
    expect(c.last).toMatchObject({ status: "missed", provisional: false });
    expect(c.onTimeStreak).toBe(0);
  });

  it("computes on-time rate per cohort, cumulative and weekly", () => {
    expect(view.cumulative.pilot).toEqual({ onTime: 2, total: 3, rate: 2 / 3 });
    expect(view.cumulative.control).toEqual({ onTime: 0, total: 2, rate: 0 });
    const week = view.weeks.find((w) => w.weekStart === "2026-03-02")!;
    expect(week.pilot).toEqual({ onTime: 1, total: 1, rate: 1 });
    expect(week.control).toEqual({ onTime: 0, total: 1, rate: 0 });
  });

  it("exports the comparison as CSV", () => {
    const csv = comparisonCsv(view);
    expect(csv.split("\n")[0]).toBe(
      "week_start,pilot_on_time,pilot_total,pilot_on_time_pct,control_on_time,control_total,control_on_time_pct",
    );
    expect(csv).toContain("cumulative,2,3,66.7,0,2,0.0");
  });
});

describe("maskPhone", () => {
  it("shows only the first two and last three digits", () => {
    expect(maskPhone("+919812345123")).toBe("+91 98••• ••123");
  });
});
