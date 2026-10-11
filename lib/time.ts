// A rider's working day runs past midnight, so "today" starts at 4 AM India time:
// a 1 AM payout still belongs to the previous working day. The timezone is fixed,
// not taken from the phone clock, so travel or a wrong device setting can't split a day.

const TZ = "Asia/Kolkata";
export const DAY_START_HOUR = 4;

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Working-day key, "YYYY-MM-DD", for a timestamp in ms. */
export function dayKey(ms: number): string {
  return ymd.format(new Date(ms - DAY_START_HOUR * 3_600_000));
}

/** "11/10" style label for a day key. */
export function dayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/** The day key `n` days before `key`. */
export function daysBefore(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) - n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
