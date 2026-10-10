import { describe, expect, it } from "vitest";
import { weekday } from "@/lib/day";
import {
  buildUpiIntent,
  dueDatesBetween,
  effectiveRentStatus,
  nextDueOn,
  paidStatusFor,
  shouldNudge,
  type NudgeCheck,
} from "@/lib/rent";

const R = 100;
const MONDAY = "2026-03-02";

describe("rent cycle", () => {
  it("2026-03-02 is a Monday (fixture sanity)", () => {
    expect(weekday(MONDAY)).toBe(1);
  });

  it("next due date for a weekly agreement", () => {
    const saturday = { cadence: "weekly" as const, dueWeekday: 6 };
    expect(nextDueOn(saturday, MONDAY)).toBe("2026-03-07");
    expect(nextDueOn(saturday, "2026-03-07")).toBe("2026-03-07");
    expect(nextDueOn(saturday, "2026-03-08")).toBe("2026-03-14");
  });

  it("daily agreements are due every day", () => {
    expect(nextDueOn({ cadence: "daily", dueWeekday: null }, MONDAY)).toBe(MONDAY);
    expect(dueDatesBetween({ cadence: "daily", dueWeekday: null }, MONDAY, "2026-03-04")).toHaveLength(3);
  });

  it("lists every weekly due date in a range", () => {
    expect(dueDatesBetween({ cadence: "weekly", dueWeekday: 6 }, MONDAY, "2026-03-31")).toEqual([
      "2026-03-07",
      "2026-03-14",
      "2026-03-21",
      "2026-03-28",
    ]);
  });

  it("on time vs late", () => {
    expect(paidStatusFor("2026-03-07", "2026-03-05")).toBe("paid_on_time");
    expect(paidStatusFor("2026-03-07", "2026-03-07")).toBe("paid_on_time");
    expect(paidStatusFor("2026-03-07", "2026-03-08")).toBe("paid_late");
  });
});

describe("effective rent status — operator report is authoritative", () => {
  const base = { dueOn: "2026-03-07", riderReport: null, operatorReport: null };
  it("due before the date, missed after it", () => {
    expect(effectiveRentStatus(base, "2026-03-06")).toBe("due");
    expect(effectiveRentStatus(base, "2026-03-08")).toBe("missed");
  });
  it("rider self-report is provisional", () => {
    expect(effectiveRentStatus({ ...base, riderReport: "paid_on_time" }, "2026-03-08")).toBe("paid_on_time");
  });
  it("operator report overrides the rider", () => {
    expect(
      effectiveRentStatus({ ...base, riderReport: "paid_on_time", operatorReport: "missed" }, "2026-03-08"),
    ).toBe("missed");
  });
});

describe("S4 nudge trigger", () => {
  const ok: NudgeCheck = {
    cohort: "pilot",
    payoutJustLanded: true,
    today: MONDAY,
    unpaid: { dueOn: "2026-03-04", amountPaise: 2450 * R },
    rentPotPaise: 2450 * R,
    dismissedToday: false,
  };

  it("fires when a payout lands, rent is due within 3 days and the pot covers it", () => {
    expect(shouldNudge(ok)).toBe(true);
  });
  it("fires for overdue rent too", () => {
    expect(shouldNudge({ ...ok, unpaid: { dueOn: "2026-02-28", amountPaise: 2450 * R } })).toBe(true);
  });
  it("needs a fresh payout", () => {
    expect(shouldNudge({ ...ok, payoutJustLanded: false })).toBe(false);
  });
  it("not when rent is more than 3 days out", () => {
    expect(shouldNudge({ ...ok, unpaid: { dueOn: "2026-03-06", amountPaise: 2450 * R } })).toBe(false);
  });
  it("exactly 3 days out still fires", () => {
    expect(shouldNudge({ ...ok, unpaid: { dueOn: "2026-03-05", amountPaise: 2450 * R } })).toBe(true);
  });
  it("not when the pot cannot cover one instalment", () => {
    expect(shouldNudge({ ...ok, rentPotPaise: 2449 * R })).toBe(false);
  });
  it("never for the control cohort", () => {
    expect(shouldNudge({ ...ok, cohort: "control" })).toBe(false);
  });
  it("not when already dismissed today, or nothing is unpaid", () => {
    expect(shouldNudge({ ...ok, dismissedToday: true })).toBe(false);
    expect(shouldNudge({ ...ok, unpaid: null })).toBe(false);
  });
});

describe("UPI intent link", () => {
  it("builds a spec-shaped upi://pay link with encoded fields", () => {
    const link = buildUpiIntent({
      payeeVpa: "quickride.rent@okicici",
      payeeName: "QuickRide EV Fleet",
      amountPaise: 350 * R,
      note: "Rent GM-R01 2026-03-07",
      txnRef: "GM-R01-20260307-1",
    });
    expect(link).toBe(
      "upi://pay?pa=quickride.rent%40okicici&pn=QuickRide%20EV%20Fleet&am=350.00&cu=INR" +
        "&tn=Rent%20GM-R01%202026-03-07&tr=GMR0120260307" + "1",
    );
  });

  it("formats paise to two decimals", () => {
    const link = buildUpiIntent({ payeeVpa: "a.b@ybl", payeeName: "X", amountPaise: 245005, note: "n", txnRef: "t1" });
    expect(link).toContain("am=2450.05");
  });

  it("refuses invalid VPAs and non-positive amounts", () => {
    expect(() => buildUpiIntent({ payeeVpa: "nope", payeeName: "X", amountPaise: 100, note: "", txnRef: "t" })).toThrow();
    expect(() => buildUpiIntent({ payeeVpa: "a@ybl", payeeName: "X", amountPaise: 0, note: "", txnRef: "t" })).toThrow();
  });
});
