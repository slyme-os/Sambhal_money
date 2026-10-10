// Seed data (SPEC §8): one operator, 25 pilot + 25 control riders, 30 days of
// history. Every ledger is produced by the real sweep engine, so seeded pots obey
// the same invariants as live ones. Deterministic for a given `now`.
//
// Everything here is FAKE and marked entry_method = 'seed':
//   • phone numbers start +91 0…, which no Indian mobile number does;
//   • the payee VPA uses the non-existent handle "@example", so a demo UPI intent
//     can never reach a real account.

import { DEFAULTS } from "./config";
import { addDays, istDate, istInstant, weekday, workDay, workDayStart } from "./day";
import { hash32, mulberry32, seedUuid } from "./ids";
import { emptyPots } from "./ledger";
import { dueDatesBetween, effectiveRentStatus, nextDueOn, paidStatusFor, shouldNudge } from "./rent";
import { sweepPayout } from "./sweep";
import type {
  Allocation,
  Cohort,
  Consent,
  Nudge,
  Operator,
  Payout,
  PayoutSource,
  RentAgreement,
  RentEvent,
  RentStatus,
  Rider,
  ShockCover,
  ShockEvent,
  Spend,
  Withdrawal,
} from "./types";
import { POT_KINDS } from "./types";

export const SEED_DAYS = 30;
export const RIDERS_PER_COHORT = 25;
export const DEMO_RIDER_INDEX = 0;
export const CONSENT_VERSION = "2026-10-v1";

export const DEMO_OPERATOR: Operator = {
  id: seedUuid("operator:demo"),
  name: "QuickRide EV (Demo)",
  city: "Bengaluru",
  contactName: "Fleet desk",
  contactPhone: "+910000000000",
  code: "QRDEMO",
  payeeVpa: "quickride.rent.demo@example",
};

const NAMES = [
  "Ravi Kumar", "Suresh Gowda", "Imran Pasha", "Manjunath R", "Arjun Naik", "Prakash Shetty",
  "Venkatesh B", "Syed Afzal", "Mohan Raj", "Kiran Kumar", "Santosh Patil", "Naveen Reddy",
  "Abdul Rehman", "Ramesh Babu", "Deepak Yadav", "Harish M", "Shivakumar S", "Rajesh Singh",
  "Anil Kumar", "Gopal Krishna", "Mahesh Hegde", "Faizan Khan", "Lokesh N", "Vinod Kumar",
  "Chandan Das", "Basavaraj H", "Sunil Jadhav", "Praveen K", "Ajay Verma", "Nagaraj T",
  "Ravi Teja", "Sandeep Kumar", "Yusuf Ali", "Mallikarjun P", "Dinesh Rao", "Sachin Pawar",
  "Rakesh Sharma", "Girish Kamath", "Ashok Kumar", "Pradeep Gowda", "Salman Shaikh", "Umesh K",
  "Raju Thapa", "Vijay Kumar", "Arun Prasad", "Siddharth B", "Manoj Tiwari", "Kumar Swamy",
  "Irfan Ahmed", "Satish Naidu",
];

const PLATFORMS: PayoutSource[] = ["rapido", "zepto", "swiggy", "blinkit"];
const SHOCKS = ["Bike repair", "Puncture", "Fever, missed 2 days", "Phone screen broke", "Family function", "Traffic challan"];

export interface RiderBundle {
  rider: Rider;
  consents: Consent[];
  payouts: Payout[];
  spends: Spend[];
  allocations: Allocation[];
  withdrawals: Withdrawal[];
  rentAgreement: RentAgreement;
  rentEvents: RentEvent[];
  nudges: Nudge[];
  shocks: ShockEvent[];
}

export interface Fleet {
  operator: Operator;
  riders: RiderBundle[];
}

export interface SeedOptions {
  /** The moment the seed is generated for. History is the 30 days before it. */
  now: string;
}

type SimEvent =
  | { kind: "payout"; at: number; payout: Payout }
  | { kind: "spend"; at: number; spend: Spend }
  | { kind: "rentDue"; at: number; dueOn: string }
  | { kind: "rentLate"; at: number }
  | { kind: "latePay"; at: number; dueOn: string }
  | { kind: "shock"; at: number };

const R = 100;
const MIN = 60_000;

export function riderName(index: number): string {
  return NAMES[index % NAMES.length];
}

export function generateRider(index: number, cohort: Cohort, opts: SeedOptions): RiderBundle {
  const rng = mulberry32(hash32(`gmoney-seed-rider-${index}`));
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
  const nowMs = Date.parse(opts.now);
  const today = workDay(opts.now);
  const calToday = istDate(opts.now);
  const isDemo = index === DEMO_RIDER_INDEX;
  const startDay = addDays(today, -SEED_DAYS);
  const createdAt = workDayStart(startDay);
  const riderId = seedUuid(`rider:${index}`);
  const id = (key: string) => seedUuid(`${riderId}:${key}`);

  const rider: Rider = {
    id: riderId,
    name: riderName(index),
    phone: `+9100000${String(index + 1).padStart(5, "0")}`,
    operatorId: DEMO_OPERATOR.id,
    city: "Bengaluru",
    language: isDemo ? "en" : pick(["en", "en", "hi", "kn"] as const),
    floorPaise: isDemo ? DEFAULTS.floorPaise : pick([250, 300, 300, 300, 350]) * R,
    cohort,
    split: {
      rentShareBp: DEFAULTS.rentShareBp,
      emergencyShareBp: DEFAULTS.emergencyShareBp,
      emergencyTargetPaise: DEFAULTS.emergencyTargetPaise,
      savingsTargetPaise: null,
    },
    onboardedAt: createdAt,
    createdAt,
  };

  // Two riders per cohort have not consented to sharing — the dashboard must hide them.
  const shares = isDemo || index % 13 !== 7;
  const consents: Consent[] = [
    { id: id("consent:app"), riderId, purpose: "app_use", granted: true, version: CONSENT_VERSION, grantedAt: createdAt, withdrawnAt: null },
  ];
  if (shares) {
    consents.push({ id: id("consent:share"), riderId, purpose: "operator_share", granted: true, version: CONSENT_VERSION, grantedAt: createdAt, withdrawnAt: null });
  }

  // The demo rider's rent falls due in two days, so logging a payout shows the nudge.
  const dueWeekday = isDemo ? weekday(addDays(calToday, 2)) : index % 3 === 0 ? 6 : 1;
  const rentAgreement: RentAgreement = {
    id: id("agreement"),
    riderId,
    operatorId: DEMO_OPERATOR.id,
    amountPaise: DEFAULTS.weeklyRentPaise,
    cadence: "weekly",
    dueWeekday,
    nextDueOn: nextDueOn({ cadence: "weekly", dueWeekday }, calToday),
    payeeVpa: DEMO_OPERATOR.payeeVpa,
    payeeName: DEMO_OPERATOR.name,
    active: true,
  };
  const rentEvents = new Map<string, RentEvent>();
  for (const dueOn of dueDatesBetween(rentAgreement, startDay, rentAgreement.nextDueOn)) {
    rentEvents.set(dueOn, {
      id: id(`rent:${dueOn}`),
      rentAgreementId: rentAgreement.id,
      riderId,
      dueOn,
      amountPaise: rentAgreement.amountPaise,
      status: "due",
      paidAt: null,
      method: null,
      riderReport: null,
      riderReportedAt: null,
      operatorReport: null,
      operatorReportedAt: null,
    });
  }

  const primary = pick(PLATFORMS);
  const secondary = pick(PLATFORMS.filter((p) => p !== primary));
  const strength = 0.7 + rng() * 0.6; // some riders earn more than others

  const payouts: Payout[] = [];
  const spends: Spend[] = [];
  const allocations: Allocation[] = [];
  const withdrawals: Withdrawal[] = [];
  const nudges: Nudge[] = [];
  const shocks: ShockEvent[] = [];
  const balances = emptyPots();
  const actualPaid = new Map<string, string>(); // dueOn → instant paid
  const lateQueue = new Map<string, number>(); // dueOn → days late planned

  const withdraw = (potKind: Withdrawal["potKind"], amountPaise: number, at: number, reason: Withdrawal["reason"]) => {
    if (amountPaise <= 0) return;
    const requestedAt = new Date(at).toISOString();
    withdrawals.push({
      id: id(`withdrawal:${withdrawals.length}`),
      potKind,
      amountPaise,
      reason,
      status: "done",
      requestedAt,
      settledAt: istInstant(addDays(istDate(requestedAt), 1), 11),
    });
    balances[potKind] -= amountPaise;
  };

  const payRent = (dueOn: string, at: number, viaNudge: boolean) => {
    const ev = rentEvents.get(dueOn)!;
    const iso = new Date(at).toISOString();
    actualPaid.set(dueOn, iso);
    withdraw("rent", Math.min(balances.rent, ev.amountPaise), at, "rent");
    ev.paidAt = iso;
    if (cohort === "pilot") {
      ev.method = "upi_intent";
      ev.riderReport = paidStatusFor(dueOn, istDate(iso));
      ev.riderReportedAt = new Date(at + 3 * MIN).toISOString();
    }
    void viaNudge;
  };

  const earliestUnpaid = (asOf: string) => {
    for (const ev of rentEvents.values()) {
      if (!actualPaid.has(ev.dueOn) && ev.dueOn <= addDays(asOf, DEFAULTS.nudgeWindowDays)) {
        // overdue more than 3 days counts as missed for the pilot's own behaviour
        if (ev.dueOn < addDays(asOf, -3)) continue;
        return ev;
      }
    }
    return null;
  };

  let currentDay = "";
  let earnedBefore = 0;
  let carry = 0;

  for (let day = startDay; day <= today; day = addDays(day, 1)) {
    const isToday = day === today;
    const events: SimEvent[] = [];

    // ── payouts: daily total ₹450–1,900 with a long tail, split into 3–7 payouts ──
    const zeroDay = !(isDemo && isToday) && rng() < 0.08;
    const total = zeroDay ? 0 : Math.min(1900, Math.round(450 + 1450 * Math.pow(rng(), 1.3) * strength));
    if (total > 0) {
      const n = 3 + Math.floor(rng() * 5);
      const weights = Array.from({ length: n }, () => 0.3 + rng());
      const wsum = weights.reduce((s, w) => s + w, 0);
      const amounts = weights.map((w) => Math.max(20, Math.round((w / wsum) * total)));
      amounts[amounts.length - 1] += total - amounts.reduce((s, a) => s + a, 0);
      if (amounts[amounts.length - 1] < 20) amounts[amounts.length - 1] = 20;

      // minutes after 4am: 7:30am … 1:00am next morning, at least 3 minutes apart
      const minutes = Array.from({ length: n }, () => 210 + Math.floor(rng() * 1050)).sort((a, b) => a - b);
      for (let i = 1; i < minutes.length; i++) if (minutes[i] < minutes[i - 1] + 3) minutes[i] = minutes[i - 1] + 3;

      amounts.forEach((rupees, i) => {
        const occurredAt = istInstant(day, 4, minutes[i]);
        const at = Date.parse(occurredAt);
        if (at >= nowMs) return;
        const source: PayoutSource = rng() < 0.06 ? "cash" : rng() < 0.7 ? primary : secondary;
        events.push({
          kind: "payout",
          at,
          payout: { id: id(`payout:${day}:${i}`), riderId, amountPaise: rupees * R, source, occurredAt, entryMethod: "seed", createdAt: occurredAt },
        });
      });
    }

    // The demo rider always has something earned today so the home screen is never empty.
    if (isDemo && isToday && !events.some((e) => e.kind === "payout")) {
      const dayStart = Date.parse(workDayStart(today));
      const slots = [nowMs - 95 * MIN, nowMs - 40 * MIN].filter((t) => t > dayStart);
      const amounts = [260, 410];
      (slots.length ? slots : [Math.min(nowMs - MIN, dayStart + MIN)]).forEach((at, i) => {
        const occurredAt = new Date(at).toISOString();
        events.push({
          kind: "payout",
          at,
          payout: { id: id(`payout:${day}:demo${i}`), riderId, amountPaise: amounts[i] * R, source: primary, occurredAt, entryMethod: "seed", createdAt: occurredAt },
        });
      });
    }

    // ── spends: petrol and food on working days ──
    if (total > 0 || (isDemo && isToday)) {
      for (const [hour, lo, hi, key] of [[9, 100, 180, "petrol"], [14, 60, 140, "food"]] as const) {
        const occurredAt = istInstant(day, hour, Math.floor(rng() * 50));
        const at = Date.parse(occurredAt);
        const rupees = lo + Math.floor(rng() * (hi - lo));
        if (at < nowMs && !(isDemo && isToday && key === "food")) {
          events.push({ kind: "spend", at, spend: { id: id(`spend:${day}:${key}`), riderId, amountPaise: rupees * R, occurredAt, entryMethod: "seed", createdAt: occurredAt } });
        }
      }
    }

    // ── rent: due-day settlement at 9pm, late catch-up checks at 8pm ──
    const calDay = day; // working day d's evening is calendar day d
    if (rentEvents.has(calDay)) events.push({ kind: "rentDue", at: Date.parse(istInstant(calDay, 21)), dueOn: calDay });
    if (cohort === "pilot") events.push({ kind: "rentLate", at: Date.parse(istInstant(calDay, 20)) });
    for (const [dueOn, late] of lateQueue) {
      if (addDays(dueOn, late) === calDay) events.push({ kind: "latePay", at: Date.parse(istInstant(calDay, 19)), dueOn });
    }

    // ── shocks ──
    if (!(isDemo && isToday) && rng() < 0.05) events.push({ kind: "shock", at: Date.parse(istInstant(day, 16, Math.floor(rng() * 59))) });

    events.sort((a, b) => a.at - b.at);

    for (const event of events) {
      if (event.at >= nowMs) continue;
      const asOf = istDate(event.at);

      if (event.kind === "payout") {
        const p = event.payout;
        payouts.push(p);
        const pDay = workDay(p.occurredAt);
        if (pDay !== currentDay) {
          currentDay = pDay;
          earnedBefore = 0;
          carry = 0;
        }
        const result = sweepPayout({
          payoutPaise: p.amountPaise,
          earnedTodayBeforePaise: earnedBefore,
          carryInPaise: carry,
          balances: { ...balances },
          floorPaise: rider.floorPaise,
          rentTargetPaise: rentAgreement.amountPaise,
          split: rider.split,
          minSweepPaise: DEFAULTS.minSweepPaise,
        });
        for (const kind of POT_KINDS) {
          const amountPaise = result.allocations[kind];
          if (amountPaise > 0) {
            allocations.push({ id: id(`alloc:${p.id}:${kind}`), payoutId: p.id, potKind: kind, amountPaise, createdAt: p.occurredAt });
            balances[kind] += amountPaise;
          }
        }
        earnedBefore += p.amountPaise;
        carry = result.carryOutPaise;

        if (cohort === "pilot" && !(isDemo && isToday)) {
          const unpaid = earliestUnpaid(asOf);
          const nudgedToday = nudges.some((n) => n.context.rentEventId === unpaid?.id && istDate(n.sentAt) === asOf);
          if (
            unpaid &&
            shouldNudge({ cohort, payoutJustLanded: true, today: asOf, unpaid, rentPotPaise: balances.rent, dismissedToday: nudgedToday })
          ) {
            const acted = rng() < 0.85;
            nudges.push({
              id: id(`nudge:${p.id}`),
              riderId,
              kind: "rent_now",
              sentAt: p.occurredAt,
              actedAt: acted ? new Date(event.at + MIN).toISOString() : null,
              dismissedAt: acted ? null : new Date(event.at + MIN).toISOString(),
              context: { payoutId: p.id, rentEventId: unpaid.id, amountPaise: unpaid.amountPaise },
            });
            if (acted) payRent(unpaid.dueOn, event.at + MIN, true);
          }
        }
      } else if (event.kind === "spend") {
        spends.push(event.spend);
      } else if (event.kind === "rentDue") {
        if (actualPaid.has(event.dueOn)) continue;
        const ev = rentEvents.get(event.dueOn)!;
        if (cohort === "pilot") {
          const r = rng();
          if (balances.rent >= ev.amountPaise) {
            if (r < 0.95) payRent(event.dueOn, event.at, false);
          } else if (r < 0.5) payRent(event.dueOn, event.at, false); // pays partly from his own pocket
          else if (r < 0.8) lateQueue.set(event.dueOn, 1 + Math.floor(rng() * 3));
        } else {
          const r = rng();
          if (r < 0.6) payRent(event.dueOn, event.at, false);
          else if (r < 0.86) lateQueue.set(event.dueOn, 1 + Math.floor(rng() * 3));
          // else: missed
        }
      } else if (event.kind === "rentLate") {
        for (const ev of rentEvents.values()) {
          if (actualPaid.has(ev.dueOn) || ev.dueOn >= asOf || ev.dueOn < addDays(asOf, -3)) continue;
          if (balances.rent >= ev.amountPaise) payRent(ev.dueOn, event.at, false);
        }
      } else if (event.kind === "latePay") {
        if (!actualPaid.has(event.dueOn)) payRent(event.dueOn, event.at, false);
      } else if (event.kind === "shock") {
        const amountPaise = (300 + Math.floor(Math.pow(rng(), 1.5) * 2200)) * R;
        let coveredBy: ShockCover;
        const r = rng();
        if (cohort === "pilot") {
          coveredBy = balances.emergency >= amountPaise && r < 0.85 ? "pot" : r < 0.5 ? "borrowed" : r < 0.8 ? "unpaid" : "other";
        } else {
          coveredBy = balances.emergency >= amountPaise && r < 0.1 ? "pot" : r < 0.55 ? "borrowed" : r < 0.8 ? "unpaid" : "other";
        }
        if (coveredBy === "pot") withdraw("emergency", amountPaise, event.at, "emergency");
        shocks.push({ id: id(`shock:${day}`), riderId, description: pick(SHOCKS), amountPaise, coveredBy, occurredAt: new Date(event.at).toISOString() });
      }
    }
  }

  // ── operator reconciliation: authoritative reports for events at least 2 days old ──
  for (const ev of rentEvents.values()) {
    if (ev.dueOn > addDays(calToday, -2)) continue;
    const paidAt = actualPaid.get(ev.dueOn);
    let truth: RentStatus = paidAt ? paidStatusFor(ev.dueOn, istDate(paidAt)) : "missed";
    // A few self-reports said "on time" but the money reached the operator a day late.
    if (truth === "paid_on_time" && ev.riderReport && rng() < 0.04) truth = "paid_late";
    ev.operatorReport = truth;
    ev.operatorReportedAt = istInstant(addDays(ev.dueOn, 2), 10);
    if (!ev.method && paidAt) ev.method = "operator_reported";
  }
  const events = [...rentEvents.values()].map((ev) => ({ ...ev, status: effectiveRentStatus(ev, calToday) }));

  return {
    rider,
    consents,
    payouts,
    spends,
    allocations,
    withdrawals,
    rentAgreement,
    rentEvents: events,
    nudges,
    shocks,
  };
}

/** The whole demo fleet: indices 0–24 pilot, 25–49 control. */
export function generateFleet(opts: SeedOptions): Fleet {
  const riders: RiderBundle[] = [];
  for (let i = 0; i < RIDERS_PER_COHORT * 2; i++) {
    riders.push(generateRider(i, i < RIDERS_PER_COHORT ? "pilot" : "control", opts));
  }
  return { operator: DEMO_OPERATOR, riders };
}
