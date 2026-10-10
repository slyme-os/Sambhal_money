"use client";

// Log a payout: keypad, source, then an animated split showing where every rupee went.
// The split shown is computed by the same sweep() the reducer runs, so they match.

import { useState } from "react";
import { SOURCES, FLOOR_PAISE, type SourceId } from "@/lib/config";
import { formatINR, digitsToPaise } from "@/lib/money";
import { sweep, type SweepResult } from "@/lib/sweep";
import { useSambhal } from "@/lib/store";
import { Bi, Button, Keypad, Sheet } from "./ui";

export function PayoutSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useSambhal();
  const [digits, setDigits] = useState("");
  const [source, setSource] = useState<SourceId>("rapido");
  const [result, setResult] = useState<{ amount: number; r: SweepResult } | null>(null);

  const amount = digitsToPaise(digits);

  const submit = () => {
    if (!amount) return;
    const r = sweep(amount, state.earnedTodayPaise, FLOOR_PAISE);
    dispatch({ type: "payout", id: `p-${Date.now()}`, amountPaise: amount, source });
    setResult({ amount, r });
  };

  return (
    <Sheet onClose={onClose} label="Payment came">
      {!result ? (
        <div className="space-y-5">
          <Bi hi="पेमेंट आया" en="Payment came" />

          <p className="num display text-center text-[56px] font-semibold" aria-live="polite">
            {amount ? formatINR(amount) : <span className="text-muted">₹0</span>}
          </p>

          <div>
            <p className="mb-2 text-sm font-semibold text-muted">कहाँ से? · From where?</p>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={source === s.id}
                  onClick={() => setSource(s.id)}
                  className={`press flex min-h-12 items-center gap-2 rounded-full border px-4 font-semibold ${
                    source === s.id ? "border-ink bg-lime text-ink" : "border-line bg-paper"
                  }`}
                >
                  <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${source === s.id ? "bg-ink" : "bg-green"}`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <Keypad value={digits} onChange={setDigits} />
          <Button onClick={submit} disabled={!amount}>
            जोड़ो · Add
          </Button>
        </div>
      ) : (
        <Split amount={result.amount} r={result.r} earnedAfter={state.earnedTodayPaise} onDone={onClose} />
      )}
    </Sheet>
  );
}

function Split({ amount, r, earnedAfter, onDone }: { amount: number; r: SweepResult; earnedAfter: number; onDone: () => void }) {
  const rows = [
    { key: "kept", hi: "पेट्रोल-खाना", en: "Petrol + food · kept", paise: r.toFloor, cls: "bg-surface" },
    { key: "bike", hi: "बाइक और मरम्मत", en: "Bike & Repairs", paise: r.split.bike, cls: "bg-mint" },
    { key: "emergency", hi: "इमरजेंसी", en: "Emergency", paise: r.split.emergency, cls: "bg-lime-soft" },
    { key: "savings", hi: "बचत", en: "Savings", paise: r.split.savings, cls: "bg-mint" },
  ];
  const notEnoughForFloor = !r.swept && earnedAfter < FLOOR_PAISE;

  return (
    <div className="space-y-4">
      <Bi hi={`${formatINR(amount)} ऐसे बँटा`} en="Here's where every rupee went" />

      <ol className="space-y-2.5">
        {rows.map((row, i) => (
          <li
            key={row.key}
            className={`row-in flex items-center gap-3 rounded-2xl p-4 ${row.cls}`}
            style={{ animationDelay: `${i * 180}ms` }}
          >
            <Bi className="flex-1" hi={row.hi} en={row.en} />
            <p className="num text-xl font-semibold">{formatINR(row.paise)}</p>
          </li>
        ))}
      </ol>

      {notEnoughForFloor && (
        <p className="row-in rounded-2xl bg-surface p-4 text-sm font-semibold" style={{ animationDelay: "720ms" }}>
          आज अभी {formatINR(FLOOR_PAISE)} का खर्चा भी पूरा नहीं हुआ — कुछ नहीं कटा।
          <span className="mt-1 block text-xs font-normal text-muted">
            Today&apos;s {formatINR(FLOOR_PAISE)} petrol and food isn&apos;t covered yet — nothing was swept.
          </span>
        </p>
      )}

      <Button onClick={onDone}>ठीक है · Done</Button>
    </div>
  );
}
