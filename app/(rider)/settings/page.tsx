"use client";

// S6 — Settings. Floor, split, language, consent (each separately withdrawable,
// with a plain-language line about exactly what the operator sees), rent terms.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useRider } from "@/components/StoreProvider";
import { Button, Card, SectionTitle, Segmented, Stepper, Toggle, TopBar } from "@/components/ui";
import { parsePayoutCsv } from "@/lib/csv";
import { formatINR } from "@/lib/money";
import { clearRider } from "@/lib/store/persist";
import { hasConsent, importPayouts, setConsent, updateRentAgreement, updateSettings } from "@/lib/store/state";
import { weekdayNames } from "@/lib/strings";
import type { Lang } from "@/lib/types";

const rupees = (p: number) => formatINR(p);

export default function SettingsPage() {
  const { state, commit, reset, now, t, toast, lang } = useRider();
  const router = useRouter();
  const [notif, setNotif] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => {
    setNotif("Notification" in window ? Notification.permission : "unsupported");
  }, []);
  if (!state) return <TopBar title={t("settingsTitle")} />;

  const { rider, rentAgreement } = state;
  const at = now();
  const save = (next: typeof state) => commit(next);

  const onCsv = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parsePayoutCsv(await file.text());
    const r = importPayouts(state, parsed.rows, now());
    commit(r.state);
    toast(r.added ? t("importDone", { n: r.added }) : t("importNone"), r.added ? "ok" : "warn");
  };

  const askNotif = async () => {
    if (!("Notification" in window)) return;
    setNotif(await Notification.requestPermission());
  };

  return (
    <div>
      <div className="lg:mx-auto lg:max-w-2xl"><TopBar title={t("settingsTitle")} /></div>
      <div className="px-4 pb-10 lg:mx-auto lg:max-w-2xl lg:px-0">
        <SectionTitle>{t("floorTitle")}</SectionTitle>
        <Card className="p-4">
          <Stepper
            label={t("floorTitle")}
            value={rider.floorPaise}
            step={5000}
            min={0}
            max={150000}
            format={rupees}
            onChange={(v) => save(updateSettings(state, { floorPaise: v }, at))}
          />
          <p className="mt-3 text-sm text-ink-2">{t("floorHelp")}</p>
        </Card>

        <SectionTitle>{t("splitTitle2")}</SectionTitle>
        <Card className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-base font-semibold">{t("splitRent")}</p>
            <Stepper
              label={t("splitRent")}
              value={rider.split.rentShareBp}
              step={1000}
              min={3000}
              max={9000}
              format={(v) => `${v / 100}%`}
              onChange={(v) => save(updateSettings(state, { split: { rentShareBp: v } }, at))}
            />
          </div>
          <div>
            <p className="mb-2 text-base font-semibold">{t("splitEmergency")}</p>
            <Stepper
              label={t("splitEmergency")}
              value={rider.split.emergencyShareBp}
              step={1000}
              min={0}
              max={8000}
              format={(v) => `${v / 100}%`}
              onChange={(v) => save(updateSettings(state, { split: { emergencyShareBp: v } }, at))}
            />
          </div>
          <div>
            <p className="mb-2 text-base font-semibold">{t("emergencyTarget")}</p>
            <Stepper
              label={t("emergencyTarget")}
              value={rider.split.emergencyTargetPaise}
              step={50000}
              min={50000}
              max={2000000}
              format={rupees}
              onChange={(v) => save(updateSettings(state, { split: { emergencyTargetPaise: v } }, at))}
            />
          </div>
          <p className="text-sm text-ink-2">{t("splitHelp")}</p>
        </Card>

        <SectionTitle>{t("language")}</SectionTitle>
        <Segmented<Lang>
          label={t("language")}
          value={rider.language === "kn" ? "hi" : rider.language}
          onChange={(v) => save(updateSettings(state, { language: v }, at))}
          options={[
            { value: "en", label: "English" },
            { value: "hi", label: "हिंदी" },
            { value: "kn", label: `ಕನ್ನಡ · ${t("langComing")}`, disabled: true },
          ]}
        />

        <SectionTitle>{t("consentTitle")}</SectionTitle>
        <Card className="divide-y divide-line px-4">
          <Toggle checked label={t("consentApp")} sub={t("consentAppSub")} disabled onChange={() => {}} />
          <div className="py-1">
            <Toggle
              checked={hasConsent(state, "operator_share")}
              disabled={!state.operator}
              label={t("consentShare")}
              sub={t("consentShareSub")}
              onChange={(v) => save(setConsent(state, "operator_share", v, now()))}
            />
            <p className="pb-3 text-sm font-semibold text-brand-pressed">{t("consentShareOff")}</p>
          </div>
          {notif !== "unsupported" && (
            <Toggle
              checked={notif === "granted"}
              disabled={notif === "denied"}
              label={t("notifTitle")}
              sub={notif === "denied" ? t("notifBlocked") : t("notifSub")}
              onChange={askNotif}
            />
          )}
        </Card>

        {rentAgreement && (
          <>
            <SectionTitle>{t("rentTitle")}</SectionTitle>
            <Card className="space-y-4 p-4">
              <div>
                <p className="mb-2 text-base font-semibold">{t("rentAmount")}</p>
                <Stepper
                  label={t("rentAmount")}
                  value={rentAgreement.amountPaise}
                  step={5000}
                  min={5000}
                  max={1000000}
                  format={rupees}
                  onChange={(v) => save(updateRentAgreement(state, { amountPaise: v, cadence: rentAgreement.cadence, dueWeekday: rentAgreement.dueWeekday }, at))}
                />
              </div>
              <div>
                <p className="mb-2 text-base font-semibold">{t("rentCadence")}</p>
                <Segmented<"daily" | "weekly">
                  label={t("rentCadence")}
                  value={rentAgreement.cadence}
                  onChange={(v) => save(updateRentAgreement(state, { amountPaise: rentAgreement.amountPaise, cadence: v, dueWeekday: rentAgreement.dueWeekday ?? 1 }, at))}
                  options={[
                    { value: "daily", label: t("daily") },
                    { value: "weekly", label: t("weekly") },
                  ]}
                />
              </div>
              {rentAgreement.cadence === "weekly" && (
                <div>
                  <p className="mb-2 text-base font-semibold">{t("dueDay")}</p>
                  <div className="grid grid-cols-7 gap-1">
                    {weekdayNames(lang).map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={rentAgreement.dueWeekday === i}
                        onClick={() => save(updateRentAgreement(state, { amountPaise: rentAgreement.amountPaise, cadence: "weekly", dueWeekday: i }, at))}
                        className={`press min-h-12 rounded-lg text-sm font-semibold ${rentAgreement.dueWeekday === i ? "bg-brand text-white" : "bg-surface"}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-sm text-ink-2">
                {t("payee")}: <span className="font-semibold text-ink">{rentAgreement.payeeName}</span> · {rentAgreement.payeeVpa}
              </p>
            </Card>
          </>
        )}

        <SectionTitle>{t("importTitle")}</SectionTitle>
        <Card className="p-4">
          <label className="press flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line text-base font-semibold">
            CSV…
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onCsv(e.target.files?.[0])} />
          </label>
          <p className="mt-2 text-sm text-ink-2">{t("importHelp")}</p>
        </Card>

        <SectionTitle>{state.operator?.name ?? "—"}</SectionTitle>
        <Card className="space-y-3 p-4">
          <p className="text-base">
            {t("cohort")}: <span className="font-semibold">{rider.cohort === "pilot" ? t("cohortPilot") : t("cohortControl")}</span>
          </p>
          <p className="text-base font-semibold text-brand-pressed">{t("noFees")}</p>
          {state.mode === "demo" ? (
            <Button full variant="secondary" onClick={() => router.push("/onboarding")}>
              {t("startFresh")}
            </Button>
          ) : null}
          <Button full variant="secondary" onClick={() => { reset(null); router.push("/"); }}>
            {t("resetDemo")}
          </Button>
          <Button
            full
            variant="ghost"
            className="text-alert"
            onClick={() => {
              if (window.confirm(t("deleteConfirm"))) {
                clearRider();
                reset(null);
                router.push("/");
              }
            }}
          >
            {t("deleteData")}
          </Button>
          <Link href="/operator" className="press flex min-h-12 items-center justify-center rounded-xl text-base font-semibold text-info underline">
            {t("operatorLink")}
          </Link>
        </Card>
      </div>
    </div>
  );
}
