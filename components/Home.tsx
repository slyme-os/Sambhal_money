"use client";

import { useSambhal } from "@/lib/store";
import { FLOOR_PAISE } from "@/lib/config";
import { formatINR } from "@/lib/money";
import { floorHeld, safeToSpend } from "@/lib/state";
import { POTS } from "@/lib/seed";
import { Bar, Bi, Button } from "./ui";

export function Home({ onPayout, onSpend }: { onPayout: () => void; onSpend: () => void }) {
  const { state } = useSambhal();
  const safe = safeToSpend(state);

  return (
    <div className="screen-in space-y-5 px-5 pb-8 pt-5">
      <section className="rounded-3xl bg-green p-6 text-white shadow-raised" aria-label="Safe to spend today">
        <Bi hi="आज खर्च कर सकते हो" en="Safe to spend today" tone="light" />
        <p className="num mt-2 text-6xl font-extrabold tracking-tight">{formatINR(safe)}</p>

        <dl className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-3">
          <Stat hi="आज कमाए" en="Earned" value={formatINR(state.earnedTodayPaise)} />
          <Stat hi="पेट्रोल-खाना" en="Floor held" value={formatINR(floorHeld(state))} />
          <Stat hi="गुल्लक में" en="Swept" value={formatINR(state.sweptTodayPaise)} />
        </dl>
        <p className="mt-3 text-xs text-white/80">
          पेट्रोल-खाने का {formatINR(FLOOR_PAISE)} कभी नहीं छुआ जाता · Floor of {formatINR(FLOOR_PAISE)} is never swept
        </p>
      </section>

      <section aria-label="Your three pots" className="space-y-3">
        <Bi hi="तीन गुल्लक" en="Your three pots" />
        {POTS.map((p) => {
          const balance = state.pots[p.key];
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
                <p className="mt-1.5 text-xs text-muted">लक्ष्य {formatINR(p.goalPaise)} · goal {formatINR(p.goalPaise)}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-2 gap-3 pt-1">
        <Button onClick={onPayout} className="flex-col !py-3">
          <span>पेमेंट आया</span>
          <span className="text-xs font-normal opacity-80">Payment came</span>
        </Button>
        <Button variant="ghost" onClick={onSpend} className="flex-col !py-3">
          <span>खर्च हुआ</span>
          <span className="text-xs font-normal text-muted">I spent</span>
        </Button>
      </section>

      <p className="text-center text-xs text-muted">
        पैसा आपके अपने बैंक खाते में ही रहता है · Money stays in your own bank account
      </p>
    </div>
  );
}

function Stat({ hi, en, value }: { hi: string; en: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-white">{hi}</dt>
      <dd className="text-[11px] text-white/75">{en}</dd>
      <dd className="num mt-1 text-lg font-extrabold">{value}</dd>
    </div>
  );
}
