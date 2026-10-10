"use client";

// S7 — Onboarding, under three minutes: phone + OTP → language → name → fleet code
// (optional) → rent → floor → the two consent screens. No PAN, no KYC, no bank
// linking. Phone OTP needs the Supabase project (not provisioned yet), so this
// build shows a clearly-labelled demo code instead of sending an SMS.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRider } from "@/components/StoreProvider";
import { Button, Segmented, Stepper } from "@/components/ui";
import { DEFAULTS } from "@/lib/config";
import { formatINR } from "@/lib/money";
import { findOperator, onboard } from "@/lib/store/state";
import { translate, weekdayNames, type StringKey } from "@/lib/strings";
import type { Lang } from "@/lib/types";

type Step = "welcome" | "phone" | "otp" | "language" | "name" | "operator" | "rent" | "floor" | "consentApp" | "consentShare" | "done";

export default function OnboardingPage() {
  const { reset, now } = useRider();
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [lang, setLang] = useState<Lang>("en");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpCode] = useState(() => String(100000 + Math.floor(Math.random() * 900000)));
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [rent, setRent] = useState<number>(DEFAULTS.weeklyRentPaise);
  const [cadence, setCadence] = useState<"daily" | "weekly">("weekly");
  const [dueWeekday, setDueWeekday] = useState(1);
  const [floor, setFloor] = useState<number>(DEFAULTS.floorPaise);
  const [otpError, setOtpError] = useState(false);
  const t = (key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const operator = code ? findOperator(code) : null;

  const finish = (share: boolean) => {
    const state = onboard(
      {
        phone: `+91${phone}`,
        name,
        language: lang,
        operatorCode: operator ? code : "",
        rentAmountPaise: operator ? rent : 0,
        rentCadence: cadence,
        dueWeekday: cadence === "weekly" ? dueWeekday : null,
        floorPaise: floor,
        operatorShare: share,
      },
      now(),
    );
    reset(state);
    setStep("done");
  };

  const order: Step[] = ["welcome", "phone", "otp", "language", "name", "operator", ...(operator ? (["rent"] as Step[]) : []), "floor", "consentApp", ...(operator ? (["consentShare"] as Step[]) : []), "done"];
  const progress = Math.max(0, order.indexOf(step)) / (order.length - 1);

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-6 pt-4 lg:mx-auto lg:my-8 lg:min-h-[720px] lg:max-w-lg lg:rounded-3xl lg:border lg:border-line lg:bg-paper lg:p-10 lg:shadow-raised">
      {step !== "welcome" && step !== "done" && (
        <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-surface" aria-hidden>
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${progress * 100}%` }} />
        </div>
      )}

      {step === "welcome" && (
        <Screen title={t("obWelcome")} sub={t("obWelcomeSub")}>
          <div aria-hidden className="mx-auto my-6 flex h-36 w-36 items-center justify-center rounded-[2.5rem] bg-brand text-7xl font-extrabold text-white shadow-raised">
            ₹
          </div>
          <div className="mt-auto">
            <Button full size="lg" onClick={() => setStep("phone")}>{t("obStart")}</Button>
            <Button full size="lg" variant="ghost" className="mt-2" onClick={() => router.push("/")}>{t("obSeeDemo")}</Button>
          </div>
        </Screen>
      )}

      {step === "phone" && (
        <Screen title={t("obPhone")}>
          <label className="flex min-h-16 items-center gap-2 rounded-2xl border-2 border-line px-4 focus-within:border-brand">
            <span className="text-2xl font-semibold text-ink-2">+91</span>
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="tel-national"
              aria-label={t("obPhone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="num w-full bg-transparent text-2xl font-extrabold tracking-wider outline-none"
              placeholder="98765 43210"
            />
          </label>
          <Next disabled={!/^[6-9]\d{9}$/.test(phone)} onClick={() => setStep("otp")}>{t("obSendOtp")}</Next>
        </Screen>
      )}

      {step === "otp" && (
        <Screen title={t("obOtp")}>
          <p className="mb-3 rounded-xl bg-info-tint p-3 text-base font-semibold text-info">{t("obOtpDemo", { code: otpCode })}</p>
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={t("obOtp")}
            value={otp}
            onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(false); }}
            className="num min-h-16 w-full rounded-2xl border-2 border-line px-4 text-center text-3xl font-extrabold tracking-[0.4em] outline-none focus:border-brand"
          />
          {otpError && <p className="mt-2 text-base font-semibold text-alert">{t("obOtpWrong")}</p>}
          <Next disabled={otp.length !== 6} onClick={() => (otp === otpCode ? setStep("language") : setOtpError(true))}>{t("obNext")}</Next>
        </Screen>
      )}

      {step === "language" && (
        <Screen title={t("obLanguage")}>
          <div className="grid gap-3">
            {([["en", "English"], ["hi", "हिंदी (Hindi)"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={lang === value}
                onClick={() => setLang(value)}
                className={`press min-h-16 rounded-2xl border-2 text-2xl font-extrabold ${lang === value ? "border-brand bg-brand-tint" : "border-line"}`}
              >
                {label}
              </button>
            ))}
            <button type="button" disabled className="min-h-16 rounded-2xl border-2 border-line text-xl font-semibold text-ink-2 opacity-60">
              ಕನ್ನಡ · {t("langComing")}
            </button>
          </div>
          <Next onClick={() => setStep("name")}>{t("obNext")}</Next>
        </Screen>
      )}

      {step === "name" && (
        <Screen title={t("obName")}>
          <input
            autoFocus
            autoComplete="name"
            aria-label={t("obName")}
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 40))}
            className="min-h-16 w-full rounded-2xl border-2 border-line px-4 text-2xl font-semibold outline-none focus:border-brand"
          />
          <Next disabled={name.trim().length < 2} onClick={() => setStep("operator")}>{t("obNext")}</Next>
        </Screen>
      )}

      {step === "operator" && (
        <Screen title={t("obOperator")} sub={t("obOperatorHelp")}>
          <input
            autoFocus
            aria-label={t("obOperator")}
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)); setCodeError(false); }}
            className="min-h-16 w-full rounded-2xl border-2 border-line px-4 text-center text-2xl font-extrabold tracking-widest outline-none focus:border-brand"
            placeholder="QRDEMO"
          />
          {codeError && <p className="mt-2 text-base font-semibold text-alert">{t("obOperatorUnknown")}</p>}
          {operator && <p className="mt-2 text-base font-semibold text-brand-pressed">✓ {operator.name}</p>}
          <Next onClick={() => (code && !operator ? setCodeError(true) : setStep(operator ? "rent" : "floor"))}>{t("obNext")}</Next>
          <Button full variant="ghost" className="mt-2" onClick={() => { setCode(""); setStep("floor"); }}>{t("obSkip")}</Button>
        </Screen>
      )}

      {step === "rent" && (
        <Screen title={t("obRent")}>
          <Stepper label={t("rentAmount")} value={rent} step={5000} min={5000} max={1000000} format={(v) => formatINR(v)} onChange={setRent} />
          <div className="mt-5">
            <Segmented label={t("rentCadence")} value={cadence} onChange={setCadence} options={[{ value: "daily", label: t("daily") }, { value: "weekly", label: t("weekly") }]} />
          </div>
          {cadence === "weekly" && (
            <div className="mt-4 grid grid-cols-7 gap-1" role="radiogroup" aria-label={t("dueDay")}>
              {weekdayNames(lang).map((d, i) => (
                <button key={d} type="button" role="radio" aria-checked={dueWeekday === i} onClick={() => setDueWeekday(i)} className={`press min-h-12 rounded-lg text-sm font-semibold ${dueWeekday === i ? "bg-brand text-white" : "bg-surface"}`}>
                  {d}
                </button>
              ))}
            </div>
          )}
          <Next onClick={() => setStep("floor")}>{t("obNext")}</Next>
        </Screen>
      )}

      {step === "floor" && (
        <Screen title={t("obFloor")} sub={t("obFloorHelp")}>
          <Stepper label={t("floorTitle")} value={floor} step={5000} min={0} max={150000} format={(v) => formatINR(v)} onChange={setFloor} />
          <Next onClick={() => setStep("consentApp")}>{t("obNext")}</Next>
        </Screen>
      )}

      {step === "consentApp" && (
        <Screen title={t("obConsentApp")} sub={t("obConsentAppBody")}>
          <Next onClick={() => (operator ? setStep("consentShare") : finish(false))}>{t("obAgree")}</Next>
        </Screen>
      )}

      {step === "consentShare" && (
        <Screen title={t("obConsentShare")} sub={t("obConsentShareBody")}>
          <div className="mt-auto grid gap-2">
            <Button full size="lg" onClick={() => finish(true)}>{t("obAllow")}</Button>
            <Button full size="lg" variant="secondary" onClick={() => finish(false)}>{t("obDeny")}</Button>
          </div>
        </Screen>
      )}

      {step === "done" && (
        <Screen title={t("obDone")} sub={t("obDoneSub")}>
          <div aria-hidden className="mx-auto my-8 flex h-28 w-28 items-center justify-center rounded-full bg-brand-tint text-6xl">✓</div>
          <Button full size="lg" onClick={() => router.replace("/")}>{t("obNext")}</Button>
        </Screen>
      )}
    </div>
  );
}

function Screen({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="screen-in flex flex-1 flex-col">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      {sub && <p className="mt-2 text-lg text-ink-2">{sub}</p>}
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </section>
  );
}

function Next({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <Button full size="lg" className="mt-auto" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}
