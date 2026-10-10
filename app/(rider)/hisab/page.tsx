"use client";

// History: what came in, what was set aside, rent record, shocks. Ledger history
// only — no returns, no growth projections (HR-2, HR-8).

import { useRider } from "@/components/StoreProvider";
import { DailyBars, Donut, type DayBar } from "@/components/charts";
import { Card, Money, SectionTitle, TopBar } from "@/components/ui";
import { addDays, formatWhen, workDay } from "@/lib/day";
import { PLATFORMS } from "@/lib/config";
import { formatINR } from "@/lib/money";
import type { StringKey } from "@/lib/strings";
import type { RentStatus } from "@/lib/types";

const STATUS: Record<RentStatus, { key: StringKey; cls: string; mark: string }> = {
  paid_on_time: { key: "statusPaidOnTime", cls: "bg-brand-tint text-brand-pressed", mark: "✓" },
  paid_late: { key: "statusPaidLate", cls: "bg-amber-tint text-amber-ink", mark: "!" },
  missed: { key: "statusMissed", cls: "bg-alert-tint text-alert", mark: "✕" },
  due: { key: "statusDue", cls: "bg-surface text-ink-2", mark: "…" },
};

export default function HisabPage() {
  const { state, t, now, lang } = useRider();
  if (!state) return <TopBar title={t("hisabTitle")} />;

  const today = workDay(now());
  const from = addDays(today, -13);
  const days: DayBar[] = [];
  const dayIndex = new Map<string, DayBar>();
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const bar = { key: d, label: d.slice(5), earned: 0, swept: 0, today: d === today };
    days.push(bar);
    dayIndex.set(d, bar);
  }
  const payoutDay = new Map<string, string>();
  const bySource = new Map<string, { value: number; count: number }>();
  for (const p of state.payouts) {
    const d = workDay(p.occurredAt);
    payoutDay.set(p.id, d);
    const bar = dayIndex.get(d);
    if (!bar) continue;
    bar.earned += p.amountPaise;
    const s = bySource.get(p.source) ?? { value: 0, count: 0 };
    s.value += p.amountPaise;
    s.count += 1;
    bySource.set(p.source, s);
  }
  for (const a of state.allocations) {
    const bar = dayIndex.get(payoutDay.get(a.payoutId) ?? "");
    if (bar) bar.swept += a.amountPaise;
  }
  const earned14 = days.reduce((s, d) => s + d.earned, 0);
  const swept14 = days.reduce((s, d) => s + d.swept, 0);
  const label = (l: string) => (l.startsWith("source") ? t(l as StringKey) : l);
  const segments = PLATFORMS.filter((p) => bySource.has(p.value)).map((p) => ({
    key: p.value,
    label: label(p.label),
    value: bySource.get(p.value)!.value,
    color: p.color,
  }));
  const rent = [...state.rentEvents].filter((e) => e.dueOn <= addDays(today, 7)).sort((a, b) => (a.dueOn < b.dueOn ? 1 : -1)).slice(0, 6);
  const shocks = [...state.shocks].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)).slice(0, 8);
  const coverKey: Record<string, StringKey> = { pot: "coverPot", borrowed: "coverBorrowed", unpaid: "coverUnpaid", other: "coverOther" };

  return (
    <div>
      <TopBar title={t("hisabTitle")} />
      <div className="px-4 pb-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:px-0">
        <section>
        <SectionTitle>{t("last14")}</SectionTitle>
        <Card className="p-4">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <span aria-hidden className="h-3 w-3 rounded-sm border border-brand bg-brand-tint" /> {t("earned")}
              </p>
              <Money paise={earned14} className="text-2xl font-extrabold" />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm text-ink-2">
                <span aria-hidden className="h-3 w-3 rounded-sm bg-brand" /> {t("sweptLegend")}
              </p>
              <Money paise={swept14} className="text-2xl font-extrabold text-brand-pressed" />
            </div>
          </div>
          <DailyBars days={days} summary={`${t("earned")} ${formatINR(earned14)}, ${t("sweptLegend")} ${formatINR(swept14)}`} />
          <div className="mt-1 flex justify-between text-sm text-ink-2">
            <span>{days[0].label}</span>
            <span>{days.at(-1)!.label}</span>
          </div>
        </Card>

        </section>
        <section>
        <SectionTitle>{t("bySource")}</SectionTitle>
        <Card className="flex items-center gap-4 p-4">
          <Donut
            segments={segments}
            center={
              <>
                <span className="text-sm text-ink-2">{t("earned")}</span>
                <span className="num text-lg font-extrabold">{formatINR(earned14)}</span>
              </>
            }
          />
          <ul className="flex-1 space-y-2">
            {segments.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="flex-1">
                  <span className="block text-base font-semibold">{s.label}</span>
                  <span className="block text-sm text-ink-2">{t("payouts", { n: bySource.get(s.key)!.count })}</span>
                </span>
                <Money paise={s.value} className="text-base font-extrabold" />
              </li>
            ))}
          </ul>
        </Card>

        </section>
        <section>
        <SectionTitle>{t("rentHistory")}</SectionTitle>
        <Card>
          <ul>
            {rent.length === 0 && <li className="p-4 text-ink-2">{t("noRent")}</li>}
            {rent.map((e) => {
              const s = STATUS[e.status];
              return (
                <li key={e.id} className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-2 last:border-0">
                  <span className="flex-1">
                    <span className="num block text-base font-semibold">{e.dueOn}</span>
                    <span className="block text-sm text-ink-2">
                      {e.operatorReport ? t("confirmed") : e.riderReport ? t("provisional") : ""}
                    </span>
                  </span>
                  <Money paise={e.amountPaise} className="text-base font-semibold" />
                  <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${s.cls}`}>
                    <span aria-hidden>{s.mark} </span>
                    {t(s.key)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        </section>
        <section>
        <SectionTitle>{t("shocksTitle")}</SectionTitle>
        <Card>
          <ul>
            {shocks.length === 0 && <li className="p-4 text-ink-2">{t("noShocks")}</li>}
            {shocks.map((s) => (
              <li key={s.id} className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-2 last:border-0">
                <span className="flex-1">
                  <span className="block text-base font-semibold">{s.description || "—"}</span>
                  <span className="block text-sm text-ink-2">
                    {formatWhen(s.occurredAt, lang)} · {t(coverKey[s.coveredBy])}
                  </span>
                </span>
                <Money paise={s.amountPaise} className="text-base font-extrabold" />
              </li>
            ))}
          </ul>
        </Card>
        </section>
      </div>
    </div>
  );
}
