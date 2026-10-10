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
    <div className="screen-in space-y-6 px-5 pb-8 pt-4">
      <section className="space-y-2 pt-2">
        <p className="text-sm font-semibold text-green">हर पेमेंट से बचत</p>
        <h1 className="display text-[40px] font-semibold">Save from every payout.</h1>
      </section>

      <section className="hero-haze rounded-[28px] border border-line p-6" aria-label="Safe to spend today">
        <Bi hi="आज खर्च कर सकते हो" en="Safe to spend today" />
        <p className="num display mt-5 text-[64px] font-semibold">{formatINR(safe)}</p>

        <dl className="mt-6 grid grid-cols-3 gap-2">
          <Stat hi="आज कमाए" en="Earned" value={formatINR(state.earnedTodayPaise)} />
          <Stat hi="पेट्रोल-खाना" en="Floor held" value={formatINR(floorHeld(state))} />
          <Stat hi="गुल्लक में" en="Swept" value={formatINR(state.sweptTodayPaise)} />
        </dl>
        <p className="mt-4 text-xs text-muted">
          पेट्रोल-खाने का {formatINR(FLOOR_PAISE)} कभी नहीं छुआ जाता · Floor of {formatINR(FLOOR_PAISE)} is never swept
        </p>
      </section>

      <section aria-label="Your three pots" className="space-y-3">
        <Bi hi="तीन गुल्लक" en="Your three pots" />
        <ul className="divide-y divide-line">
          {POTS.map((p) => {
            const balance = state.pots[p.key];
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
                  <p className="mt-1.5 text-xs text-muted">लक्ष्य {formatINR(p.goalPaise)} · goal {formatINR(p.goalPaise)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-3">
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
    <div className="rounded-2xl border border-line bg-paper p-3">
      <dt className="text-xs font-semibold leading-tight">{hi}</dt>
      <dd className="text-xs leading-tight text-muted">{en}</dd>
      <dd className="num mt-2 text-base font-semibold">{value}</dd>
    </div>
  );
}
