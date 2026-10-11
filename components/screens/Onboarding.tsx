"use client";

// First launch: pick a language (pre-selected from the phone), then 4 screens: what
// Sambhal does → why it's safe → first pot → daily essentials. Every screen is
// skippable; skipping keeps the usual settings.

import { useState } from "react";
import { ArrowLeft, Fuel, Landmark, PiggyBank, ShieldCheck, Sparkles } from "lucide-react";
import { ESSENTIALS_CHOICES_PAISE } from "@/lib/config";
import { RUPEE } from "@/lib/money";
import { potBalance } from "@/lib/ledger";
import { useSambhal } from "@/lib/store";
import { CHOOSE_LANGUAGE_MULTI, LanguageList } from "../sheets/LanguageSheet";
import { Chip, Money, POT_ICONS, PrimaryButton, TextButton, TrustBadge, potName } from "../ds";

const GOALS = [1000, 2500, 5000].map((r) => r * RUPEE);

export function Onboarding() {
  const { state, dispatch, t } = useSambhal();
  const [step, setStep] = useState(0);
  const [potId, setPotId] = useState(state.pots[0]?.id ?? "bike");
  const pot = state.pots.find((p) => p.id === potId) ?? state.pots[0];
  const [goal, setGoal] = useState(pot?.goalPaise ?? 2500 * RUPEE);
  const [essentials, setEssentials] = useState(state.essentialsPaise);

  const finish = () => {
    if (pot && goal !== pot.goalPaise) dispatch({ type: "updatePot", id: pot.id, patch: { goalPaise: goal } });
    if (essentials !== state.essentialsPaise) dispatch({ type: "setEssentials", paise: essentials });
    dispatch({ type: "completeOnboarding" });
    window.scrollTo(0, 0);
  };
  const skip = () => dispatch({ type: "completeOnboarding" });
  const next = () => (step < 4 ? setStep(step + 1) : finish());

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2">
      <div className="flex min-h-12 items-center justify-between">
        {step > 0 ? (
          <TextButton icon={ArrowLeft} tone="muted" onClick={() => setStep(step - 1)} className="-ml-3">{t("action.back")}</TextButton>
        ) : (
          <span className="chrome-dark grid h-10 w-10 place-items-center rounded-xl text-lg font-extrabold text-lime" aria-hidden>₹</span>
        )}
        <TextButton tone="muted" onClick={skip} className="-mr-3">{t("action.skip")}</TextButton>
      </div>

      {step > 0 && (
        <>
          <div className="mt-2 flex gap-1.5" aria-label={t("ob.step", { n: step })} role="img">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-night" : "bg-line"}`} />
            ))}
          </div>
          <p className="mt-2 text-sm font-semibold text-muted">{t("ob.step", { n: step })}</p>
        </>
      )}

      <div key={step} className="screen-in mt-6 flex-1">
        {step === 0 && (
          <>
            <h1 className="text-[28px] font-extrabold leading-tight text-ink">{t("lang.title")}</h1>
            <p className="mb-5 mt-2 text-base text-muted" translate="no">{CHOOSE_LANGUAGE_MULTI}</p>
            <LanguageList value={state.lang} onPick={(lang) => dispatch({ type: "setLang", lang })} />
          </>
        )}
        {step === 1 && (
          <>
            <Hero icons={[Fuel, Sparkles, PiggyBank]} />
            <h1 className="mt-6 text-[28px] font-extrabold leading-tight text-ink">{t("ob.1.title")}</h1>
            <p className="mt-3 text-lg text-ink-2">{t("ob.1.body")}</p>
          </>
        )}
        {step === 2 && (
          <>
            <Hero icons={[Landmark, ShieldCheck]} />
            <h1 className="mt-6 text-[28px] font-extrabold leading-tight text-ink">{t("ob.2.title")}</h1>
            <p className="mt-3 text-lg text-ink-2">{t("ob.2.body")}</p>
            <div className="mt-5 space-y-2">
              <TrustBadge icon={Landmark}>{t("trust.bank")}</TrustBadge>
              <TrustBadge icon={ShieldCheck}>{t("trust.confirm")}</TrustBadge>
              <TrustBadge icon={ShieldCheck}>{t("ob.2.noLend")}</TrustBadge>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="text-[28px] font-extrabold leading-tight text-ink">{t("ob.3.title")}</h1>
            <p className="mt-2 text-lg text-ink-2">{t("ob.3.body")}</p>
            <div className="mt-5 space-y-2" role="radiogroup">
              {state.pots.map((p) => {
                const Icon = POT_ICONS[p.icon];
                const sel = p.id === potId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => {
                      setPotId(p.id);
                      setGoal(p.goalPaise);
                    }}
                    className={`press flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-4 text-left ${sel ? "border-night bg-lime" : "border-transparent bg-card shadow-card"}`}
                  >
                    <Icon size={24} className={sel ? "text-night" : "text-green-700"} aria-hidden />
                    <span className="flex-1 text-lg font-bold text-ink">{potName(p, t)}</span>
                  </button>
                );
              })}
            </div>
            <p className="mb-2 mt-5 text-base font-semibold text-ink">{t("ob.3.goal")}</p>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <Chip key={g} selected={goal === g} disabled={!!pot && g < potBalance(state, pot.id)} onClick={() => setGoal(g)}>
                  <Money paise={g} />
                </Chip>
              ))}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <Hero icons={[Fuel]} />
            <h1 className="mt-6 text-[28px] font-extrabold leading-tight text-ink">{t("ob.4.title")}</h1>
            <p className="mt-2 text-lg text-ink-2">{t("ob.4.body")}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {ESSENTIALS_CHOICES_PAISE.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={essentials === p}
                  onClick={() => setEssentials(p)}
                  className={`press min-h-16 rounded-2xl border-2 text-2xl font-extrabold ${essentials === p ? "border-night bg-lime text-night" : "border-transparent bg-card text-ink shadow-card"}`}
                >
                  <Money paise={p} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-6 space-y-2">
        <PrimaryButton onClick={next}>{step < 4 ? t("action.next") : t("ob.start")}</PrimaryButton>
        <p className="text-center text-sm text-muted">{t("ob.skipHint")}</p>
      </div>
    </div>
  );
}

function Hero({ icons }: { icons: React.ComponentType<{ size?: number; strokeWidth?: number }>[] }) {
  return (
    <div aria-hidden className="lux-card flex h-40 items-center justify-center gap-3 rounded-[var(--radius-card)]">
      {icons.map((Icon, i) => (
        <span key={i} className={`grid place-items-center rounded-2xl ${i === Math.floor(icons.length / 2) ? "lime-tile text-night btn-glow h-20 w-20" : "h-14 w-14 bg-[#1d3a29] text-slime"}`}>
          <Icon size={i === Math.floor(icons.length / 2) ? 40 : 28} strokeWidth={2} />
        </span>
      ))}
    </div>
  );
}
