// All app state changes go through this reducer. It is pure: same state and action
// give the same result, so the tests exercise exactly what the screens do.

import { FLOOR_PAISE, type SourceId } from "./config";
import type { SambhalState } from "./seed";
import { sweep } from "./sweep";

export type Action =
  | { type: "payout"; id: string; amountPaise: number; source: SourceId }
  | { type: "spend"; amountPaise: number };

export function reducer(state: SambhalState, action: Action): SambhalState {
  if (action.type === "payout") {
    const r = sweep(action.amountPaise, state.earnedTodayPaise, FLOOR_PAISE);
    return {
      ...state,
      earnedTodayPaise: state.earnedTodayPaise + action.amountPaise,
      sweptTodayPaise: state.sweptTodayPaise + r.surplus,
      pots: {
        bike: state.pots.bike + r.split.bike,
        emergency: state.pots.emergency + r.split.emergency,
        savings: state.pots.savings + r.split.savings,
      },
      payouts: [
        { id: action.id, amountPaise: action.amountPaise, source: action.source, toFloorPaise: r.toFloor, split: r.split },
        ...state.payouts,
      ],
    };
  }
  if (action.type === "spend") {
    return { ...state, spentTodayPaise: state.spentTodayPaise + action.amountPaise };
  }
  return state;
}

/** आज खर्च कर सकते हो = min(earned, floor) − spent, never below zero. */
export function safeToSpend(state: SambhalState): number {
  return Math.max(0, Math.min(state.earnedTodayPaise, FLOOR_PAISE) - state.spentTodayPaise);
}

export function floorHeld(state: SambhalState): number {
  return Math.min(state.earnedTodayPaise, FLOOR_PAISE);
}
