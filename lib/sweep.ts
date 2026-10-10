// The sweep (Sambhal master prompt, Step 2). Pure: no I/O, integer paise only.
//
// 1. The floor (petrol + food) is filled first. It is never swept.
// 2. Only what is left above the floor — the surplus — is split:
//    20% emergency, 30% savings, and the rest (about 50%) to bike & repairs.
//    Rounding goes to bike & repairs, so the split always sums to the surplus.

export interface Split {
  bike: number;
  emergency: number;
  savings: number;
}

export interface SweepResult {
  toFloor: number;
  surplus: number;
  split: Split;
  swept: boolean;
}

const EMERGENCY_PCT = 20;
const SAVINGS_PCT = 30;

export function sweep(payout: number, earnedToday: number, floor: number): SweepResult {
  for (const [name, value] of [
    ["payout", payout],
    ["earnedToday", earnedToday],
    ["floor", floor],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative integer of paise, got ${value}`);
    }
  }

  const floorRemaining = Math.max(0, floor - earnedToday);
  const toFloor = Math.min(payout, floorRemaining);
  const surplus = payout - toFloor;

  const emergency = Math.floor((surplus * EMERGENCY_PCT) / 100);
  const savings = Math.floor((surplus * SAVINGS_PCT) / 100);
  const bike = surplus - emergency - savings;

  return { toFloor, surplus, split: { bike, emergency, savings }, swept: surplus > 0 };
}
