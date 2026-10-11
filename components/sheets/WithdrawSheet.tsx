"use client";

// Take money out of a pot: amount + reason → confirm (amount, from where, to where,
// when it arrives) → done. The rider approves it; nobody else does. Never "instant".

import { useState } from "react";
import { CalendarClock, Landmark } from "lucide-react";
import type { WithdrawReason } from "@/lib/ledger";
import { potBalance } from "@/lib/ledger";
import { digitsToPaise, formatINR } from "@/lib/money";
import { newId, useSambhal } from "@/lib/store";
import { AmountDisplay, Chip, ConfirmBody, Keypad, POT_ICONS, PrimaryButton, Sheet, potName } from "../ds";

const REASONS: WithdrawReason[] = ["repair", "emergency", "other"];

export function WithdrawSheet({ potId, onClose }: { potId: string; onClose: () => void }) {
  const { state, dispatch, t, showToast } = useSambhal();
  const pot = state.pots.find((p) => p.id === potId);
  const [digits, setDigits] = useState("");
  const [reason, setReason] = useState<WithdrawReason>(pot?.icon === "shield" ? "emergency" : "repair");
  const [step, setStep] = useState<"amount" | "confirm">("amount");
  if (!pot) return null;

  const name = potName(pot, t);
  const balance = potBalance(state, pot.id);
  const amount = digitsToPaise(digits);
  const tooMuch = amount > balance;

  const confirm = () => {
    const id = newId("w");
    dispatch({ type: "withdraw", id, at: Date.now(), potId: pot.id, amountPaise: amount, reason });
    onClose();
    showToast({ message: t("wd.toast", { amount: formatINR(amount) }), undo: () => dispatch({ type: "remove", id }) });
  };

  return (
    <Sheet onClose={onClose} label={t("wd.title")}>
      {step === "amount" ? (
        <div className="space-y-4">
          <div className="pr-10">
            <h2 className="text-xl font-bold text-ink">{t("wd.title")}</h2>
            <p className="text-sm text-muted">
              {t("wd.from", { pot: name })} · {t("wd.available", { amount: formatINR(balance) })}
            </p>
          </div>
          <AmountDisplay paise={amount} tone={tooMuch ? "red" : "ink"} />
          {tooMuch && <p className="rounded-2xl bg-red-50 p-3 text-center text-sm font-semibold text-red-700" role="alert">{t("wd.tooMuch", { amount: formatINR(balance) })}</p>}
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-2">{t("wd.why")}</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <Chip key={r} selected={reason === r} onClick={() => setReason(r)}>
                  {t(`wd.${r}`)}
                </Chip>
              ))}
            </div>
          </div>
          <Keypad value={digits} onChange={setDigits} />
          <PrimaryButton disabled={!amount || tooMuch} onClick={() => setStep("confirm")}>
            {amount ? t("action.next") : t("pay.enter")}
          </PrimaryButton>
        </div>
      ) : (
        <ConfirmBody
          title={t("wd.previewTitle", { amount: formatINR(amount), pot: name })}
          rows={[
            { label: t("wd.from", { pot: name }), paise: amount, tone: "ink", icon: POT_ICONS[pot.icon] },
            { label: t("row.toBank"), paise: amount, tone: "green", icon: Landmark },
          ]}
          note={
            <p className="flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">
              <CalendarClock size={18} aria-hidden />
              {t("wd.arrives")}
            </p>
          }
          confirmLabel={t("action.confirm")}
          onConfirm={confirm}
          onBack={() => setStep("amount")}
        />
      )}
    </Sheet>
  );
}
