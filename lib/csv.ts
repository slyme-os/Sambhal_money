// Minimal CSV parsing for payout and rent-agreement uploads (HR-4: income enters
// the app by manual tap or CSV import — never by reading SMS or notifications).

import { DEFAULTS } from "./config";
import { istInstant } from "./day";
import { rupeesToPaise } from "./money";
import { isValidVpa } from "./rent";
import type { PayoutSource } from "./types";
import { PAYOUT_SOURCES } from "./types";

/** RFC 4180-ish: quoted fields, escaped quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim()));
}

function headerIndex(header: string[], names: string[]): number {
  const lower = header.map((h) => h.toLowerCase().replace(/[\s-]+/g, "_"));
  for (const n of names) {
    const i = lower.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

/** Accepts YYYY-MM-DD or DD-MM-YYYY / DD/MM/YYYY. */
export function parseDate(input: string): string | null {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(input);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export interface CsvResult<T> {
  rows: T[];
  errors: string[];
}

export interface PayoutRow {
  /** Present when the file has a phone column (operator uploads). */
  phone?: string;
  occurredAt: string;
  amountPaise: number;
  source: PayoutSource;
}

/** Columns: date, time (HH:MM, IST), amount (rupees), source. Header row required. */
export function parsePayoutCsv(text: string): CsvResult<PayoutRow> {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], errors: ["empty file"] };
  const iDate = headerIndex(header, ["date"]);
  const iTime = headerIndex(header, ["time"]);
  const iAmount = headerIndex(header, ["amount", "amount_rupees", "rupees"]);
  const iSource = headerIndex(header, ["source", "platform"]);
  const iPhone = headerIndex(header, ["phone", "mobile"]);
  if (iDate < 0 || iAmount < 0) return { rows: [], errors: ["need at least 'date' and 'amount' columns"] };

  const rows: PayoutRow[] = [];
  const errors: string[] = [];
  body.forEach((cells, n) => {
    const line = n + 2;
    const date = parseDate(cells[iDate] ?? "");
    const [h, m] = (iTime >= 0 ? cells[iTime] : "12:00").split(":").map(Number);
    const amountPaise = rupeesToPaise(cells[iAmount] ?? "");
    const rawSource = (iSource >= 0 ? cells[iSource] : "other").toLowerCase();
    const source = (PAYOUT_SOURCES as readonly string[]).includes(rawSource) ? (rawSource as PayoutSource) : "other";
    if (!date) return void errors.push(`line ${line}: bad date`);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h > 23 || m > 59) return void errors.push(`line ${line}: bad time`);
    if (amountPaise <= 0) return void errors.push(`line ${line}: bad amount`);
    const phone = iPhone >= 0 ? (cells[iPhone] ?? "").replace(/[^\d+]/g, "") : undefined;
    rows.push({ ...(phone ? { phone } : {}), occurredAt: istInstant(date, h, m), amountPaise, source });
  });
  return { rows, errors };
}

export interface RentAgreementRow {
  phone: string;
  amountPaise: number;
  cadence: "daily" | "weekly";
  dueWeekday: number | null;
  payeeVpa: string;
}

const WEEKDAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** Columns: phone, rent_rupees, cadence (daily|weekly), due_weekday (0-6 or mon…sun), payee_vpa. */
export function parseRentAgreementCsv(text: string, defaultVpa: string): CsvResult<RentAgreementRow> {
  const [header, ...body] = parseCsv(text);
  if (!header) return { rows: [], errors: ["empty file"] };
  const iPhone = headerIndex(header, ["phone", "mobile"]);
  const iAmount = headerIndex(header, ["rent_rupees", "rent", "amount"]);
  const iCadence = headerIndex(header, ["cadence"]);
  const iDue = headerIndex(header, ["due_weekday", "due_day"]);
  const iVpa = headerIndex(header, ["payee_vpa", "vpa", "upi"]);
  if (iPhone < 0 || iAmount < 0) return { rows: [], errors: ["need at least 'phone' and 'rent_rupees' columns"] };

  const rows: RentAgreementRow[] = [];
  const errors: string[] = [];
  body.forEach((cells, n) => {
    const line = n + 2;
    const phone = (cells[iPhone] ?? "").replace(/[^\d+]/g, "");
    const amountPaise = rupeesToPaise(cells[iAmount] ?? "") || DEFAULTS.weeklyRentPaise;
    const cadence = (iCadence >= 0 ? cells[iCadence] : "weekly").toLowerCase() === "daily" ? "daily" : "weekly";
    const dueRaw = (iDue >= 0 ? cells[iDue] : "").toLowerCase().slice(0, 3);
    const dueWeekday = cadence === "daily" ? null : /^\d$/.test(dueRaw) ? Number(dueRaw) : WEEKDAYS[dueRaw] ?? null;
    const payeeVpa = (iVpa >= 0 && cells[iVpa]) || defaultVpa;
    if (phone.replace(/\D/g, "").length < 10) return void errors.push(`line ${line}: bad phone`);
    if (cadence === "weekly" && (dueWeekday === null || dueWeekday > 6)) return void errors.push(`line ${line}: bad due_weekday`);
    if (!isValidVpa(payeeVpa)) return void errors.push(`line ${line}: bad payee_vpa`);
    rows.push({ phone, amountPaise, cadence, dueWeekday, payeeVpa });
  });
  return { rows, errors };
}

/** Triggers a browser download of text content. */
export function downloadText(filename: string, text: string, type = "text/csv"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
