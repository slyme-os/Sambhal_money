// Operator dashboard projection (SPEC §7, HR-7).
//
// The operator sees rent paid: yes / no / late — and nothing else. The database
// enforces this with RLS; this module enforces the same shape in the app. Its
// input type carries no balances, payouts, spends or shocks, so code downstream of
// `toOperatorInput` cannot leak them even by accident.

import { addDays, weekStart } from "./day";
import { effectiveRentStatus } from "./rent";
import type { Cohort, Consent, RentEvent, RentStatus, Rider } from "./types";

export type OperatorRentEvent = Pick<
  RentEvent,
  "id" | "dueOn" | "amountPaise" | "riderReport" | "operatorReport" | "paidAt" | "method"
>;

export interface OperatorRiderInput {
  riderId: string;
  name: string;
  phone: string;
  cohort: Cohort;
  rentEvents: OperatorRentEvent[];
}

/** Strips a rider down to what an operator may see; null when consent is absent. */
export function toOperatorInput(source: {
  rider: Pick<Rider, "id" | "name" | "phone" | "cohort">;
  consents: readonly Pick<Consent, "purpose" | "granted" | "withdrawnAt">[];
  rentEvents: readonly RentEvent[];
}): OperatorRiderInput | null {
  const consented = source.consents.some(
    (c) => c.purpose === "operator_share" && c.granted && c.withdrawnAt === null,
  );
  if (!consented) return null;
  return {
    riderId: source.rider.id,
    name: source.rider.name,
    phone: source.rider.phone,
    cohort: source.rider.cohort,
    rentEvents: source.rentEvents.map((e) => ({
      id: e.id,
      dueOn: e.dueOn,
      amountPaise: e.amountPaise,
      riderReport: e.riderReport,
      operatorReport: e.operatorReport,
      paidAt: e.paidAt,
      method: e.method,
    })),
  };
}

export interface OperatorRow {
  riderId: string;
  name: string;
  phone: string;
  cohort: Cohort;
  onTimeStreak: number;
  last: {
    eventId: string;
    dueOn: string;
    status: RentStatus;
    /** True when only the rider's self-report backs this status. */
    provisional: boolean;
  } | null;
  /** Due today or in the future and not yet paid. */
  upcoming: { eventId: string; dueOn: string; provisionalPaid: boolean } | null;
}

export interface CohortRate {
  onTime: number;
  total: number;
  rate: number | null;
}

export interface WeekComparison {
  weekStart: string;
  pilot: CohortRate;
  control: CohortRate;
}

export interface OperatorView {
  rows: OperatorRow[];
  weeks: WeekComparison[];
  thisWeek: WeekComparison;
  cumulative: { pilot: CohortRate; control: CohortRate };
}

function rate(onTime: number, total: number): CohortRate {
  return { onTime, total, rate: total === 0 ? null : onTime / total };
}

/** A rent event counts once its due date has passed or it has a paid status. */
function closedStatus(ev: OperatorRentEvent, today: string): RentStatus | null {
  const status = effectiveRentStatus(ev, today);
  if (status === "due") return null;
  if (ev.dueOn > today) return status === "missed" ? null : status;
  return status;
}

export function buildOperatorView(inputs: readonly OperatorRiderInput[], today: string, weeksBack = 5): OperatorView {
  const rows: OperatorRow[] = [];
  const thisWeekStart = weekStart(today);
  const weekStarts = Array.from({ length: weeksBack }, (_, i) => addDays(thisWeekStart, -7 * (weeksBack - 1 - i)));
  const buckets = new Map(weekStarts.map((w) => [w, { pilot: [0, 0], control: [0, 0] }]));
  const cumulative = { pilot: [0, 0], control: [0, 0] };

  for (const input of inputs) {
    const events = [...input.rentEvents].sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1));
    const closed = events
      .map((ev) => ({ ev, status: closedStatus(ev, today) }))
      .filter((x): x is { ev: OperatorRentEvent; status: RentStatus } => x.status !== null);

    for (const { ev, status } of closed) {
      const onTime = status === "paid_on_time" ? 1 : 0;
      const c = cumulative[input.cohort];
      c[0] += onTime;
      c[1] += 1;
      const bucket = buckets.get(weekStart(ev.dueOn));
      if (bucket) {
        bucket[input.cohort][0] += onTime;
        bucket[input.cohort][1] += 1;
      }
    }

    let streak = 0;
    for (let i = closed.length - 1; i >= 0 && closed[i].status === "paid_on_time"; i--) streak++;
    const lastClosed = closed.at(-1);
    const next = events.find((ev) => ev.dueOn >= today && closedStatus(ev, today) === null);

    rows.push({
      riderId: input.riderId,
      name: input.name,
      phone: input.phone,
      cohort: input.cohort,
      onTimeStreak: streak,
      last: lastClosed
        ? {
            eventId: lastClosed.ev.id,
            dueOn: lastClosed.ev.dueOn,
            status: lastClosed.status,
            provisional: lastClosed.ev.operatorReport === null && lastClosed.ev.riderReport !== null,
          }
        : null,
      upcoming: next ? { eventId: next.id, dueOn: next.dueOn, provisionalPaid: next.riderReport !== null } : null,
    });
  }

  const weeks = weekStarts.map((w) => {
    const b = buckets.get(w)!;
    return { weekStart: w, pilot: rate(b.pilot[0], b.pilot[1]), control: rate(b.control[0], b.control[1]) };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return {
    rows,
    weeks,
    thisWeek: weeks[weeks.length - 1],
    cumulative: { pilot: rate(cumulative.pilot[0], cumulative.pilot[1]), control: rate(cumulative.control[0], cumulative.control[1]) },
  };
}

function pct(r: CohortRate): string {
  return r.rate === null ? "" : (r.rate * 100).toFixed(1);
}

/** The comparison as CSV — what sells the next contract. */
export function comparisonCsv(view: OperatorView): string {
  const lines = ["week_start,pilot_on_time,pilot_total,pilot_on_time_pct,control_on_time,control_total,control_on_time_pct"];
  for (const w of view.weeks) {
    lines.push([w.weekStart, w.pilot.onTime, w.pilot.total, pct(w.pilot), w.control.onTime, w.control.total, pct(w.control)].join(","));
  }
  const c = view.cumulative;
  lines.push(["cumulative", c.pilot.onTime, c.pilot.total, pct(c.pilot), c.control.onTime, c.control.total, pct(c.control)].join(","));
  return lines.join("\n") + "\n";
}

/** +91 98••• ••123 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.slice(-10);
  return `+91 ${local.slice(0, 2)}••• ••${local.slice(-3)}`;
}
