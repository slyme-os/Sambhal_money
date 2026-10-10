"use client";

// S2 — Log a payout. Keypad, source chip, done. Then show exactly where the money
// went, in order: petrol + food first, then each pot.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyNudge } from "@/components/RentNudge";
import { useRider } from "@/components/StoreProvider";
import { AmountDisplay, Button, Chip, Keypad, Money, TopBar } from "@/components/ui";
import type { PayoutOutcome } from "@/lib/ledger";
import { PLATFORMS } from "@/lib/config";
import { formatINR } from "@/lib/money";
import { logPayout } from "@/lib/store/state";
import type { StringKey } from "@/lib/strings";
import type { Nudge, PayoutSource, PotKind } from "@/lib/types";

const POT_ROWS: { kind: PotKind; key: StringKey; icon: string }[] = [
  { kind: "rent", key: "potRent", icon: "🏍️" },
  { kind: "emergency", key: "potEmergency", icon: "🛟" },
  { kind: "savings", key: "potSavings", icon: "🪙" },
];

export default function PayoutPage() {
  const { state, commit, now, t } = useRider();
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [source, setSource] = useState<PayoutSource | null>(null);
  const [result, setResult] = useState<{ outcome: PayoutOutcome; nudge: Nudge | null } | null>(null);

  if (!state) return <TopBar back="/" title={t("logPayout")} />;
  const chosen = source ?? state.payouts.at(-1)?.source ?? "rapido";
  const label = (l: string) => (l in { sourceCash: 1, sourceOther: 1 } ? t(l as StringKey) : l);

  const submit = () => {
    const amountPaise = Number(digits) * 100;
    if (!amountPaise) return;
    const r = logPayout(state, { amountPaise, source: chosen }, now());
    commit(r.state);
    setResult({ outcome: r.outcome, nudge: r.nudge });
    if (r.nudge) {
      notifyNudge(
        t("nudgeTitle", { payout: formatINR(amountPaise).slice(1), rent: formatINR(r.nudge.context.amountPaise).slice(1) }),
        t("nudgeBody"),
      );
    }
  };

  if (result) {
    const { outcome } = result;
    const swept = outcome.allocations.rent + outcome.allocations.emergency + outcome.allocations.savings;
    const rows = [
      { key: "floor", icon: "⛽", title: t("keptForFloor"), sub: t("keptForFloorSub"), paise: outcome.toFloorPaise },
      ...POT_ROWS.filter((p) => outcome.allocations[p.kind] > 0).map((p) => ({
        key: p.kind,
        icon: p.icon,
        title: t("wentToPot", { pot: t(p.key) }),
        sub: "",
        paise: outcome.allocations[p.kind],
      })),
    ];
    return (
      <div className="lg:mx-auto lg:max-w-xl">
        <TopBar title={t("splitTitle", { amount: formatINR(outcome.amountPaise).slice(1) })} />
        <div className="px-4 pb-8 pt-4 lg:rounded-3xl lg:border lg:border-line lg:bg-paper lg:p-6 lg:shadow-card">
          <ol className="space-y-3">
            {rows.map((row, i) => (
              <li
                key={row.key}
                className={`${i === 0 ? "row-in" : "sweep-drop"} flex items-center gap-3 rounded-2xl border border-line p-4 shadow-card ${i === 0 ? "bg-surface" : "bg-brand-tint"}`}
                style={{ animationDelay: `${i * 140}ms` }}
              >
                <span aria-hidden className="text-2xl">{row.icon}</span>
                <span className="flex-1">
                  <span className="block text-base font-extrabold">{row.title}</span>
                  {row.sub && <span className="block text-sm text-ink-2">{row.sub}</span>}
                </span>
                <Money paise={row.paise} className="text-xl font-extrabold" />
              </li>
            ))}
          </ol>

          {swept === 0 && outcome.carryOutPaise === 0 && (
            <p className="mt-4 rounded-2xl bg-amber-tint p-4 text-base font-semibold">
              {t("nothingSwept", { floor: formatINR(state.rider.floorPaise).slice(1) })}
            </p>
          )}
          {outcome.carryOutPaise > 0 && (
            <p className="mt-4 rounded-2xl bg-surface p-4 text-base">{t("carried", { x: formatINR(outcome.carryOutPaise).slice(1) })}</p>
          )}

          <Button full size="lg" className="mt-6" onClick={() => router.push("/")}>
            {t("done")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col lg:mx-auto lg:min-h-0 lg:max-w-xl">
      <TopBar back="/" title={t("logPayout")} />
      <div className="flex flex-1 flex-col px-4 pb-4 lg:rounded-3xl lg:border lg:border-line lg:bg-paper lg:p-6 lg:shadow-card">
        <p className="mt-4 text-center text-base font-semibold text-ink-2">{t("howMuchCame")}</p>
        <AmountDisplay digits={digits} label={t("howMuchCame")} />

        <p className="mb-2 mt-2 text-base font-semibold text-ink-2">{t("fromWhere")}</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((s) => (
            <Chip key={s.value} selected={chosen === s.value} onClick={() => setSource(s.value)} dot={s.color}>
              {label(s.label)}
            </Chip>
          ))}
        </div>

        <div className="mt-auto pt-4">
          <Keypad value={digits} onChange={setDigits} />
          <Button full size="lg" className="mt-3" disabled={!digits} onClick={submit}>
            {t("addPayout")} {digits && <Money paise={Number(digits) * 100} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
