import { describe, expect, it } from "vitest";
import { addDays, istDate, istInstant, nextWorkingDay, weekStart, workDay } from "@/lib/day";
import { formatINR, paiseToUpiAmount, rupeesToPaise } from "@/lib/money";

describe("formatINR", () => {
  it("uses Indian digit grouping without decimals", () => {
    expect(formatINR(123456_00)).toBe("₹1,23,456");
    expect(formatINR(1240_00)).toBe("₹1,240");
    expect(formatINR(0)).toBe("₹0");
  });
  it("shows paise only under ₹100", () => {
    expect(formatINR(1250)).toBe("₹12.50");
    expect(formatINR(10050)).toBe("₹101");
  });
});

describe("rupeesToPaise", () => {
  it("parses keypad input", () => {
    expect(rupeesToPaise("1420")).toBe(142000);
    expect(rupeesToPaise("1,420")).toBe(142000);
    expect(rupeesToPaise("99.5")).toBe(9950);
    expect(rupeesToPaise("abc")).toBe(0);
    expect(rupeesToPaise("")).toBe(0);
  });
  it("UPI amount formatting round-trips", () => {
    expect(paiseToUpiAmount(rupeesToPaise("2450.05"))).toBe("2450.05");
  });
});

describe("IST dates", () => {
  it("working day starts at 4am IST", () => {
    expect(workDay(istInstant("2026-03-03", 1))).toBe("2026-03-02");
    expect(workDay(istInstant("2026-03-03", 4))).toBe("2026-03-03");
  });
  it("calendar date in IST is independent of device timezone", () => {
    expect(istDate("2026-03-02T19:00:00Z")).toBe("2026-03-03"); // 00:30 IST
  });
  it("next working day skips Sunday", () => {
    expect(nextWorkingDay("2026-03-07")).toBe("2026-03-09"); // Sat → Mon
    expect(nextWorkingDay("2026-03-02")).toBe("2026-03-03");
  });
  it("week starts on Monday", () => {
    expect(weekStart("2026-03-08")).toBe("2026-03-02");
    expect(weekStart(addDays("2026-03-02", 3))).toBe("2026-03-02");
  });
});
