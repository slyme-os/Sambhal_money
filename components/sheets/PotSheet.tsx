"use client";

// Create or edit a pot: name, icon, goal, and its share of each payment's extra.
// The first pot always gets whatever the others leave, so shares can't add up past 100%.

import { useState } from "react";
import type { Pot, PotIcon } from "@/lib/ledger";
import { shares, sharesOverflow } from "@/lib/ledger";
import { RUPEE } from "@/lib/money";
import { newId, useSambhal } from "@/lib/store";
import { Chip, Money, POT_ICONS, PrimaryButton, Sheet, potName } from "../ds";

const GOALS = [1000, 2500, 5000, 10000].map((r) => r * RUPEE);
const SHARE_CHOICES = [5, 10, 20, 30, 40];
const ICONS = Object.keys(POT_ICONS) as PotIcon[];

export function PotSheet({ potId, onClose }: { potId?: string; onClose: () => void }) {
  const { state, dispatch, t, showToast } = useSambhal();
  const existing = state.pots.find((p) => p.id === potId);
  const isFirst = !!existing && state.pots[0]?.id === existing.id;
  const [name, setName] = useState(existing ? potName(existing, t) : "");
  const [icon, setIcon] = useState<PotIcon>(existing?.icon ?? "phone");
  const [goalRupees, setGoalRupees] = useState(String((existing?.goalPaise ?? 2500 * RUPEE) / RUPEE));
  const [weight, setWeight] = useState(existing?.weight ?? 10);
  const [touched, setTouched] = useState(false);

  const goalPaise = Math.max(0, Math.floor(Number(goalRupees) || 0)) * RUPEE;
  const draft: Pot = { id: existing?.id ?? "draft", icon, goalPaise, weight, label: name.trim() };
  const nextPots = existing ? state.pots.map((p) => (p.id === existing.id ? { ...p, weight } : p)) : [...state.pots, draft];
  const overflow = sharesOverflow(nextPots);
  const first = state.pots[0];
  const firstShare = shares(nextPots)[first.id];
  const nameMissing = name.trim().length === 0;
  const canSave = !nameMissing && goalPaise > 0 && !overflow;

  const save = () => {
    setTouched(true);
    if (!canSave) return;
    const keepKey = existing?.nameKey && name.trim() === potName(existing, t);
    if (existing) {
      dispatch({
        type: "updatePot",
        id: existing.id,
        patch: { icon, goalPaise, weight, label: keepKey ? existing.label : name.trim(), nameKey: keepKey ? existing.nameKey : undefined },
      });
      showToast({ message: t("edit.saved") });
    } else {
      dispatch({ type: "createPot", pot: { ...draft, id: newId("pot") } });
      showToast({ message: t("edit.created") });
    }
    onClose();
  };

  return (
    <Sheet onClose={onClose} label={existing ? t("edit.editTitle") : t("edit.newTitle")}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <h2 className="pr-10 text-xl font-bold text-ink">{existing ? t("edit.editTitle") : t("edit.newTitle")}</h2>

        <div>
          <label htmlFor="pot-name" className="mb-2 block text-base font-semibold text-ink">{t("edit.name")}</label>
          <input
            id="pot-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={t("edit.namePlaceholder")}
            maxLength={28}
            aria-invalid={touched && nameMissing}
            aria-describedby={touched && nameMissing ? "pot-name-err" : undefined}
            className="min-h-14 w-full rounded-2xl border-2 border-line-strong bg-card px-4 text-lg text-ink placeholder:text-muted focus:border-green-700 focus:outline-none"
          />
          {touched && nameMissing && <p id="pot-name-err" className="mt-1.5 text-sm font-semibold text-red-600">{t("edit.nameRequired")}</p>}
        </div>

        <fieldset>
          <legend className="mb-2 text-base font-semibold text-ink">{t("edit.icon")}</legend>
          <div className="grid grid-cols-4 gap-2">
            {ICONS.map((k) => {
              const Icon = POT_ICONS[k];
              return (
                <button key={k} type="button" aria-pressed={icon === k} aria-label={k} onClick={() => setIcon(k)} className={`press grid h-14 place-items-center rounded-2xl border-2 ${icon === k ? "border-green-700 bg-green-50 text-green-700" : "border-transparent bg-surface text-ink-2"}`}>
                  <Icon size={24} aria-hidden />
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="pot-goal" className="mb-2 block text-base font-semibold text-ink">{t("edit.goal")}</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <Chip key={g} selected={goalPaise === g} onClick={() => setGoalRupees(String(g / RUPEE))}>
                <Money paise={g} />
              </Chip>
            ))}
          </div>
          <div className="flex min-h-14 items-center rounded-2xl border-2 border-line-strong bg-card px-4 focus-within:border-green-700">
            <span className="money text-lg font-bold text-ink-2" aria-hidden>₹</span>
            <input id="pot-goal" inputMode="numeric" pattern="[0-9]*" value={goalRupees} onChange={(e) => setGoalRupees(e.target.value.replace(/\D/g, "").slice(0, 6))} className="money min-h-12 w-full bg-transparent px-2 text-lg font-bold text-ink focus:outline-none" />
          </div>
        </div>

        <fieldset>
          <legend className="mb-1 text-base font-semibold text-ink">{t("edit.share")}</legend>
          {isFirst ? (
            <p className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">
              {t("edit.shareRest")} ({shares(state.pots)[first.id]}%)
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {SHARE_CHOICES.map((w) => (
                  <Chip key={w} selected={weight === w} onClick={() => setWeight(w)}>
                    {w}%
                  </Chip>
                ))}
              </div>
              <p className={`mt-2 text-sm ${overflow ? "font-semibold text-red-600" : "text-muted"}`} role={overflow ? "alert" : undefined}>
                {overflow
                  ? t("edit.shareTooHigh", { pot: potName(first, t) })
                  : `${t("pot.shareExample", { n: weight })} · ${t("edit.shareFrom", { pot: potName(first, t), pct: firstShare })}`}
              </p>
            </>
          )}
        </fieldset>

        <PrimaryButton type="submit" disabled={touched && !canSave}>
          {existing ? t("action.save") : t("edit.create")}
        </PrimaryButton>
      </form>
    </Sheet>
  );
}
