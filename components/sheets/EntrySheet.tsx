"use client";

// Remove one of today's entries (the way to fix a wrong amount: remove, then add again).
// Removing a payment recomputes the whole day, so later payments re-fill essentials correctly.

import { formatINR } from "@/lib/money";
import { useSambhal } from "@/lib/store";
import { ConfirmBody, Sheet, TransactionRow, potName } from "../ds";
import { rowFor, sourceLabel } from "../rows";

export function EntrySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, dispatch, t, showToast } = useSambhal();
  const e = state.entries.find((x) => x.id === id);
  if (!e || e.kind === "opening") return null;

  const amount = formatINR(e.amountPaise);
  const desc =
    e.kind === "payout"
      ? t("rm.payment", { amount, source: sourceLabel(e.source, t) })
      : e.kind === "spend"
        ? t("rm.spend", { amount })
        : t("rm.withdraw", { amount, pot: (() => { const p = state.pots.find((x) => x.id === e.potId); return p ? potName(p, t) : ""; })() });

  const remove = () => {
    dispatch({ type: "remove", id });
    onClose();
    showToast({ message: e.kind === "payout" ? t("pay.removed") : t("spend.removed") });
  };

  return (
    <Sheet onClose={onClose} label={t("rm.title")}>
      <div className="mb-2">
        <TransactionRow {...rowFor(e, state, t)} />
      </div>
      <ConfirmBody title={t("rm.title")} sub={desc} rows={[]} confirmLabel={t("action.remove")} onConfirm={remove} onBack={onClose} danger />
    </Sheet>
  );
}
