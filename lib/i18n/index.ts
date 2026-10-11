// Every visible string, in 8 languages. One language is shown at a time: mixing scripts
// on one page made browsers machine-translate half of it and garble it.
// Banned words (all languages): floor, swept, held, payout. Numbers beat words.
// English is the source of truth; tests/i18n.test.ts checks every language has every key
// with the same {placeholders}.

import { bn } from "./bn";
import { en, type MsgKey } from "./en";
import { hi } from "./hi";
import { kn } from "./kn";
import { ml } from "./ml";
import { or } from "./or";
import { ta } from "./ta";
import { te } from "./te";

export type { MsgKey };
export type Lang = "kn" | "hi" | "en" | "ta" | "te" | "ml" | "bn" | "or";

/** In picker order: Bengaluru's language first, then the languages most migrant riders speak. */
export const LANGS: { code: Lang; native: string; english: string; sample: string }[] = [
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada", sample: "ಉಳಿತಾಯ" },
  { code: "hi", native: "हिन्दी", english: "Hindi", sample: "बचत" },
  { code: "en", native: "English", english: "English", sample: "Savings" },
  { code: "ta", native: "தமிழ்", english: "Tamil", sample: "சேமிப்பு" },
  { code: "te", native: "తెలుగు", english: "Telugu", sample: "పొదుపు" },
  { code: "ml", native: "മലയാളം", english: "Malayalam", sample: "സമ്പാദ്യം" },
  { code: "bn", native: "বাংলা", english: "Bengali", sample: "সঞ্চয়" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia", sample: "ସଞ୍ଚୟ" },
];

export const DICTS: Record<Lang, Record<MsgKey, string>> = { en, hi, kn, ta, te, ml, bn, or };

export const isLang = (x: unknown): x is Lang => typeof x === "string" && x in DICTS;

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: MsgKey, vars?: Vars): string {
  let s = (DICTS[lang] ?? en)[key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** The phone's own language if we have it (first launch); otherwise Hindi. */
export function detectLang(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "od") return "or";
    if (isLang(base)) return base;
  }
  return "hi";
}
