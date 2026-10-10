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
    <div className="screen-in space-y-6 px-5 pb-8 pt-4">
      <section className="hero-haze rounded-[28px] border border-line p-6">
        <Bi hi="कुल बचत" en="Total saved" />
        <p className="num display mt-5 text-[52px] font-semibold">{formatINR(total)}</p>
      </section>

      <section className="space-y-3" aria-label="Pot details">
        <Bi hi="गुल्लक" en="Your pots" />
        <ul className="divide-y divide-line">
          {POTS.map((p) => {
            const balance = state.pots[p.key];
            const todays = state.payouts.reduce((s, x) => s + x.split[p.key], 0);
            return (
              <li key={p.key} className="py-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface text-xl">
                    {p.icon}
                  </span>
                  <Bi className="flex-1" hi={p.hi} en={p.en} />
                  <p className="num text-xl font-semibold">{formatINR(balance)}</p>
                </div>
                <div className="mt-3">
                  <Bar value={balance / p.goalPaise} label={p.en} />
                  <div className="mt-1.5 flex justify-between text-xs text-muted">
                    <span>लक्ष्य {formatINR(p.goalPaise)} · goal {formatINR(p.goalPaise)}</span>
                    <span className="num">आज +{formatINR(todays)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-4" aria-label="Last 30 days">
        <Bi hi="पिछले 30 दिन" en="Last 30 days, swept to pots" />
        <div className="flex h-32 items-end gap-[3px]" role="img" aria-label={`Swept per day, today ${formatINR(state.sweptTodayPaise)}`}>
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            return (
              <div
                key={`${d.label}-${i}`}
                className={`flex-1 rounded-t-sm ${isToday ? "bg-ink" : d.sweptPaise ? "bg-green" : "bg-mint-deep"}`}
                style={{ height: `${Math.max(4, (d.sweptPaise / max) * 100)}%` }}
                title={`${d.label}: ${formatINR(d.sweptPaise)}`}
              />
            );
          })}
        </div>
        <p className="text-xs text-muted">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green" aria-hidden /> गुल्लक में · swept&nbsp;&nbsp;
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-ink" aria-hidden /> आज · today
        </p>
      </section>

      <section className="space-y-3" aria-label="Today's payments">
        <Bi hi="आज के पेमेंट" en="Today's payments" />
        {state.payouts.length === 0 && <p className="text-sm text-muted">अभी कोई पेमेंट नहीं · No payments yet</p>}
        <ul className="divide-y divide-line">
          {state.payouts.map((p) => {
            const src = SOURCES.find((s) => s.id === p.source);
            const swept = p.split.bike + p.split.emergency + p.split.savings;
            return (
              <li key={p.id} className="flex items-center gap-3 py-3.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-green" />
                <div className="flex-1">
                  <p className="font-semibold">{src?.label}</p>
                  <p className="text-xs text-muted">
                    {swept > 0 ? `${formatINR(swept)} गुल्लक में · to pots` : "कुछ नहीं कटा · nothing swept"}
                  </p>
                </div>
                <p className="num font-semibold">{formatINR(p.amountPaise)}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
