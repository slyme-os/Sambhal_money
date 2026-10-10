// All date logic is pinned to India Standard Time (UTC+5:30, no DST), independent
// of the device timezone, so the server, the tests and a phone agree on "today".

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const IST_OFFSET_MIN = 330;
/** Riders work past midnight; a 1am payout belongs to the previous working day. */
export const DAY_START_HOUR = 4;

/** ISO date (YYYY-MM-DD) of the rider's working day, which starts at 4am IST. */
export function workDay(at: string | number | Date): string {
  const t = new Date(at).getTime() + (IST_OFFSET_MIN - DAY_START_HOUR * 60) * MINUTE;
  return new Date(t).toISOString().slice(0, 10);
}

/** Calendar date in IST. Rent due dates are calendar dates. */
export function istDate(at: string | number | Date): string {
  const t = new Date(at).getTime() + IST_OFFSET_MIN * MINUTE;
  return new Date(t).toISOString().slice(0, 10);
}

/** Instant (ISO string) for a given IST calendar date and hour/minute. */
export function istInstant(date: string, hour = 12, minute = 0): string {
  const utc = Date.parse(`${date}T00:00:00Z`) + (hour * 60 + minute - IST_OFFSET_MIN) * MINUTE;
  return new Date(utc).toISOString();
}

/** The instant the working day `date` starts (4am IST). */
export function workDayStart(date: string): string {
  return istInstant(date, DAY_START_HOUR);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);
}

/** 0 = Sunday … 6 = Saturday, matching Postgres `extract(dow)`. */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Next bank working day after `date` (skips Sundays; bank holidays are not modelled). */
export function nextWorkingDay(date: string): string {
  let d = addDays(date, 1);
  while (weekday(d) === 0) d = addDays(d, 1);
  return d;
}

/** Monday of the ISO week containing `date`. */
export function weekStart(date: string): string {
  const dow = weekday(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** "10 अक्टू॰, 2:05 pm" — a short IST timestamp in the rider's language. */
export function formatWhen(iso: string, lang: "hi" | "kn" | "en"): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-IN" : "hi-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
