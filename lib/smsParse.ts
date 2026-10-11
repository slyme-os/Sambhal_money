// Reads one bank / UPI SMS and pulls out what Sambhal needs: money in or out, how much,
// who it was with, and a reference to avoid adding the same SMS twice. Pure and
// on-device: the SMS text itself is never stored, only these parsed fields.
//
// Indian banks word these messages many ways, e.g.
//   "Rs.380.00 credited to A/c XX1234 on 11-10-26 by UPI ref 628412345678. -SBI"
//   "Money Received - INR 380.00 in your HDFC Bank A/c xx1234 by VPA swiggy@icici (UPI Ref No 6284...)"
//   "ICICI Bank Acct XX123 debited for Rs 50.00 on 11-Oct-26; HPCL credited. UPI:6284..."
//   "Sent Rs.120.00 From HDFC Bank A/C x1234 To ZOMATO On 11/10/26 Ref 6284..."
// Anything that isn't a completed credit or debit (OTPs, collect requests, offers,
// failed or reversed payments, balance alerts) returns null.

import type { SourceId } from "./config";

export type SmsDirection = "in" | "out";
export type ExpenseCategory = "fuel" | "food" | "phone" | "repair" | "transfer" | "other";

export interface DetectedTxn {
  /** Dedupe key: the UPI / bank reference if present, else a hash of the message. */
  ref: string;
  direction: SmsDirection;
  amountPaise: number;
  at: number;
  /** Who it was with, cleaned up for display (a name or a UPI ID). */
  counterparty: string;
  /** Money in: which platform paid. */
  source?: SourceId;
  /** Money out: what it was for. */
  category?: ExpenseCategory;
}

const SKIP = /\b(otp|one[- ]time password|verification code|requested|request (?:of|for|from)|collect request|will be (?:debited|credited)|is due|due on|due date|failed|declined|unsuccessful|reversed|refund|offer|cashback|win |pre-?approved|apply now|emi of|autopay|mandate|insufficient)\b/i;
const CREDIT = /\b(credited|received|deposited)\b/i;
const DEBIT = /\b(debited|sent|paid|spent|withdrawn|purchase|txn of|transferred)\b/i;
const MONEY_CONTEXT = /\b(a\/c|acct|account|upi|vpa|bank|imps|neft|card)\b/i;
const AMOUNT = /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;

const SOURCE_HINTS: [RegExp, SourceId][] = [
  [/swiggy/i, "swiggy"],
  [/zomato/i, "zomato"],
  [/uber/i, "uber"],
  [/rapido|roppen/i, "rapido"],
  [/zepto|kiranakart/i, "zepto"],
];

const CATEGORY_HINTS: [RegExp, ExpenseCategory][] = [
  [/petrol|fuel|diesel|hpcl|iocl|bpcl|indian ?oil|bharat ?petroleum|hindustan ?petroleum|shell|nayara|essar|filling|pump/i, "fuel"],
  [/garage|service ?cent|puncture|tyre|tire|spare|motors|automobile|bike ?care|mechanic|repair/i, "repair"],
  [/jio|airtel|vodafone|\bvi\b|recharge|prepaid|mobile|bsnl/i, "phone"],
  [/swiggy|zomato|hotel|restaurant|food|cafe|bakery|darshini|tiffin|tea|chai|biryani|canteen|mess|eats|kitchen|juice/i, "food"],
];

function amountOf(s: string): number | null {
  for (const m of s.matchAll(AMOUNT)) {
    const before = s.slice(Math.max(0, (m.index ?? 0) - 18), m.index).toLowerCase();
    if (/(bal|balance|avl|available|limit)[^a-z]*$/.test(before) || /bal(?:ance)?[:\s.-]*$/.test(before)) continue;
    const rupees = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(rupees) && rupees > 0) return Math.round(rupees * 100);
  }
  return null;
}

function directionOf(s: string): SmsDirection | null {
  const c = s.search(CREDIT);
  const d = s.search(DEBIT);
  if (c < 0 && d < 0) return null;
  if (c < 0) return "out";
  if (d < 0) return "in";
  return d < c ? "out" : "in";
}

function refOf(s: string): string | null {
  const m =
    s.match(/upi\/(?:cr|dr|p2a|p2m)\/(\d{6,})/i) ??
    s.match(/(?:upi[\s:]*(?:ref(?:erence)?)?|ref(?:erence)?|utr|rrn|txn ?id)[\s.:#-]*(?:no\.?|number)?[\s.:#-]*([0-9]{6,})/i);
  return m ? m[1] : null;
}

function tidy(name: string): string {
  return name
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .slice(0, 28);
}

function counterpartyOf(s: string, direction: SmsDirection): string {
  const upi = s.match(/upi\/(?:cr|dr|p2a|p2m)\/\d+\/([^/.]+?)(?=\/|\.|\s+avl\b|$)/i);
  if (upi) return tidy(upi[1]);
  const vpa = s.match(/\b([a-z0-9][a-z0-9.\-_]{1,40})@([a-z]{2,15})\b/i);
  if (vpa) return vpa[0].toLowerCase();
  // "; HPCL credited." (ICICI-style debit) / "To ZOMATO On" / "from RAPIDO." / "by SWIGGY"
  const named =
    s.match(/;\s*([A-Za-z][A-Za-z0-9 &'.-]{1,30}?)\s+credited/) ??
    s.match(new RegExp(`\\b${direction === "out" ? "(?:to|at)" : "(?:from|by)"}\\s+(?!(?:a\\/c|ac|acct|account|vpa|your|upi|the|mobile|imps|neft)\\b)([A-Za-z][A-Za-z0-9 &'.-]{1,30}?)(?=\\s+(?:on|ref|upi|via|a\\/c|avl|dated|txn|in your)\\b|[.;(,]|$)`, "i"));
  return named ? tidy(named[1]) : "UPI";
}

/** A short stable hash, used as a dedupe key when the SMS has no reference number. */
function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function parseSms(body: string, at: number): DetectedTxn | null {
  const s = body.replace(/\s+/g, " ").trim();
  if (!s || SKIP.test(s) || !MONEY_CONTEXT.test(s)) return null;
  const direction = directionOf(s);
  const amountPaise = amountOf(s);
  if (!direction || !amountPaise) return null;
  const counterparty = counterpartyOf(s, direction);
  const haystack = `${counterparty} ${s}`;
  const txn: DetectedTxn = { ref: refOf(s) ?? `h${hash(s)}`, direction, amountPaise, at, counterparty };
  if (direction === "in") {
    txn.source = SOURCE_HINTS.find(([re]) => re.test(haystack))?.[1] ?? "other";
  } else {
    const personVpa = /^[0-9]{10}@|^[a-z]+[0-9]*@(ybl|okaxis|oksbi|okhdfcbank|okicici|paytm|ibl|axl)$/i.test(counterparty);
    txn.category = CATEGORY_HINTS.find(([re]) => re.test(haystack))?.[1] ?? (personVpa ? "transfer" : "other");
  }
  return txn;
}

/** Sample messages for demos and testing (BlueStacks and the web have no bank SMS). */
// (No inner closure over `base`: Next's minifier dropped it when inlining this function.)
export function sampleSms(base: number): { body: string; at: number }[] {
  const minute = 60_000;
  return [
    { body: "Money Received - INR 420.00 in your HDFC Bank A/c xx4521 on 11-10-26 by VPA swiggy.payouts@icici (UPI Ref No 628412345671)", at: base - 22 * minute },
    { body: "Rs.150.00 debited from A/c XX4521 on 11-10-26 to VPA hpcl.fuelstation@okaxis UPI Ref 628412345672. Not you? Call 18002586161 -SBI", at: base - 18 * minute },
    { body: "Your a/c no. XXXXXXXX4521 is credited by Rs.260.00 on 11Oct26 by a/c linked to VPA rapido.captain@ybl (UPI Ref no 628412345673).", at: base - 12 * minute },
    { body: "ICICI Bank Acct XX521 debited for Rs 60.00 on 11-Oct-26; Sri Darshini Tiffin credited. UPI:628412345674. Call 18002662 for dispute.", at: base - 6 * minute },
  ];
}
