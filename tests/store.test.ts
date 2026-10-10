import { describe, expect, it } from "vitest";
import { addDays, istDate, istInstant, weekday, workDay } from "@/lib/day";
import { potBalances } from "@/lib/ledger";
import { demoState } from "@/lib/store/persist";
import {
  balancesOf,
  confirmRent,
  dismissNudge,
  hasConsent,
  importPayouts,
  logPayout,
  logShock,
  logSpend,
  onboard,
  openNudge,
  requestWithdrawal,
  setConsent,
  startRentPayment,
  sync,
  todayOf,
  unpaidRent,
  updateRentAgreement,
  updateSettings,
  type RiderState,
} from "@/lib/store/state";

const R = 100;
const NOW = "2026-10-10T08:30:00.000Z"; // Saturday 2pm IST
const LATER = "2026-10-10T09:30:00.000Z";

function freshRider(overrides: Partial<Parameters<typeof onboard>[0]> = {}): RiderState {
  return onboard(
    {
      phone: "+910000000777",
      name: "Test Rider",
      language: "hi",
      operatorCode: "qrdemo",
      rentAmountPaise: 2450 * R,
      rentCadence: "weekly",
      dueWeekday: weekday(addDays(istDate(NOW), 2)),
      floorPaise: 300 * R,
      operatorShare: true,
      ...overrides,
    },
    NOW,
  );
}

/** Forces the pilot cohort so nudge behaviour is testable regardless of phone hash. */
const asPilot = (s: RiderState): RiderState => ({ ...s, rider: { ...s.rider, cohort: "pilot" } });

describe("onboarding (S7)", () => {
  it("creates a rider with consents, rent agreement and the next rent event", () => {
    const s = freshRider();
    expect(s.mode).toBe("local");
    expect(s.operator?.code).toBe("QRDEMO");
    expect(hasConsent(s, "app_use")).toBe(true);
    expect(hasConsent(s, "operator_share")).toBe(true);
    expect(s.rentAgreement?.nextDueOn).toBe(addDays(istDate(NOW), 2));
    expect(s.rentEvents).toHaveLength(1);
    expect(balancesOf(s)).toEqual({ rent: 0, emergency: 0, savings: 0 });
  });

  it("works without a fleet: no rent agreement, no sharing consent", () => {
    const s = freshRider({ operatorCode: "", operatorShare: true });
    expect(s.operator).toBeNull();
    expect(s.rentAgreement).toBeNull();
    expect(hasConsent(s, "operator_share")).toBe(false);
  });
});

describe("logging payouts (S2)", () => {
  it("bad day: nothing swept below the floor, and S2 can say so", () => {
    const { state, outcome } = logPayout(freshRider(), { amountPaise: 200 * R, source: "zepto" }, NOW);
    expect(outcome.toFloorPaise).toBe(200 * R);
    expect(outcome.surplusPaise).toBe(0);
    expect(state.allocations).toHaveLength(0);
    expect(todayOf(state, NOW).safeToSpendPaise).toBe(200 * R);
  });

  it("splits surplus with rent first and keeps the ledger invariant", () => {
    const { state, outcome } = logPayout(freshRider(), { amountPaise: 1400 * R, source: "rapido" }, NOW);
    expect(outcome.toFloorPaise).toBe(300 * R);
    expect(outcome.allocations).toEqual({ rent: 770 * R, emergency: 132 * R, savings: 198 * R });
    expect(balancesOf(state)).toEqual(potBalances(state.allocations, state.withdrawals));
  });

  it("safe to spend falls as the rider logs spends, never below zero", () => {
    let { state } = logPayout(freshRider(), { amountPaise: 1400 * R, source: "rapido" }, NOW);
    state = logSpend(state, 120 * R, NOW);
    expect(todayOf(state, NOW).safeToSpendPaise).toBe(180 * R);
    state = logSpend(state, 500 * R, NOW);
    expect(todayOf(state, NOW).safeToSpendPaise).toBe(0);
  });

  it("rejects zero and negative amounts", () => {
    expect(() => logPayout(freshRider(), { amountPaise: 0, source: "cash" }, NOW)).toThrow();
    expect(() => logSpend(freshRider(), -5, NOW)).toThrow();
  });
});

describe("the rent nudge (S4)", () => {
  function readyToNudge() {
    // Fill the rent pot first: ₹2,450 needs ~₹3,500 surplus at 70%.
    let s = asPilot(freshRider());
    s = logPayout(s, { amountPaise: 1900 * R, source: "rapido", occurredAt: istInstant(addDays(istDate(NOW), -2), 12) }, NOW).state;
    s = logPayout(s, { amountPaise: 1900 * R, source: "rapido", occurredAt: istInstant(addDays(istDate(NOW), -1), 12) }, NOW).state;
    s = logPayout(s, { amountPaise: 1200 * R, source: "rapido", occurredAt: istInstant(addDays(istDate(NOW), -1), 18) }, NOW).state;
    return s;
  }

  it("backdated payouts never nudge; a fresh payout does once the pot covers rent", () => {
    const s = readyToNudge();
    expect(balancesOf(s).rent).toBe(2450 * R);
    expect(s.nudges).toHaveLength(0);
    const { nudge } = logPayout(s, { amountPaise: 500 * R, source: "zepto" }, NOW);
    expect(nudge).not.toBeNull();
    expect(nudge!.context.amountPaise).toBe(2450 * R);
  });

  it("control riders are never nudged", () => {
    const s = { ...readyToNudge(), rider: { ...readyToNudge().rider, cohort: "control" as const } };
    expect(logPayout(s, { amountPaise: 500 * R, source: "zepto" }, NOW).nudge).toBeNull();
  });

  it("yes → UPI intent → 'भेज दिया? हाँ' records a provisional report and empties the rent pot", () => {
    const { state, nudge } = logPayout(readyToNudge(), { amountPaise: 500 * R, source: "zepto" }, NOW);
    const started = startRentPayment(state, nudge!.context.rentEventId, nudge!.id, NOW);
    expect(started.upiLink).toMatch(/^upi:\/\/pay\?pa=quickride\.rent\.demo%40example&pn=.*&am=2450\.00&cu=INR&tn=.*&tr=GM/);
    expect(started.state.pendingRent?.rentEventId).toBe(nudge!.context.rentEventId);
    expect(openNudge(started.state, NOW)).toBeNull();

    const confirmed = confirmRent(started.state, true, LATER);
    const ev = confirmed.rentEvents.find((e) => e.id === nudge!.context.rentEventId)!;
    expect(ev).toMatchObject({ riderReport: "paid_on_time", method: "upi_intent", operatorReport: null, status: "paid_on_time" });
    expect(balancesOf(confirmed).rent).toBe(0);
    expect(confirmed.pendingRent).toBeNull();
    expect(unpaidRent(confirmed, LATER)?.id).not.toBe(ev.id);
  });

  it("'नहीं' records nothing and leaves the pot alone", () => {
    const { state, nudge } = logPayout(readyToNudge(), { amountPaise: 500 * R, source: "zepto" }, NOW);
    const started = startRentPayment(state, nudge!.context.rentEventId, nudge!.id, NOW).state;
    const declined = confirmRent(started, false, LATER);
    expect(balancesOf(declined).rent).toBe(2450 * R);
    expect(declined.rentEvents.find((e) => e.id === nudge!.context.rentEventId)!.riderReport).toBeNull();
  });

  it("'बाद में' dismisses for the rest of the day", () => {
    const { state, nudge } = logPayout(readyToNudge(), { amountPaise: 500 * R, source: "zepto" }, NOW);
    const dismissed = dismissNudge(state, nudge!.id, NOW);
    expect(openNudge(dismissed, NOW)).toBeNull();
    expect(logPayout(dismissed, { amountPaise: 300 * R, source: "zepto" }, LATER).nudge).toBeNull();
  });
});

describe("withdrawals (S3) — by next working day, never instant", () => {
  it("creates a pending withdrawal settling on the next working day", () => {
    const { state } = logPayout(freshRider(), { amountPaise: 1400 * R, source: "rapido" }, NOW);
    const s = requestWithdrawal(state, "savings", 100 * R, "user", NOW);
    const w = s.withdrawals.at(-1)!;
    expect(w.status).toBe("pending");
    expect(istDate(w.settledAt!)).toBe("2026-10-12"); // Saturday → Monday (skips Sunday)
    expect(balancesOf(s).savings).toBe(98 * R);
    expect(sync(s, "2026-10-12T13:00:00.000Z").withdrawals.at(-1)!.status).toBe("done");
  });

  it("cannot withdraw more than the pot holds", () => {
    const { state } = logPayout(freshRider(), { amountPaise: 1400 * R, source: "rapido" }, NOW);
    expect(() => requestWithdrawal(state, "emergency", 999 * R, "user", NOW)).toThrow(/exceeds/);
  });
});

describe("shock log (S5)", () => {
  it("records how the shock was covered and optionally draws the emergency pot", () => {
    const { state } = logPayout(freshRider(), { amountPaise: 1400 * R, source: "rapido" }, NOW);
    const s = logShock(state, { amountPaise: 400 * R, description: "Puncture", coveredBy: "pot", takeFromEmergencyPaise: 400 * R }, NOW);
    expect(s.shocks.at(-1)).toMatchObject({ coveredBy: "pot", amountPaise: 400 * R });
    expect(s.withdrawals.at(-1)).toMatchObject({ potKind: "emergency", reason: "emergency", amountPaise: 132 * R }); // capped at balance
    const borrowed = logShock(state, { amountPaise: 2000 * R, description: "Bike repair", coveredBy: "borrowed" }, NOW);
    expect(borrowed.withdrawals).toHaveLength(0);
  });
});

describe("settings and consent (S6)", () => {
  it("changing the floor recomputes today's allocations", () => {
    const { state } = logPayout(freshRider(), { amountPaise: 1400 * R, source: "rapido" }, NOW);
    const s = updateSettings(state, { floorPaise: 500 * R }, NOW);
    expect(todayOf(s, NOW).sweptPaise).toBe(900 * R);
  });

  it("withdrawing operator sharing keeps savings working, and can be re-granted", () => {
    let s = setConsent(freshRider(), "operator_share", false, NOW);
    expect(hasConsent(s, "operator_share")).toBe(false);
    expect(s.consents.find((c) => c.purpose === "operator_share")!.withdrawnAt).toBe(NOW);
    s = logPayout(s, { amountPaise: 1400 * R, source: "rapido" }, NOW).state;
    expect(balancesOf(s).rent).toBe(770 * R);
    s = setConsent(s, "operator_share", true, LATER);
    expect(hasConsent(s, "operator_share")).toBe(true);
    expect(s.consents.filter((c) => c.purpose === "operator_share")).toHaveLength(2); // history kept
  });

  it("changing rent terms regenerates only future unpaid events", () => {
    const s = updateRentAgreement(freshRider(), { amountPaise: 350 * R, cadence: "daily", dueWeekday: null }, NOW);
    expect(s.rentAgreement?.amountPaise).toBe(350 * R);
    expect(s.rentEvents.every((e) => e.dueOn >= istDate(NOW))).toBe(true);
    expect(s.rentEvents[0].amountPaise).toBe(350 * R);
  });
});

describe("CSV import", () => {
  it("adds backdated payouts, recomputes from that day, and re-import is a no-op", () => {
    const base = logPayout(freshRider(), { amountPaise: 400 * R, source: "rapido" }, NOW).state;
    const rows = [{ occurredAt: istInstant(istDate(NOW), 7), amountPaise: 300 * R, source: "zepto" as const }];
    const first = importPayouts(base, rows, NOW);
    expect(first.added).toBe(1);
    // The 7am CSV payout now fills the floor, so the later ₹400 is all surplus.
    expect(todayOf(first.state, NOW).sweptPaise).toBe(400 * R);
    const again = importPayouts(first.state, rows, NOW);
    expect(again.added).toBe(0);
    expect(again.state).toBe(first.state);
  });
});

describe("the seeded demo", () => {
  it("opens with history, earnings today, and a full rent pot due in two days", () => {
    const s = demoState(NOW);
    expect(s.mode).toBe("demo");
    expect(s.payouts.length).toBeGreaterThan(60);
    expect(todayOf(s, NOW).earnedPaise).toBeGreaterThan(0);
    expect(s.payouts.some((p) => workDay(p.occurredAt) === workDay(NOW))).toBe(true);
    expect(unpaidRent(s, NOW)?.dueOn).toBe(addDays(istDate(NOW), 2));
  });

  it("logging any payout in the demo shows the rent nudge", () => {
    const s = demoState(NOW);
    const { nudge } = logPayout(s, { amountPaise: 1420 * R, source: "rapido" }, NOW);
    expect(nudge).not.toBeNull();
  });
});
