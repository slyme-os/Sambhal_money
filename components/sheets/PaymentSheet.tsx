"use client";

// Payment received, in two taps on the usual path: the last amount and source are
// already filled in → Next → Confirm. The preview shows exactly where every rupee goes
// before anything moves; the done step plays the sweep into pots.

import { useState } from "react";
import { CircleCheck, Fuel, TriangleAlert } from "lucide-react";
import { LARGE_PAYMENT_PAISE, SOURCES, type SourceId } from "@/lib/config";
import { allocate, earnedToday } from "@/lib/ledger";
import { digitsToPaise, formatINR } from "@/lib/money";
import { newId, useSambhal } from "@/lib/store";
import { sweep } from "@/lib/sweep";
import { AmountDisplay, Chip, ConfirmBody, Keypad, Money, POT_ICONS, PrimaryButton, Sheet, potName, type ConfirmRow } from "../ds";
import { sourceLabel } from "../rows";

export function PaymentSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch, t, showToast } = useSambhal();
  const [digits, setDigits] = useState(state.lastAmountPaise ? String(state.lastAmountPaise / 100) : "");
  const [source, setSource] = useState<SourceId>(state.lastSource);
  const [step, setStep] = useState<"amount" | "preview" | "done">("amount");
  const [entryId] = useState(() => newId("p"));
  const amount = digitsToPaise(digits);

  const r = sweep(amount, earnedToday(state), state.essentialsPaise);
  const alloc = allocate(r.surplus, state.pots);
  const rows: ConfirmRow[] = [
    ...(r.toFloor > 0 ? [{ label: t("row.toEssentials"), paise: r.toFloor, tone: "amber" as const, icon: Fuel }] : []),
    ...state.pots
      .filter((p) => (alloc[p.id] ?? 0) > 0)
      .map((p) => ({ label: potName(p, t), paise: alloc[p.id], tone: "green" as const, icon: POT_ICONS[p.icon] })),
  ];

  const confirm = () => {
    dispatch({ type: "payout", id: entryId, at: Date.now(), amountPaise: amount, source });
    setStep("done");
  };
  const finish = () => {
    onClose();
    showToast({ message: t("pay.toast"), undo: () => dispatch({ type: "remove", id: entryId }) });
  };

  return (
    <Sheet onClose={step === "done" ? finish : onClose} label={t("pay.title")}>
      {step === "amount" && (
        <div className="space-y-4">
          <h2 className="pr-10 text-xl font-bold text-ink">{t("pay.amount")}</h2>
          <AmountDisplay paise={amount} />

          <div>
            <p className="mb-2 text-sm font-semibold text-ink-2">{t("pay.from")}</p>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((s) => (
                <Chip key={s.id} selected={source === s.id} onClick={() => setSource(s.id)}>
                  {sourceLabel(s.id, t)}
                </Chip>
              ))}
            </div>
          </div>

          {state.lastAmountPaise > 0 && digitsToPaise(digits) !== state.lastAmountPaise && (
            <Chip selected={false} onClick={() => setDigits(String(state.lastAmountPaise / 100))}>
              {t("pay.last")} · <Money paise={state.lastAmountPaise} />
            </Chip>
          )}

          {amount > LARGE_PAYMENT_PAISE && (
            <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
              {t("pay.big")}
            </p>
          )}

          <Keypad value={digits} onChange={setDigits} />
          <PrimaryButton onClick={() => setStep("preview")} disabled={!amount}>
            {amount ? t("action.next") : t("pay.enter")}
          </PrimaryButton>
        </div>
      )}

      {step === "preview" && (
        <ConfirmBody
          title={t("pay.previewTitle", { amount: formatINR(amount), source: sourceLabel(source, t) })}
          sub={t("pay.previewSub")}
          rows={rows}
          note={r.surplus === 0 ? <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">{t("pay.notEnough")}</p> : undefined}
          confirmLabel={t("action.confirm")}
          onConfirm={confirm}
          onBack={() => setStep("amount")}
        />
      )}

      {step === "done" && (
        <div className="space-y-4">
          <div className="flex flex-col items-center pt-2 text-center">
            <CircleCheck size={48} className="text-green-700" strokeWidth={2} aria-hidden />
            <p className="amount-split mt-2 text-2xl font-extrabold text-ink" aria-live="polite">
              {r.surplus > 0 ? t("pay.doneTitle", { amount: formatINR(r.surplus) }) : t("pay.doneNone", { amount: formatINR(r.toFloor) })}
            </p>
          </div>
          <ol className="space-y-2">
            {rows.map((row, i) => {
              const Icon = row.icon!;
              return (
                <li key={row.label} className={`flow-in flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 ${row.tone === "amber" ? "bg-amber-50" : "bg-green-50"}`} style={{ animationDelay: `${120 + i * 110}ms` }}>
                  <Icon size={20} aria-hidden className={row.tone === "amber" ? "text-amber-700" : "text-green-700"} />
                  <span className="flex-1 font-semibold text-ink">{row.label}</span>
                  <Money paise={row.paise} sign="+" className="text-lg font-extrabold text-green-700" />
                </li>
              );
            })}
          </ol>
          <PrimaryButton onClick={finish}>{t("action.done")}</PrimaryButton>
        </div>
      )}
    </Sheet>
  );
}
