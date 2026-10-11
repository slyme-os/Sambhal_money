import { describe, expect, it } from "vitest";
import { earnedToday, potBalance, reducer, seedState, spendsByCategory, type State } from "@/lib/ledger";
import { parseSms, sampleSms, type DetectedTxn } from "@/lib/smsParse";
import { dayStart } from "@/lib/time";

const R = 100;
// 11 Oct 2026, 12:00 IST.
const NOON = Date.UTC(2026, 9, 11, 6, 30);
const fresh = (): State => {
  const s = seedState(NOON);
  return { ...s, entries: s.entries.filter((e) => e.kind === "opening"), sms: { ...s.sms, enabled: true } };
};
const found = (s: State, txns: DetectedTxn[]) => reducer(s, { type: "smsFound", txns, scannedAt: NOON });
const samples = () => sampleSms(NOON).map((m) => parseSms(m.body, m.at)!);

describe("SMS inbox", () => {
  it("adds today's messages once, newest first, and ignores other days", () => {
    const yesterday: DetectedTxn = { ...samples()[0], ref: "old", at: NOON - 86_400_000 };
    let s = found(fresh(), [...samples(), yesterday]);
    expect(s.sms.pending.map((t) => t.ref)).toEqual(["628412345674", "628412345673", "628412345672", "628412345671"]);
    s = found(s, samples());
    expect(s.sms.pending).toHaveLength(4);
    expect(s.sms.lastScanAt).toBe(NOON);
  });

  it("Add (payment) moves it out of the inbox and never offers it again", () => {
    let s = found(fresh(), samples());
    const t = s.sms.pending.find((x) => x.direction === "in")!;
    s = reducer(s, { type: "payout", id: "p", at: t.at, amountPaise: t.amountPaise, source: t.source!, smsRef: t.ref });
    expect(s.sms.pending.some((x) => x.ref === t.ref)).toBe(false);
    expect(s.entries.at(-1)).toMatchObject({ kind: "payout", origin: "sms" });
    expect(found(s, samples()).sms.pending.some((x) => x.ref === t.ref)).toBe(false);
  });

  it("Add (spend) keeps the category; Ignore drops it for good", () => {
    let s = found(fresh(), samples());
    const [fuel, food] = s.sms.pending.filter((x) => x.direction === "out").reverse();
    s = reducer(s, { type: "spend", id: "s", at: fuel.at, amountPaise: fuel.amountPaise, category: fuel.category, smsRef: fuel.ref });
    s = reducer(s, { type: "smsDismiss", ref: food.ref });
    expect(spendsByCategory(s)).toEqual([{ category: "fuel", paise: 150 * R }]);
    expect(s.sms.pending.filter((x) => x.direction === "out")).toHaveLength(0);
    expect(found(s, samples()).sms.pending.filter((x) => x.direction === "out")).toHaveLength(0);
  });

  it("turning it off deletes the inbox and the seen list", () => {
    let s = found(fresh(), samples());
    s = reducer(s, { type: "smsDismiss", ref: s.sms.pending[0].ref });
    s = reducer(s, { type: "smsDisable" });
    expect(s.sms).toEqual({ enabled: false, lastScanAt: 0, pending: [], seen: [] });
  });

  it("an older SMS payment fills today's essentials first, in time order", () => {
    let s = fresh();
    s = reducer(s, { type: "payout", id: "late", at: NOON, amountPaise: 400 * R, source: "uber" });
    s = reducer(s, { type: "payout", id: "early", at: NOON - 3_600_000, amountPaise: 100 * R, source: "rapido", smsRef: "x" });
    const early = s.entries.find((e) => e.id === "early");
    const late = s.entries.find((e) => e.id === "late");
    expect(early).toMatchObject({ toEssentialsPaise: 100 * R });
    expect(late).toMatchObject({ toEssentialsPaise: 200 * R });
    expect(earnedToday(s)).toBe(500 * R);
    expect(potBalance(s, "bike") + potBalance(s, "emergency") + potBalance(s, "savings")).toBe(seedTotal() + 200 * R);
  });

  it("a working day starts at 4 AM India time", () => {
    expect(new Date(dayStart("2026-10-11")).toISOString()).toBe("2026-10-10T22:30:00.000Z");
  });
});

function seedTotal(): number {
  const s = fresh();
  return potBalance(s, "bike") + potBalance(s, "emergency") + potBalance(s, "savings");
}
