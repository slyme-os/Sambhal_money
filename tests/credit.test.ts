import { describe, expect, it } from "vitest";
import { eligibilityPaise } from "@/lib/config";
import { potBalance, seedState } from "@/lib/ledger";

const R = 100;

describe("loan eligibility: Savings × 3.5, nearest ₹500, max ₹15,000", () => {
  it("the seed's ₹2,180 in Savings shows up to ₹7,500", () => {
    const s = seedState(Date.UTC(2026, 9, 11, 6, 30));
    expect(potBalance(s, "savings")).toBe(2180 * R);
    expect(eligibilityPaise(potBalance(s, "savings"))).toBe(7500 * R);
  });

  it("rounds to the nearest ₹500 and caps at ₹15,000", () => {
    expect(eligibilityPaise(0)).toBe(0);
    expect(eligibilityPaise(100 * R)).toBe(500 * R); // ₹350 → ₹500
    expect(eligibilityPaise(3000 * R)).toBe(10_500 * R);
    expect(eligibilityPaise(4290 * R)).toBe(15_000 * R); // ₹15,015 → ₹15,000
    expect(eligibilityPaise(50_000 * R)).toBe(15_000 * R);
  });
});
