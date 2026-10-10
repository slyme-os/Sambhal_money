// Device persistence. Until a Supabase project is provisioned (SPEC §11 Q5 and HR-7
// require confirming the India region first), the rider's ledger lives in this
// browser's localStorage. Every read is defensive: storage can be full, disabled
// or hold an older shape.

import { DEMO_OPERATOR, DEMO_RIDER_INDEX, generateRider } from "../seed";
import type { RentStatus } from "../types";
import { fromBundle, sync, type RiderState } from "./state";

const RIDER_KEY = "gmoney.rider.v2"; // v2: English became the default language
const OPERATOR_KEY = "gmoney.operator.v1";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function demoState(now: string): RiderState {
  return sync(fromBundle(generateRider(DEMO_RIDER_INDEX, "pilot", { now }), DEMO_OPERATOR, "demo"), now);
}

export function loadRider(): RiderState | null {
  try {
    const raw = storage()?.getItem(RIDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RiderState;
    return parsed && parsed.schema === 1 && parsed.rider ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRider(state: RiderState): boolean {
  try {
    storage()?.setItem(RIDER_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearRider(): void {
  try {
    storage()?.removeItem(RIDER_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/** Operator's authoritative rent reports from the dashboard (demo, same device). */
export type OperatorReports = Record<string, RentStatus>;

export function loadOperatorReports(): OperatorReports {
  try {
    const raw = storage()?.getItem(OPERATOR_KEY);
    return raw ? (JSON.parse(raw) as OperatorReports) : {};
  } catch {
    return {};
  }
}

export function saveOperatorReports(reports: OperatorReports): void {
  try {
    storage()?.setItem(OPERATOR_KEY, JSON.stringify(reports));
  } catch {
    /* best effort */
  }
}
