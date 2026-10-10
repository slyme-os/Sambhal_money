// Rider state and every action a rider can take, as pure functions:
// (state, input, now) → new state. The React provider just holds the current value
// and persists it; all rules live here and in tests/store.test.ts.

import { DEFAULTS } from "../config";
import { addDays, istDate, istInstant, nextWorkingDay, workDay } from "../day";
import { hash32, newId } from "../ids";
import { daySummary, potBalances, replayFrom, type DaySummary, type PayoutOutcome } from "../ledger";
import { buildUpiIntent, dueDatesBetween, effectiveRentStatus, isPaid, nextDueOn, paidStatusFor, shouldNudge } from "../rent";
import { CONSENT_VERSION, DEMO_OPERATOR, type RiderBundle } from "../seed";
import type {
  Allocation,
  Consent,
  ConsentPurpose,
  Lang,
  Nudge,
  Operator,
  Payout,
  PayoutSource,
  PotAmounts,
  PotKind,
  RentAgreement,
  RentEvent,
  Rider,
  ShockCover,
  ShockEvent,
  Spend,
  SplitConfig,
  Withdrawal,
  WithdrawalReason,
} from "../types";

export interface RiderState {
  schema: 1;
  /** "demo" = the seeded demo rider; "local" = someone onboarded on this device. */
  mode: "demo" | "local";
  rider: Rider;
  operator: Operator | null;
  consents: Consent[];
  payouts: Payout[];
  spends: Spend[];
  allocations: Allocation[];
  withdrawals: Withdrawal[];
  rentAgreement: RentAgreement | null;
  rentEvents: RentEvent[];
  nudges: Nudge[];
  shocks: ShockEvent[];
  /** Set while the rider is in his UPI app; on return we ask "भेज दिया?". */
  pendingRent: { rentEventId: string; nudgeId: string | null; openedAt: string } | null;
}

export function fromBundle(bundle: RiderBundle, operator: Operator | null, mode: RiderState["mode"]): RiderState {
  return {
    schema: 1,
    mode,
    rider: bundle.rider,
    operator,
    consents: bundle.consents,
    payouts: bundle.payouts,
    spends: bundle.spends,
    allocations: bundle.allocations,
    withdrawals: bundle.withdrawals,
    rentAgreement: bundle.rentAgreement,
    rentEvents: bundle.rentEvents,
    nudges: bundle.nudges,
    shocks: bundle.shocks,
    pendingRent: null,
  };
}

// ─── Derived values ───────────────────────────────────────────────────────────

export function balancesOf(state: RiderState): PotAmounts {
  return potBalances(state.allocations, state.withdrawals);
}

export function todayOf(state: RiderState, now: string): DaySummary {
  return daySummary({
    day: workDay(now),
    floorPaise: state.rider.floorPaise,
    payouts: state.payouts,
    spends: state.spends,
    allocations: state.allocations,
  });
}

export function rentTarget(state: RiderState): number {
  return state.rentAgreement?.active ? state.rentAgreement.amountPaise : 0;
}

export function hasConsent(state: RiderState, purpose: ConsentPurpose): boolean {
  return state.consents.some((c) => c.purpose === purpose && c.granted && c.withdrawnAt === null);
}

/** Earliest rent event not yet paid (and not more than 3 days stale). */
export function unpaidRent(state: RiderState, now: string): RentEvent | null {
  const cal = istDate(now);
  const stale = addDays(cal, -3);
  return (
    [...state.rentEvents]
      .filter((e) => !isPaid(e.riderReport) && !isPaid(e.operatorReport) && e.dueOn >= stale)
      .sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1))[0] ?? null
  );
}

/** The open nudge to show, if any (not acted on, not dismissed, rent still unpaid). */
export function openNudge(state: RiderState, now: string): Nudge | null {
  const unpaid = unpaidRent(state, now);
  if (!unpaid) return null;
  const cal = istDate(now);
  return (
    state.nudges.findLast(
      (n) => n.context.rentEventId === unpaid.id && !n.actedAt && !n.dismissedAt && istDate(n.sentAt) === cal,
    ) ?? null
  );
}

// ─── Housekeeping ─────────────────────────────────────────────────────────────

/** Creates upcoming rent events, refreshes statuses, settles due withdrawals. */
/** `from` overrides where due dates are generated from (used when the terms change). */
export function sync(state: RiderState, now: string, from?: string): RiderState {
  const cal = istDate(now);
  let { rentAgreement, rentEvents, withdrawals } = state;

  if (rentAgreement?.active) {
    const next = nextDueOn(rentAgreement, cal);
    const existing = new Set(rentEvents.filter((e) => e.rentAgreementId === rentAgreement!.id).map((e) => e.dueOn));
    const start = from ?? (rentEvents.length ? rentEvents.reduce((m, e) => (e.dueOn > m ? e.dueOn : m), "") : cal);
    const fresh: RentEvent[] = dueDatesBetween(rentAgreement, start, next)
      .filter((d) => !existing.has(d))
      .map((dueOn) => ({
        id: newId(),
        rentAgreementId: rentAgreement!.id,
        riderId: state.rider.id,
        dueOn,
        amountPaise: rentAgreement!.amountPaise,
        status: "due",
        paidAt: null,
        method: null,
        riderReport: null,
        riderReportedAt: null,
        operatorReport: null,
        operatorReportedAt: null,
      }));
    if (fresh.length || next !== rentAgreement.nextDueOn) {
      rentAgreement = { ...rentAgreement, nextDueOn: next };
      rentEvents = [...rentEvents, ...fresh];
    }
  }

  let statusChanged = false;
  rentEvents = rentEvents.map((e) => {
    const status = effectiveRentStatus(e, cal);
    if (status === e.status) return e;
    statusChanged = true;
    return { ...e, status };
  });

  let settled = false;
  withdrawals = withdrawals.map((w) => {
    if (w.status === "pending" && w.settledAt && w.settledAt <= now) {
      settled = true;
      return { ...w, status: "done" };
    }
    return w;
  });

  if (rentAgreement === state.rentAgreement && !statusChanged && !settled && rentEvents.length === state.rentEvents.length) {
    return state;
  }
  return { ...state, rentAgreement, rentEvents, withdrawals };
}

/** Recomputes allocations from `fromDay` onwards; earlier days stay frozen. */
function reallocate(state: RiderState, fromDay: string, now: string): { state: RiderState; outcomes: PayoutOutcome[] } {
  const result = replayFrom({
    fromDay,
    payouts: state.payouts,
    withdrawals: state.withdrawals,
    frozenAllocations: state.allocations,
    floorPaise: state.rider.floorPaise,
    rentTargetPaise: rentTarget(state),
    split: state.rider.split,
  });
  const dayOf = new Map(state.payouts.map((p) => [p.id, workDay(p.occurredAt)]));
  const kept = state.allocations.filter((a) => (dayOf.get(a.payoutId) ?? "") < fromDay);
  const fresh: Allocation[] = result.allocations.map((a) => ({ id: newId(), createdAt: now, ...a }));
  return { state: { ...state, allocations: [...kept, ...fresh] }, outcomes: result.outcomes };
}

// ─── S2: log a payout ─────────────────────────────────────────────────────────

export interface PayoutInput {
  amountPaise: number;
  source: PayoutSource;
  occurredAt?: string;
}

export interface PayoutResult {
  state: RiderState;
  payout: Payout;
  outcome: PayoutOutcome;
  nudge: Nudge | null;
}

export function logPayout(state: RiderState, input: PayoutInput, now: string): PayoutResult {
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) throw new Error("amount must be positive");
  const occurredAt = input.occurredAt ?? now;
  const payout: Payout = {
    id: newId(),
    riderId: state.rider.id,
    amountPaise: input.amountPaise,
    source: input.source,
    occurredAt,
    entryMethod: "manual",
    createdAt: now,
  };
  const synced = sync({ ...state, payouts: [...state.payouts, payout] }, now);
  const { state: next, outcomes } = reallocate(synced, workDay(occurredAt), now);
  const outcome = outcomes.find((o) => o.payoutId === payout.id)!;

  // S4 — the rent nudge. Only for a fresh payout, never for a backdated one.
  let nudge = openNudge(next, now);
  let nudges = next.nudges;
  const unpaid = unpaidRent(next, now);
  const cal = istDate(now);
  if (!nudge && unpaid) {
    const dismissedToday = next.nudges.some(
      (n) => n.context.rentEventId === unpaid.id && n.dismissedAt !== null && istDate(n.dismissedAt) === cal,
    );
    const fire = shouldNudge({
      cohort: next.rider.cohort,
      payoutJustLanded: workDay(occurredAt) === workDay(now),
      today: cal,
      unpaid,
      rentPotPaise: balancesOf(next).rent,
      dismissedToday,
    });
    if (fire) {
      nudge = {
        id: newId(),
        riderId: next.rider.id,
        kind: "rent_now",
        sentAt: now,
        actedAt: null,
        dismissedAt: null,
        context: { payoutId: payout.id, rentEventId: unpaid.id, amountPaise: unpaid.amountPaise },
      };
      nudges = [...nudges, nudge];
    }
  }
  return { state: { ...next, nudges }, payout, outcome, nudge };
}

/** CSV import. Re-importing the same rows is a no-op; allocations recompute from the earliest day. */
export function importPayouts(
  state: RiderState,
  rows: readonly { occurredAt: string; amountPaise: number; source: PayoutSource }[],
  now: string,
): { state: RiderState; added: number; skipped: number } {
  const seen = new Set(state.payouts.map((p) => `${p.occurredAt}|${p.amountPaise}`));
  const fresh: Payout[] = [];
  for (const r of rows) {
    const key = `${new Date(r.occurredAt).toISOString()}|${r.amountPaise}`;
    if (seen.has(key) || Date.parse(r.occurredAt) > Date.parse(now)) continue;
    seen.add(key);
    fresh.push({
      id: newId(),
      riderId: state.rider.id,
      amountPaise: r.amountPaise,
      source: r.source,
      occurredAt: new Date(r.occurredAt).toISOString(),
      entryMethod: "csv",
      createdAt: now,
    });
  }
  if (fresh.length === 0) return { state, added: 0, skipped: rows.length };
  const earliest = fresh.reduce((m, p) => (workDay(p.occurredAt) < m ? workDay(p.occurredAt) : m), workDay(now));
  const { state: next } = reallocate({ ...state, payouts: [...state.payouts, ...fresh] }, earliest, now);
  return { state: next, added: fresh.length, skipped: rows.length - fresh.length };
}

export function logSpend(state: RiderState, amountPaise: number, now: string): RiderState {
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new Error("amount must be positive");
  const spend: Spend = { id: newId(), riderId: state.rider.id, amountPaise, occurredAt: now, entryMethod: "manual", createdAt: now };
  return { ...state, spends: [...state.spends, spend] };
}

// ─── S4: the rent nudge ───────────────────────────────────────────────────────

/** "हाँ, अभी भेजो": marks the nudge acted and returns the UPI intent to open. */
export function startRentPayment(
  state: RiderState,
  rentEventId: string,
  nudgeId: string | null,
  now: string,
): { state: RiderState; upiLink: string } {
  const ev = state.rentEvents.find((e) => e.id === rentEventId);
  if (!ev || !state.rentAgreement) throw new Error("rent event not found");
  const upiLink = buildUpiIntent({
    payeeVpa: state.rentAgreement.payeeVpa,
    payeeName: state.rentAgreement.payeeName,
    amountPaise: ev.amountPaise,
    note: `Rent ${state.rider.name.split(" ")[0]} ${ev.dueOn}`,
    txnRef: `GM${ev.id.replace(/-/g, "").slice(0, 12)}${Date.parse(now).toString(36)}`,
  });
  return {
    upiLink,
    state: {
      ...state,
      nudges: state.nudges.map((n) => (n.id === nudgeId ? { ...n, actedAt: now } : n)),
      pendingRent: { rentEventId, nudgeId, openedAt: now },
    },
  };
}

/**
 * "भेज दिया?" — we cannot see settlement (HR-1), so we record what the rider says.
 * This is provisional; the operator's report is authoritative.
 */
export function confirmRent(state: RiderState, paid: boolean, now: string): RiderState {
  const pending = state.pendingRent;
  if (!pending) return state;
  if (!paid) return { ...state, pendingRent: null };
  const ev = state.rentEvents.find((e) => e.id === pending.rentEventId);
  if (!ev) return { ...state, pendingRent: null };

  const report = paidStatusFor(ev.dueOn, istDate(now));
  const fromPot = Math.min(balancesOf(state).rent, ev.amountPaise);
  const withdrawals: Withdrawal[] =
    fromPot > 0
      ? [...state.withdrawals, { id: newId(), potKind: "rent", amountPaise: fromPot, reason: "rent", status: "done", requestedAt: now, settledAt: now }]
      : state.withdrawals;
  const rentEvents = state.rentEvents.map((e) =>
    e.id === ev.id
      ? { ...e, riderReport: report, riderReportedAt: now, paidAt: now, method: "upi_intent" as const, status: effectiveRentStatus({ ...e, riderReport: report }, istDate(now)) }
      : e,
  );
  return { ...state, withdrawals, rentEvents, pendingRent: null };
}

export function dismissNudge(state: RiderState, nudgeId: string, now: string): RiderState {
  return { ...state, nudges: state.nudges.map((n) => (n.id === nudgeId ? { ...n, dismissedAt: now } : n)) };
}

// ─── S3: withdraw ─────────────────────────────────────────────────────────────

/** Settles by the next working day — never "instant" (HR-8). */
export function requestWithdrawal(
  state: RiderState,
  potKind: PotKind,
  amountPaise: number,
  reason: WithdrawalReason,
  now: string,
): RiderState {
  const balance = balancesOf(state)[potKind];
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) throw new Error("amount must be positive");
  if (amountPaise > balance) throw new Error("amount exceeds pot balance");
  const w: Withdrawal = {
    id: newId(),
    potKind,
    amountPaise,
    reason,
    status: "pending",
    requestedAt: now,
    settledAt: istInstant(nextWorkingDay(istDate(now)), 18),
  };
  return { ...state, withdrawals: [...state.withdrawals, w] };
}

// ─── S5: shock log ────────────────────────────────────────────────────────────

export interface ShockInput {
  amountPaise: number;
  description: string;
  coveredBy: ShockCover;
  /** When covered from a pot, take this much from the emergency pot. */
  takeFromEmergencyPaise?: number;
}

export function logShock(state: RiderState, input: ShockInput, now: string): RiderState {
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise < 0) throw new Error("amount must be ≥ 0");
  const shock: ShockEvent = {
    id: newId(),
    riderId: state.rider.id,
    description: input.description,
    amountPaise: input.amountPaise,
    coveredBy: input.coveredBy,
    occurredAt: now,
  };
  let next: RiderState = { ...state, shocks: [...state.shocks, shock] };
  const take = Math.min(input.takeFromEmergencyPaise ?? 0, balancesOf(state).emergency);
  if (input.coveredBy === "pot" && take > 0) next = requestWithdrawal(next, "emergency", take, "emergency", now);
  return next;
}

// ─── S6: settings ─────────────────────────────────────────────────────────────

export interface SettingsInput {
  floorPaise?: number;
  split?: Partial<SplitConfig>;
  language?: Lang;
  name?: string;
}

export function updateSettings(state: RiderState, input: SettingsInput, now: string): RiderState {
  const rider: Rider = {
    ...state.rider,
    ...(input.floorPaise !== undefined && { floorPaise: Math.max(0, Math.round(input.floorPaise)) }),
    ...(input.language && { language: input.language }),
    ...(input.name && { name: input.name }),
    split: { ...state.rider.split, ...input.split },
  };
  const moneyChanged = rider.floorPaise !== state.rider.floorPaise || JSON.stringify(rider.split) !== JSON.stringify(state.rider.split);
  const next = { ...state, rider };
  return moneyChanged ? reallocate(next, workDay(now), now).state : next;
}

export function updateRentAgreement(
  state: RiderState,
  input: { amountPaise: number; cadence: "daily" | "weekly"; dueWeekday: number | null },
  now: string,
): RiderState {
  if (!state.rentAgreement) return state;
  const cal = istDate(now);
  const agreement: RentAgreement = {
    ...state.rentAgreement,
    amountPaise: input.amountPaise,
    cadence: input.cadence,
    dueWeekday: input.cadence === "weekly" ? input.dueWeekday : null,
    nextDueOn: nextDueOn({ cadence: input.cadence, dueWeekday: input.dueWeekday }, cal),
  };
  // Future unpaid events follow the new terms; history is untouched.
  const rentEvents = state.rentEvents.filter((e) => e.dueOn < cal || isPaid(e.riderReport) || isPaid(e.operatorReport));
  const next = sync({ ...state, rentAgreement: agreement, rentEvents }, now, cal);
  return reallocate(next, workDay(now), now).state;
}

/** Consents are withdrawable independently; withdrawing sharing never touches savings. */
export function setConsent(state: RiderState, purpose: ConsentPurpose, granted: boolean, now: string): RiderState {
  const live = hasConsent(state, purpose);
  if (granted === live) return state;
  if (granted) {
    return {
      ...state,
      consents: [...state.consents, { id: newId(), riderId: state.rider.id, purpose, granted: true, version: CONSENT_VERSION, grantedAt: now, withdrawnAt: null }],
    };
  }
  return {
    ...state,
    consents: state.consents.map((c) => (c.purpose === purpose && c.withdrawnAt === null ? { ...c, withdrawnAt: now } : c)),
  };
}

// ─── S7: onboarding ───────────────────────────────────────────────────────────

export interface OnboardingInput {
  phone: string;
  name: string;
  language: Lang;
  operatorCode: string;
  rentAmountPaise: number;
  rentCadence: "daily" | "weekly";
  dueWeekday: number | null;
  floorPaise: number;
  operatorShare: boolean;
}

/** Looks up a fleet by the code a rider types. Only the demo fleet exists offline. */
export function findOperator(code: string): Operator | null {
  return code.trim().toUpperCase() === DEMO_OPERATOR.code ? DEMO_OPERATOR : null;
}

export function onboard(input: OnboardingInput, now: string): RiderState {
  const operator = input.operatorCode ? findOperator(input.operatorCode) : null;
  const riderId = newId();
  // Offline stand-in for onboard_rider()'s balanced randomisation: stable per phone.
  const cohort = operator ? (hash32(input.phone) % 2 === 0 ? "pilot" : "control") : "pilot";
  const rider: Rider = {
    id: riderId,
    name: input.name.trim(),
    phone: input.phone,
    operatorId: operator?.id ?? null,
    city: "Bengaluru",
    language: input.language,
    floorPaise: input.floorPaise,
    cohort,
    split: {
      rentShareBp: DEFAULTS.rentShareBp,
      emergencyShareBp: DEFAULTS.emergencyShareBp,
      emergencyTargetPaise: DEFAULTS.emergencyTargetPaise,
      savingsTargetPaise: null,
    },
    onboardedAt: now,
    createdAt: now,
  };
  const consents: Consent[] = [
    { id: newId(), riderId, purpose: "app_use", granted: true, version: CONSENT_VERSION, grantedAt: now, withdrawnAt: null },
  ];
  if (operator && input.operatorShare) {
    consents.push({ id: newId(), riderId, purpose: "operator_share", granted: true, version: CONSENT_VERSION, grantedAt: now, withdrawnAt: null });
  }
  const rentAgreement: RentAgreement | null =
    operator && input.rentAmountPaise > 0
      ? {
          id: newId(),
          riderId,
          operatorId: operator.id,
          amountPaise: input.rentAmountPaise,
          cadence: input.rentCadence,
          dueWeekday: input.rentCadence === "weekly" ? input.dueWeekday : null,
          nextDueOn: nextDueOn({ cadence: input.rentCadence, dueWeekday: input.dueWeekday }, istDate(now)),
          payeeVpa: operator.payeeVpa,
          payeeName: operator.name,
          active: true,
        }
      : null;
  const state: RiderState = {
    schema: 1,
    mode: "local",
    rider,
    operator,
    consents,
    payouts: [],
    spends: [],
    allocations: [],
    withdrawals: [],
    rentAgreement,
    rentEvents: [],
    nudges: [],
    shocks: [],
    pendingRent: null,
  };
  return sync(state, now);
}
