"use client";

// Log a spend. Shows live what's left for today, in red if it goes past today's
// essentials. Logging a spend moves no money, so there's no confirm step; Undo covers mistakes.

import { useState } from "react";
import { safeToSpend } from "@/lib/ledger";
import { digitsToPaise, formatINR } from "@/lib/money";
import { newId, useSambhal } from "@/lib/store";
import { AmountDisplay, Keypad, PrimaryButton, Sheet } from "../ds";

export function SpendSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch, t, showToast } = useSambhal();
  const [digits, setDigits] = useState("");
  const amount = digitsToPaise(digits);
  const safe = safeToSpend(state);
  const after = safe - amount;

  const save = () => {
    const id = newId("s");
    dispatch({ type: "spend", id, at: Date.now(), amountPaise: amount });
    onClose();
    showToast({ message: t("spend.toast"), undo: () => dispatch({ type: "remove", id }) });
  };

  return (
    <Sheet onClose={onClose} label={t("spend.title")}>
      <div className="space-y-4">
        <h2 className="pr-10 text-xl font-bold text-ink">{t("spend.title")}</h2>
        <AmountDisplay paise={amount} />
        <p className={`rounded-2xl p-3 text-center text-base font-semibold ${amount === 0 ? "bg-surface text-ink-2" : after < 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`} aria-live="polite">
          {amount === 0
            ? t("spend.safeNow", { amount: formatINR(Math.max(0, safe)) })
            : after < 0
              ? t("spend.over", { amount: formatINR(-after) })
              : t("spend.left", { amount: formatINR(after) })}
        </p>
        <Keypad value={digits} onChange={setDigits} />
        <PrimaryButton disabled={!amount} onClick={save}>
          {amount ? t("action.save") : t("pay.enter")}
        </PrimaryButton>
      </div>
    </Sheet>
  );
}
