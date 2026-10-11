// The whole app state, as a ledger. Every pot balance is derived from entries
// (opening + amounts moved in − withdrawals); nothing is stored as a running total,
// so a balance can never drift from the history behind it.
//
// The reducer is pure: same state and action give the same result. sweep() decides
// how much of a payment is set aside for essentials and how much is extra; allocate()
// splits the extra across pots by their share.

import { FLOOR_PAISE, type SourceId } from "./config";
import { RUPEE } from "./money";
import type { DetectedTxn, ExpenseCategory } from "./smsParse";
import { sweep } from "./sweep";
import { dayKey, dayLabel, daysBefore } from "./time";

export type { Lang } from "./i18n";
import type { Lang } from "./i18n";
export type PotIcon = "bike" | "shield" | "coins" | "phone" | "heart" | "school" | "gift" | "home";
export type WithdrawReason = "repair" | "emergency" | "other";
export type { ExpenseCategory };

export interface Pot {
  id: string;
  /** i18n key for the built-in pots; custom pots use `label`. */
  nameKey?: "pot.bike" | "pot.emergency" | "pot.savings";
  label?: string;
  icon: PotIcon;
  goalPaise: number;
  /** % of each payment's extra. Ignored for the first pot, which gets the rest. */
  weight: number;
}

export type Entry =
  | { kind: "opening"; id: string; day: string; potId: string; amountPaise: number }
  | {
      kind: "payout";
      id: string;
      day: string;
      at: number;
      amountPaise: number;
      source: SourceId;
      toEssentialsPaise: number;
      alloc: Record<string, number>;
      origin?: "sms";
    }
  | { kind: "spend"; id: string; day: string; at: number; amountPaise: number; category?: ExpenseCategory; origin?: "sms" }
  | { kind: "withdraw"; id: string; day: string; at: number; potId: string; amountPaise: number; reason: WithdrawReason };

export interface DayTotal {
  day: string;
  movedPaise: number;
}

export interface State {
  version: 1;
  lang: Lang;
  onboarded: boolean;
  essentialsPaise: number;
  pots: Pot[];
  entries: Entry[];
  /** The working day the "today" numbers belong to. */
  day: string;
  /** Totals moved to pots on past days, oldest first. Today is computed live. */
  history: DayTotal[];
  lastSource: SourceId;
  lastAmountPaise: number;
  sms: SmsState;
}

/** SMS auto-capture. Only parsed fields are kept, never the message text. */
export interface SmsState {
  enabled: boolean;
  /** Last time the inbox was read (ms); the next read starts here. */
  lastScanAt: number;
  /** Found in SMS, waiting for the rider to tap Add or Ignore. Newest first. */
  pending: DetectedTxn[];
  /** References already added or ignored, so the same SMS never comes back. */
  seen: string[];
}

export const SMS_OFF: SmsState = { enabled: false, lastScanAt: 0, pending: [], seen: [] };
const MAX_SEEN = 500;

export type Action =
  | { type: "hydrate"; state: State }
  | { type: "rollover"; now: number }
  | { type: "payout"; id: string; at: number; amountPaise: number; source: SourceId; smsRef?: string }
  | { type: "spend"; id: string; at: number; amountPaise: number; category?: ExpenseCategory; smsRef?: string }
  | { type: "smsEnable" }
  | { type: "smsDisable" }
  | { type: "smsFound"; txns: DetectedTxn[]; scannedAt: number }
  | { type: "smsDismiss"; ref: string }
  | { type: "withdraw"; id: string; at: number; potId: string; amountPaise: number; reason: WithdrawReason }
  | { type: "remove"; id: string }
  | { type: "createPot"; pot: Pot }
  | { type: "updatePot"; id: string; patch: Partial<Omit<Pot, "id">> }
  | { type: "setEssentials"; paise: number }
  | { type: "setLang"; lang: Lang }
  | { type: "completeOnboarding" }
  | { type: "showIntro" }
  | { type: "reset"; now: number };

export const MAX_HISTORY_DAYS = 29;

// ---------- allocation ----------

/** Share of extra for each pot, in %. The first pot gets whatever the others leave. */
export function shares(pots: Pot[]): Record<string, number> {
  const out: Record<string, number> = {};
  const others = pots.slice(1).reduce((s, p) => s + p.weight, 0);
  pots.forEach((p, i) => (out[p.id] = i === 0 ? Math.max(0, 100 - others) : p.weight));
  return out;
}

/**
 * Split `surplus` paise across pots. Every pot but the first gets floor(surplus × share);
 * the first gets the remainder, so the parts always sum exactly to the surplus. With
 * the default pots this is identical to sweep()'s 50/20/30 split.
 */
export function allocate(surplus: number, pots: Pot[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (pots.length === 0) return out;
  let rest = surplus;
  for (const p of pots.slice(1)) {
    const v = Math.floor((surplus * p.weight) / 100);
    out[p.id] = v;
    rest -= v;
  }
  out[pots[0].id] = rest;
  return out;
}

/** Replay one day's payouts in order, so a removed or edited entry recomputes the day. */
export function recomputeDay(entries: Entry[], day: string, essentials: number, pots: Pot[]): Entry[] {
  let earned = 0;
  const order = entries
    .filter((e): e is Extract<Entry, { kind: "payout" }> => e.kind === "payout" && e.day === day)
    .sort((a, b) => a.at - b.at);
  const next = new Map<string, Entry>();
  for (const p of order) {
    const r = sweep(p.amountPaise, earned, essentials);
    earned += p.amountPaise;
    next.set(p.id, { ...p, toEssentialsPaise: r.toFloor, alloc: allocate(r.surplus, pots) });
  }
  return entries.map((e) => next.get(e.id) ?? e);
}

// ---------- selectors ----------

const todays = (s: State) => s.entries.filter((e) => e.kind !== "opening" && e.day === s.day);

export function earnedToday(s: State): number {
  return todays(s).reduce((t, e) => (e.kind === "payout" ? t + e.amountPaise : t), 0);
}
export function spentToday(s: State): number {
  return todays(s).reduce((t, e) => (e.kind === "spend" ? t + e.amountPaise : t), 0);
}
/** Set aside for essentials today: min(earned, essentials). */
export function setAsideToday(s: State): number {
  return todays(s).reduce((t, e) => (e.kind === "payout" ? t + e.toEssentialsPaise : t), 0);
}
/** Safe to spend today. Negative means the rider has spent past today's essentials. */
export function safeToSpend(s: State): number {
  return setAsideToday(s) - spentToday(s);
}
export function movedToday(s: State, potId?: string): number {
  return todays(s).reduce((t, e) => {
    if (e.kind !== "payout") return t;
    return t + (potId ? (e.alloc[potId] ?? 0) : Object.values(e.alloc).reduce((a, b) => a + b, 0));
  }, 0);
}
export function potBalance(s: State, potId: string): number {
  return s.entries.reduce((t, e) => {
    if (e.kind === "opening" && e.potId === potId) return t + e.amountPaise;
    if (e.kind === "payout") return t + (e.alloc[potId] ?? 0);
    if (e.kind === "withdraw" && e.potId === potId) return t - e.amountPaise;
    return t;
  }, 0);
}
export function totalInPots(s: State): number {
  return s.pots.reduce((t, p) => t + potBalance(s, p.id), 0);
}
/** Today's spends by category, biggest first. */
export function spendsByCategory(s: State): { category: ExpenseCategory; paise: number }[] {
  const totals = new Map<ExpenseCategory, number>();
  for (const e of todays(s)) if (e.kind === "spend") totals.set(e.category ?? "other", (totals.get(e.category ?? "other") ?? 0) + e.amountPaise);
  return [...totals].map(([category, paise]) => ({ category, paise })).sort((a, b) => b.paise - a.paise);
}

/** Today's entries, newest first (what the "Today" list shows). */
export function todayActivity(s: State) {
  return todays(s)
    .filter((e): e is Exclude<Entry, { kind: "opening" }> => e.kind !== "opening")
    .sort((a, b) => b.at - a.at);
}
/** Past days plus today, oldest first, for the chart. */
export function chartDays(s: State): { label: string; movedPaise: number; today: boolean }[] {
  return [
    ...s.history.map((d) => ({ label: dayLabel(d.day), movedPaise: d.movedPaise, today: false })),
    { label: dayLabel(s.day), movedPaise: movedToday(s), today: true },
  ];
}

/**
 * Days to reach the goal at the recent pace (average moved per day over past days ×
 * this pot's share). null when there is no pace yet; 0 when the goal is reached.
 */
export function etaDays(s: State, pot: Pot): number | null {
  const left = pot.goalPaise - potBalance(s, pot.id);
  if (left <= 0) return 0;
  const past = s.history.slice(-14);
  if (past.length === 0) return null;
  const avg = past.reduce((t, d) => t + d.movedPaise, 0) / past.length;
  const perDay = (avg * (shares(s.pots)[pot.id] ?? 0)) / 100;
  if (perDay <= 0) return null;
  return Math.ceil(left / perDay);
}

// ---------- seed ----------

export const DEFAULT_POTS: Pot[] = [
  { id: "bike", nameKey: "pot.bike", icon: "bike", goalPaise: 2500 * RUPEE, weight: 50 },
  { id: "emergency", nameKey: "pot.emergency", icon: "shield", goalPaise: 2000 * RUPEE, weight: 20 },
  { id: "savings", nameKey: "pot.savings", icon: "coins", goalPaise: 3000 * RUPEE, weight: 30 },
];

/** Sample past days for the chart. Deterministic, so the demo looks the same every run. */
function seedHistory(today: string, essentials: number): DayTotal[] {
  let seed = 20261011;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const out: DayTotal[] = [];
  for (let i = MAX_HISTORY_DAYS; i >= 1; i--) {
    const earned = rand() < 0.08 ? 0 : 60000 + Math.round(rand() * 90000);
    out.push({ day: daysBefore(today, i), movedPaise: Math.round(Math.max(0, earned - essentials) / 100) * 100 });
  }
  return out;
}

/**
 * Opening state of the demo: ₹730 earned today across three payments (₹200, ₹150,
 * ₹380), ₹300 set aside, pots at ₹1,750 / ₹640 / ₹2,180. The pot balances come from
 * opening entries plus today's real allocations, so they always reconcile.
 */
export function seedState(now: number, keep?: Partial<Pick<State, "lang" | "onboarded">>): State {
  const day = dayKey(now);
  const pots = DEFAULT_POTS.map((p) => ({ ...p }));
  const target: Record<string, number> = { bike: 1750 * RUPEE, emergency: 640 * RUPEE, savings: 2180 * RUPEE };
  const payments: { id: string; amountPaise: number; source: SourceId; minsAgo: number }[] = [
    { id: "seed-1", amountPaise: 200 * RUPEE, source: "rapido", minsAgo: 150 },
    { id: "seed-2", amountPaise: 150 * RUPEE, source: "zepto", minsAgo: 95 },
    { id: "seed-3", amountPaise: 380 * RUPEE, source: "swiggy", minsAgo: 40 },
  ];
  let entries: Entry[] = payments.map((p) => ({
    kind: "payout",
    id: p.id,
    day,
    at: now - p.minsAgo * 60_000,
    amountPaise: p.amountPaise,
    source: p.source,
    toEssentialsPaise: 0,
    alloc: {},
  }));
  entries = recomputeDay(entries, day, FLOOR_PAISE, pots);
  const movedTo = (id: string) => entries.reduce((t, e) => (e.kind === "payout" ? t + (e.alloc[id] ?? 0) : t), 0);
  const openings: Entry[] = pots.map((p) => ({
    kind: "opening",
    id: `open-${p.id}`,
    day: daysBefore(day, MAX_HISTORY_DAYS + 1),
    potId: p.id,
    amountPaise: target[p.id] - movedTo(p.id),
  }));
  return {
    version: 1,
    lang: keep?.lang ?? "hi",
    onboarded: keep?.onboarded ?? false,
    essentialsPaise: FLOOR_PAISE,
    pots,
    entries: [...openings, ...entries],
    day,
    history: seedHistory(day, FLOOR_PAISE),
    lastSource: "swiggy",
    lastAmountPaise: 380 * RUPEE,
    sms: SMS_OFF,
  };
}

/** Fill in fields added after a phone first saved its state. */
export function normalize(s: State): State {
  return s.sms ? s : { ...s, sms: SMS_OFF };
}

/** Marks an SMS reference as handled: out of the inbox, never offered again. */
function handled(sms: SmsState, ref?: string): SmsState {
  if (!ref) return sms;
  return { ...sms, pending: sms.pending.filter((t) => t.ref !== ref), seen: [...sms.seen.filter((r) => r !== ref), ref].slice(-MAX_SEEN) };
}

// ---------- reducer ----------

const isMoney = (n: number) => Number.isSafeInteger(n) && n > 0;

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return normalize(a.state);

    case "rollover": {
      const today = dayKey(a.now);
      if (today <= s.day) return s;
      const ended: DayTotal = { day: s.day, movedPaise: movedToday(s) };
      return { ...s, day: today, history: [...s.history, ended].slice(-MAX_HISTORY_DAYS) };
    }

    case "payout": {
      if (!isMoney(a.amountPaise)) return s;
      const r = sweep(a.amountPaise, earnedToday(s), s.essentialsPaise);
      const entry: Entry = {
        kind: "payout",
        id: a.id,
        day: s.day,
        at: a.at,
        amountPaise: a.amountPaise,
        source: a.source,
        toEssentialsPaise: r.toFloor,
        alloc: allocate(r.surplus, s.pots),
        ...(a.smsRef ? { origin: "sms" as const } : {}),
      };
      // An SMS payment can be older than ones already added: replay the day in time order.
      const entries = recomputeDay([...s.entries, entry], s.day, s.essentialsPaise, s.pots);
      return { ...s, entries, lastSource: a.source, lastAmountPaise: a.amountPaise, sms: handled(s.sms, a.smsRef) };
    }

    case "spend": {
      if (!isMoney(a.amountPaise)) return s;
      const entry: Entry = {
        kind: "spend", id: a.id, day: s.day, at: a.at, amountPaise: a.amountPaise,
        ...(a.category ? { category: a.category } : {}),
        ...(a.smsRef ? { origin: "sms" as const } : {}),
      };
      return { ...s, entries: [...s.entries, entry], sms: handled(s.sms, a.smsRef) };
    }

    case "smsEnable":
      return { ...s, sms: { ...s.sms, enabled: true } };

    case "smsDisable":
      // Off means off: the inbox and the list of seen references are deleted.
      return { ...s, sms: SMS_OFF };

    case "smsFound": {
      const known = new Set([...s.sms.seen, ...s.sms.pending.map((t) => t.ref)]);
      const fresh = a.txns.filter((t) => {
        if (known.has(t.ref) || dayKey(t.at) !== s.day) return false;
        known.add(t.ref);
        return true;
      });
      const pending = [...s.sms.pending, ...fresh].sort((x, y) => y.at - x.at);
      return { ...s, sms: { ...s.sms, pending, lastScanAt: Math.max(s.sms.lastScanAt, a.scannedAt) } };
    }

    case "smsDismiss":
      return { ...s, sms: handled(s.sms, a.ref) };

    case "withdraw": {
      if (!isMoney(a.amountPaise) || a.amountPaise > potBalance(s, a.potId)) return s;
      const entry: Entry = { kind: "withdraw", id: a.id, day: s.day, at: a.at, potId: a.potId, amountPaise: a.amountPaise, reason: a.reason };
      return { ...s, entries: [...s.entries, entry] };
    }

    case "remove": {
      const target = s.entries.find((e) => e.id === a.id);
      if (!target || target.kind === "opening") return s;
      const rest = s.entries.filter((e) => e.id !== a.id);
      return { ...s, entries: target.kind === "payout" ? recomputeDay(rest, target.day, s.essentialsPaise, s.pots) : rest };
    }

    case "createPot": {
      if (s.pots.some((p) => p.id === a.pot.id)) return s;
      const pots = [...s.pots, a.pot];
      if (sharesOverflow(pots)) return s;
      return { ...s, pots };
    }

    case "updatePot": {
      const pots = s.pots.map((p) => (p.id === a.id ? { ...p, ...a.patch, id: p.id } : p));
      if (sharesOverflow(pots)) return s;
      return { ...s, pots };
    }

    case "setEssentials": {
      if (!isMoney(a.paise)) return s;
      return { ...s, essentialsPaise: a.paise, entries: recomputeDay(s.entries, s.day, a.paise, s.pots) };
    }

    case "setLang":
      return { ...s, lang: a.lang };
    case "completeOnboarding":
      return { ...s, onboarded: true };
    case "showIntro":
      return { ...s, onboarded: false };
    case "reset":
      return seedState(a.now, { lang: s.lang, onboarded: true });
  }
}

/** The other pots' shares must leave room (≥ 0%) for the first pot. */
export function sharesOverflow(pots: Pot[]): boolean {
  return pots.slice(1).reduce((t, p) => t + p.weight, 0) > 100;
}

/** Light shape check for data read back from the phone's storage. */
export function isState(x: unknown): x is State {
  const s = x as State;
  return !!s && s.version === 1 && Array.isArray(s.pots) && Array.isArray(s.entries) && typeof s.day === "string" && Array.isArray(s.history);
}
