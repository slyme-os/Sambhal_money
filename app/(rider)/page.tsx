"use client";

// S1 — Home. The hero answers the one question a rider has at 2pm with ₹600 in his
// account: "how much can I spend today?" Everything else is one tap away.

import Link from "next/link";
import { ChevronRight, ShieldAlert, Wallet } from "lucide-react";
import { RentNudge, useRentPayment } from "@/components/RentNudge";
import { useRider } from "@/components/StoreProvider";
import { BodyPortal, Button, Card, Money, ProgressBar, Skeleton } from "@/components/ui";
import { PLATFORMS } from "@/lib/config";
import { formatWhen, istDate } from "@/lib/day";
import { formatINR } from "@/lib/money";
import { daysUntil, isPaid } from "@/lib/rent";
import { balancesOf, openNudge, todayOf, unpaidRent } from "@/lib/store/state";
import type { StringKey } from "@/lib/strings";

export default function HomePage() {
  const { state, t, now, commit } = useRider();
  const pay = useRentPayment();
  if (!state) return <HomeSkeleton />;

  const at = now();
  const today = todayOf(state, at);
  const pots = balancesOf(state);
  const nudge = openNudge(state, at);
  const unpaid = unpaidRent(state, at);
  const agreement = state.rentAgreement;
  const rentTarget = agreement?.amountPaise ?? 0;
  const floor = state.rider.floorPaise;
  const floorPct = floor > 0 ? Math.min(1, today.earnedPaise / floor) : 1;
  const days = unpaid ? daysUntil(istDate(at), unpaid.dueOn) : null;
  const lastPaid = state.rentEvents.filter((e) => isPaid(e.riderReport) || isPaid(e.operatorReport)).at(-1);
  const recent = [...state.payouts].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)).slice(0, 6);
  const sweptBy = new Map<string, number>();
  for (const a of state.allocations) sweptBy.set(a.payoutId, (sweptBy.get(a.payoutId) ?? 0) + a.amountPaise);
  const canPayNow = state.rider.cohort === "pilot" && unpaid && pots.rent >= unpaid.amountPaise && !nudge && !state.pendingRent;

  let dueText: string = t("noRent");
  let dueTone = "bg-surface text-ink-2";
  if (agreement) {
    if (!unpaid) dueText = lastPaid ? t("rentPaidThisCycle") : t("rentDueIn", { n: daysUntil(istDate(at), agreement.nextDueOn) });
    else if (days! < 0) [dueText, dueTone] = [t("rentOverdue", { n: -days! }), "bg-alert text-white"];
    else if (days === 0) [dueText, dueTone] = [t("rentDueToday"), "bg-alert text-white"];
    else [dueText, dueTone] = [t("rentDueIn", { n: days! }), days! <= 3 ? "bg-amber text-ink" : "bg-surface text-ink-2"];
    if (!unpaid) dueTone = "bg-brand-tint text-brand-pressed";
  }

  return (
    <div className="px-4 pb-40 lg:px-0 lg:pb-0">
      <header className="flex h-16 items-center gap-2 lg:mb-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-extrabold tracking-tight lg:text-3xl">{t("greeting", { name: state.rider.name.split(" ")[0] })}</p>
        </div>
        {state.mode === "demo" && (
          <span className="rounded-full bg-info-tint px-3 py-1 text-sm font-semibold text-info lg:hidden">{t("demoBadge")}</span>
        )}
        <button
          type="button"
          onClick={() =>
            commit({ ...state, rider: { ...state.rider, language: state.rider.language === "en" ? "hi" : "en" } })
          }
          className="press flex h-12 min-w-12 items-center justify-center rounded-full border-2 border-line px-3 text-base font-semibold lg:hidden"
          aria-label={`${state.rider.language === "en" ? "हिंदी" : "EN"} — Change language / भाषा बदलो`}
        >
          {state.rider.language === "en" ? "हिंदी" : "EN"}
        </button>
      </header>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div>
      {/* Hero: safe to spend */}
      <section className="rounded-3xl bg-brand p-5 text-white shadow-raised" aria-labelledby="hero-label">
        <p id="hero-label" className="text-base font-semibold text-white">
          {t("safeToSpend")}
        </p>
        <p className="num mt-1 text-5xl font-extrabold tracking-tight lg:text-6xl">{formatINR(today.safeToSpendPaise)}</p>
        <ProgressBar value={floorPct} tone="white" label={t("floorProgress", { floor: formatINR(floor).slice(1), pct: Math.round(floorPct * 100) })} className="mt-4" />
        <p className="mt-2 text-sm font-semibold text-white">
          {floorPct >= 1 ? t("floorDone") : t("floorProgress", { floor: formatINR(floor).slice(1), pct: Math.round(floorPct * 100) })}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-black/15 p-3">
          {[
            [t("earnedToday"), today.earnedPaise],
            [t("floorHeld"), today.floorHeldPaise],
            [t("swept"), today.sweptPaise],
          ].map(([label, paise]) => (
            <div key={label as string}>
              <dt className="text-sm text-white">{label}</dt>
              <dd className="num text-lg font-extrabold">{formatINR(paise as number)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {nudge && (
        <div className="mt-4">
          <RentNudge nudge={nudge} />
        </div>
      )}

      {/* Desktop only: recent payments fill the column under the hero. */}
      <section className="mt-6 hidden lg:block" aria-labelledby="recent-title">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 id="recent-title" className="text-lg font-extrabold">{t("recentPayments")}</h2>
            <Link href="/hisab" className="text-sm font-semibold text-brand-pressed underline">
              {t("history")}
            </Link>
          </div>
          <ul className="mt-2">
            {recent.length === 0 && <li className="py-3 text-ink-2">{t("noPayments")}</li>}
            {recent.map((p) => {
              const platform = PLATFORMS.find((x) => x.value === p.source);
              const label = platform?.label.startsWith("source") ? t(platform.label as StringKey) : platform?.label ?? p.source;
              const toPots = sweptBy.get(p.id) ?? 0;
              return (
                <li key={p.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: platform?.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-sm text-ink-2">{formatWhen(p.occurredAt, state.rider.language)}</span>
                  </span>
                  <span className="text-right">
                    <span className="num block font-extrabold">{formatINR(p.amountPaise)}</span>
                    {toPots > 0 && <span className="num block text-sm text-brand-pressed">{t("toPots", { x: formatINR(toPots).slice(1) })}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
      </div>
      <div>
      {/* Pots */}
      <section className="mt-5 space-y-3 lg:mt-0" aria-label={t("navPots")}>
        <Link href="/pots" className="press block">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-tint text-2xl">🏍️</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold">{t("potRent")}</h2>
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${dueTone}`}>{dueText}</span>
                </div>
                <p className="num mt-1 text-2xl font-extrabold">
                  {formatINR(pots.rent)}
                  {rentTarget > 0 && <span className="text-base font-semibold text-ink-2"> / {formatINR(rentTarget)}</span>}
                </p>
              </div>
            </div>
            {rentTarget > 0 && (
              <>
                <ProgressBar value={pots.rent / rentTarget} tone="amber" label={t("potRent")} className="mt-3" />
                <p className="mt-2 text-sm font-semibold text-ink-2">
                  {pots.rent >= rentTarget ? t("rentReady") : t("rentNeedMore", { x: formatINR(rentTarget - pots.rent).slice(1) })}
                </p>
              </>
            )}
          </Card>
        </Link>
        {canPayNow && (
          <Button full size="lg" variant="amber" onClick={() => pay(unpaid!.id, null)}>
            {t("payRentNow")} · <Money paise={unpaid!.amountPaise} />
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["emergency", "🛟", t("potEmergency"), state.rider.split.emergencyTargetPaise],
              ["savings", "🪙", t("potSavings"), null],
            ] as const
          ).map(([kind, icon, label, target]) => (
            <Link key={kind} href="/pots" className="press block">
              <Card className="h-full p-4">
                <span aria-hidden className="text-2xl">{icon}</span>
                <h2 className="mt-1 text-base font-extrabold">{label}</h2>
                <p className="num text-xl font-extrabold">{formatINR(pots[kind])}</p>
                {target ? (
                  <>
                    <ProgressBar value={pots[kind] / target} tone="brand" label={label} className="mt-2" />
                    <p className="mt-1 text-sm text-ink-2">{t("ofTarget", { target: formatINR(target).slice(1) })}</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-ink-2">{t("potSavingsFor")}</p>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <Link
        href="/shock"
        className="press mt-4 flex min-h-16 items-center gap-3 rounded-2xl border-2 border-alert/30 bg-alert-tint px-4 py-3"
      >
        <ShieldAlert size={28} className="shrink-0 text-alert" aria-hidden />
        <span className="flex-1">
          <span className="block text-base font-extrabold">{t("shockPrompt")}</span>
          <span className="block text-sm text-ink-2">{t("shockPromptSub")}</span>
        </span>
        <ChevronRight size={22} aria-hidden />
      </Link>

      <p className="mt-5 flex items-start gap-2 text-sm text-ink-2">
        <Wallet size={18} className="mt-0.5 shrink-0" aria-hidden />
        {t("ledgerNote")}
      </p>
      </div>
      </div>

      {/* Thumb-zone actions */}
      <BodyPortal>
      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-[480px] border-t border-line bg-paper/95 px-4 py-3 backdrop-blur pb-safe lg:hidden">
        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <Link href="/payout" className="press flex min-h-14 items-center justify-center rounded-xl bg-brand text-lg font-extrabold text-white shadow-card">
            + {t("logPayout")}
          </Link>
          <Link href="/spend" className="press flex min-h-14 items-center justify-center rounded-xl border-2 border-line bg-paper text-lg font-semibold">
            − {t("logSpend")}
          </Link>
        </div>
      </div>
      </BodyPortal>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="px-4 pb-40" aria-busy="true">
      <div className="flex h-16 items-center">
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="h-[266px]" />
      <Skeleton className="mt-5 h-[150px]" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Skeleton className="h-[150px]" />
        <Skeleton className="h-[150px]" />
      </div>
    </div>
  );
}
