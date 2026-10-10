// `npm run hindi-review` — regenerates docs/HINDI-REVIEW.md from lib/strings.ts so
// the review sheet can never drift from the copy that actually ships.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { HINDI_STRINGS, translate, type StringKey } from "../lib/strings";

/** Strings that need a human decision, not just a proofread. */
const FLAGS: Partial<Record<StringKey, string>> = {
  withdrawEta:
    "SPEC S3 asks for this exact line. But pots are a ledger (HR-2) — the money never left his bank — so “कल तक आपके बैंक में” may confuse. Keep it, or say “गुल्लक से हट जाएगा”?",
  ledgerNote: "Explains HR-2 in one line. Is “हिसाब रखता है” clear enough for “ledger”?",
  nudgeTitle: "SPEC S4 wording, kept verbatim (amounts filled in).",
  nudgeBody: "SPEC S4 wording, kept verbatim.",
  nothingSwept: "SPEC S2 wording, kept verbatim (the floor amount is filled in).",
  floorHeld: "Short label for “floor held back”. Alternative: “रोज़ का खर्च”.",
  swept: "“Swept to pots” → “गुल्लक में”. Natural for riders?",
  coverBorrowed: "PRIMARY METRIC. Must cover a friend, family and a moneylender alike. Does “उधार लिया” do that?",
  coverUnpaid: "PRIMARY METRIC. “नहीं दे पाया” = could not pay at all.",
  consentShareSub: "DPDP consent copy — needs legal review as well as language review.",
  obConsentAppBody: "DPDP consent copy — needs legal review. Makes three claims: no SMS read, no Aadhaar, no bank password.",
  obConsentShareBody: "DPDP consent copy — needs legal review.",
  emergencyTarget: "“लिमिट” is Hinglish; alternative “कितना तक भरना है”.",
  splitRent: "Is a percentage split understandable at all, or should it move behind “और सेटिंग”?",
  withdrawEtaSub: "Only Sundays are skipped; bank holidays are not modelled yet.",
  rentRecorded: "Sets the expectation that the fleet confirms — the operator report is authoritative.",
  obOtpDemo: "Demo only — goes away once Supabase phone OTP is connected.",
  upiDemoWarning: "Demo only.",
};

const cell = (s: string) => s.replace(/\|/g, "\\|");
const keys = Object.keys(HINDI_STRINGS) as StringKey[];
const flagged = keys.filter((k) => FLAGS[k]);

const doc = `# Hindi copy — review before merge

SPEC §10: *“Hindi strings reviewed by me before merge — do not invent financial Hindi, flag anything you are unsure of.”*

All rider-facing copy lives in \`lib/strings.ts\`. The app opens in **English**; Hindi is the switchable option (Home → हिंदी, Settings → Language, onboarding step 1). The Hindi is written the way a rider would say it — Hinglish where that is how people actually talk (“पेमेंट”, “OTP”, “UPI”) — not translated from the English. This file is generated: run \`npm run hindi-review\` after changing copy.

Rules applied everywhere (HR-8): never “instant”; withdrawals say **कल तक / अगले कामकाजी दिन तक**; no returns, interest or growth; never imply the money is invested; the rider is never charged (\`noFees\`).

**Kannada (SPEC §11 Q3) is not written.** Riders with \`language = kn\` see Hindi until it is.

## Flagged for your decision (${flagged.length})

${flagged.map((k) => `- **\`${k}\`** — “${HINDI_STRINGS[k]}”  \n  ${FLAGS[k]}`).join("\n")}

## Every string (${keys.length})

| key | हिंदी | English | note |
|---|---|---|---|
${keys.map((k) => `| \`${k}\` | ${cell(HINDI_STRINGS[k])} | ${cell(translate("en", k))} | ${FLAGS[k] ? "⚠️" : ""} |`).join("\n")}
`;

writeFileSync(join(process.cwd(), "docs", "HINDI-REVIEW.md"), doc);
console.log(`docs/HINDI-REVIEW.md: ${keys.length} strings, ${flagged.length} flagged`);
