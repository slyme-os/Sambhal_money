import { FLOOR_PAISE, type SourceId } from "./config";
import { RUPEE } from "./money";
import { sweep } from "./sweep";

export type PotKey = "bike" | "emergency" | "savings";

export interface PotMeta {
  key: PotKey;
  hi: string;
  en: string;
  goalPaise: number;
  icon: string;
}

export const POTS: PotMeta[] = [
  { key: "bike", hi: "बाइक और मरम्मत", en: "Bike & Repairs", goalPaise: 2500 * RUPEE, icon: "🛵" },
  { key: "emergency", hi: "इमरजेंसी", en: "Emergency", goalPaise: 2000 * RUPEE, icon: "🛟" },
  { key: "savings", hi: "बचत", en: "Savings", goalPaise: 3000 * RUPEE, icon: "🪙" },
];

export interface Payout {
  id: string;
  amountPaise: number;
  source: SourceId;
  toFloorPaise: number;
  split: { bike: number; emergency: number; savings: number };
}

export interface SambhalState {
  earnedTodayPaise: number;
  spentTodayPaise: number;
  sweptTodayPaise: number;
  pots: Record<PotKey, number>;
  payouts: Payout[];
}

/**
 * Opening state of the demo: ₹730 earned today across three payouts (₹200, ₹150,
 * ₹380), ₹300 floor, pots already filled. Today's splits come from the real sweep,
 * so they always agree with what the rider sees when he logs a new payout.
 */
export function seedState(): SambhalState {
  const today: { id: string; amount: number; source: SourceId }[] = [
    { id: "seed-1", amount: 200 * RUPEE, source: "rapido" },
    { id: "seed-2", amount: 150 * RUPEE, source: "zepto" },
    { id: "seed-3", amount: 380 * RUPEE, source: "swiggy" },
  ];
  let earned = 0;
  let swept = 0;
  const payouts: Payout[] = [];
  for (const p of today) {
    const r = sweep(p.amount, earned, FLOOR_PAISE);
    earned += p.amount;
    swept += r.surplus;
    payouts.unshift({ id: p.id, amountPaise: p.amount, source: p.source, toFloorPaise: r.toFloor, split: r.split });
  }
  return {
    earnedTodayPaise: earned,
    spentTodayPaise: 0,
    sweptTodayPaise: swept,
    pots: { bike: 1750 * RUPEE, emergency: 640 * RUPEE, savings: 2180 * RUPEE },
    payouts,
  };
}

/** Last 30 days of savings, for the chart. Deterministic, so the demo looks the same every run. */
export function seedHistory(): { label: string; sweptPaise: number }[] {
  let seed = 20261011;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const days: { label: string; sweptPaise: number }[] = [];
  const today = new Date(2026, 9, 11);
  for (let i = 29; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const earned = rand() < 0.08 ? 0 : 60000 + Math.round(rand() * 90000);
    const swept = Math.max(0, earned - FLOOR_PAISE) * 0.5;
    days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, sweptPaise: Math.round(swept / 100) * 100 });
  }
  return days;
}
