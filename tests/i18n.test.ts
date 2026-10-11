import { describe, expect, it } from "vitest";
import { DICTS, LANGS, detectLang, translate, type Lang } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const BANNED = /\b(floor|swept|held|payout)\b/i;

describe("translations", () => {
  it("offers 8 languages, each with a dictionary", () => {
    expect(LANGS.map((l) => l.code).sort()).toEqual(Object.keys(DICTS).sort());
    expect(LANGS).toHaveLength(8);
  });

  for (const [lang, dict] of Object.entries(DICTS) as [Lang, Record<string, string>][]) {
    it(`${lang}: every key present, non-empty, same {placeholders} as English, no broken characters`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(en).sort());
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `${lang}.${key} is empty`).not.toBe("");
        expect(placeholders(value), `${lang}.${key} placeholders`).toEqual(placeholders(en[key as keyof typeof en]));
        expect(value, `${lang}.${key} has a replacement character`).not.toContain("�");
      }
    });
  }

  it("keeps the legal lines in every language: Sambhal does not lend", () => {
    for (const lang of Object.keys(DICTS) as Lang[]) {
      expect(translate(lang, "loan.lender")).toContain("NBFC");
      expect(translate(lang, "loan.lender")).toContain("Sambhal");
      expect(translate(lang, "trust.noLend")).toContain("Sambhal");
    }
  });

  it("never uses the banned jargon in English", () => {
    for (const v of Object.values(en)) expect(v).not.toMatch(BANNED);
  });

  it("fills placeholders", () => {
    expect(translate("kn", "row.toPots", { amount: "₹50" })).toBe("₹50 ಹುಂಡಿಗೆ ಹೋಯಿತು");
  });
});

describe("phone language detection", () => {
  it("uses the phone's language when we have it, else Hindi", () => {
    expect(detectLang(["kn-IN", "en-US"])).toBe("kn");
    expect(detectLang(["ta"])).toBe("ta");
    expect(detectLang(["od-IN"])).toBe("or");
    expect(detectLang(["fr-FR", "bn-IN"])).toBe("bn");
    expect(detectLang(["fr-FR"])).toBe("hi");
  });
});
