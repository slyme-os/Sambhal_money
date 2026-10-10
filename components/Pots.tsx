"use client";

import { SOURCES } from "@/lib/config";
import { formatINR } from "@/lib/money";
import { useSambhal } from "@/lib/store";
import { POTS, seedHistory } from "@/lib/seed";
import { Bar, Bi } from "./ui";

export function Pots() {
  const { state } = useSambhal();
  const total = state.pots.bike + state.pots.emergency + state.pots.savings;

  const history = seedHistory();
  const days = [...history, { label: "आज", sweptPaise: state.sweptTodayPaise }];
  const max = Math.max(1, ...days.map((d) => d.sweptPaise));

  return (
    <div className="screen-in space-y-5 px-5 pb-8 pt-5">
      <Bi hi="गुल्लक" en="Your pots" />

      <section className="rounded-3xl bg-green p-6 text-white shadow-raised">
        <Bi hi="कुल बचत" en="Total saved" tone="light" />
        <p className="num mt-2 text-5xl font-extrabold">{formatINR(total)}</p>
      </section>

      <section className="space-y-3" aria-label="Pot details">
        {POTS.map((p) => {
          const balance = state.pots[p.key];
          const todays = state.payouts.reduce((s, x) => s + x.split[p.key], 0);
          return (
            <article key={p.key} className="rounded-2xl border border-line bg-paper p-4 shadow-card">
              <div className="flex items-center gap-3">
                <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface text-2xl">
                  {p.icon}
                </span>
                <Bi className="flex-1" hi={p.hi} en={p.en} />
                <p className="num text-2xl font-extrabold">{formatINR(balance)}</p>
              </div>
              <div className="mt-3">
                <Bar value={balance / p.goalPaise} label={p.en} color={p.key === "emergency" ? "var(--amber)" : "var(--green)"} />
                <div className="mt-1.5 flex justify-between text-xs text-muted">
                  <span>लक्ष्य {formatINR(p.goalPaise)} · goal {formatINR(p.goalPaise)}</span>
                  <span className="num">आज +{formatINR(todays)}</span>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-line bg-paper p-4 shadow-card" aria-label="Last 30 days">
        <Bi hi="पिछले 30 दिन" en="Last 30 days, swept to pots" />
        <div className="mt-4 flex h-32 items-end gap-[3px]" role="img" aria-label={`Swept per day, today ${formatINR(state.sweptTodayPaise)}`}>
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            return (
              <div
                key={`${d.label}-${i}`}
                className={`flex-1 rounded-t-sm ${isToday ? "bg-amber" : d.sweptPaise ? "bg-green" : "bg-line"}`}
                style={{ height: `${Math.max(4, (d.sweptPaise / max) * 100)}%` }}
                title={`${d.label}: ${formatINR(d.sweptPaise)}`}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-2" aria-label="Today's payments">
        <Bi hi="आज के पेमेंट" en="Today's payments" />
        {state.payouts.length === 0 && <p className="text-sm text-muted">अभी कोई पेमेंट नहीं · No payments yet</p>}
        {state.payouts.map((p) => {
          const src = SOURCES.find((s) => s.id === p.source);
          const swept = p.split.bike + p.split.emergency + p.split.savings;
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-3.5">
              <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: src?.color }} />
              <div className="flex-1">
                <p className="font-semibold">{src?.label}</p>
                <p className="text-xs text-muted">
                  {swept > 0 ? `${formatINR(swept)} गुल्लक में · to pots` : "कुछ नहीं कटा · nothing swept"}
                </p>
              </div>
              <p className="num font-extrabold">{formatINR(p.amountPaise)}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
