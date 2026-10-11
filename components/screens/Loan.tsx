"use client";

// Emergency boost: eligibility only. It shows how savings build eligibility, names the
// partner NBFC as the lender, and has no apply, disburse or repay action anywhere.
// Eligibility = Savings pot × 3.5 (nearest ₹500, max ₹15,000), see eligibilityPaise().
// The outside-lender comparison renders only when SOURCED_COMPARISON holds sourced figures.

import { Building2, CalendarCheck, PiggyBank, ShieldCheck } from "lucide-react";
import { DEMO_CREDIT as CREDIT, SOURCED_COMPARISON, eligibilityPaise } from "@/lib/config";
import { potBalance } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { useSambhal } from "@/lib/store";
import { Money, MoneyCard, Ring, SectionTitle } from "../ds";

export function Loan() {
  const { state, t } = useSambhal();
  const savings = potBalance(state, "savings");
  const eligible = eligibilityPaise(savings);
  const daysLeft = CREDIT.streakGoal - CREDIT.streakDays;

  return (
    <div className="screen-in space-y-4 px-4 pt-2">
      <section className="space-y-1" aria-label={t("loan.kicker")}>
        <p className="text-sm font-bold uppercase tracking-wide text-green-700">{t("loan.kicker")}</p>
        <h1 className="text-[28px] font-extrabold leading-tight text-ink">{t("loan.title")}</h1>
        <p className="text-base text-ink-2">{t("loan.sub")}</p>
      </section>

      <MoneyCard tone="lux" className="flex flex-col items-center pt-6 text-center" label={t("loan.streak")}>
        <Ring value={CREDIT.streakDays / CREDIT.streakGoal}>
          <div>
            <p className="money money-hero text-[48px] font-extrabold text-lime" translate="no">
              {CREDIT.streakDays}
              <span className="text-xl font-bold text-on-dark-3">/{CREDIT.streakGoal}</span>
            </p>
            <p className="mx-auto mt-1 max-w-[104px] text-sm font-semibold leading-tight text-on-dark-2">{t("loan.streak")}</p>
          </div>
        </Ring>
        <p className="mt-4 rounded-full bg-forest-800 px-4 py-1.5 text-sm font-semibold text-slime">{t("loan.streakLeft", { n: daysLeft, goal: CREDIT.streakGoal })}</p>
      </MoneyCard>

      <dl className="grid grid-cols-3 gap-2">
        <Metric label={t("pot.savings")} value={<Money paise={savings} />} />
        <Metric label={t("loan.avg")} value={<Money paise={CREDIT.avgDailyEarnPaise} />} />
        <Metric label={t("loan.days")} value={<span className="money">{CREDIT.daysWorked}</span>} />
      </dl>
      <p className="text-center text-sm text-muted">{t("loan.figures")}</p>

      <MoneyCard tone="lux" label={t("loan.eligible", { amount: formatINR(eligible) })} className="pt-6">
        <p className="text-2xl font-extrabold leading-snug text-lime">{t("loan.eligible", { amount: formatINR(eligible) })}</p>
        <p className="mt-1 text-sm font-semibold text-on-dark-2">{t("loan.notOffer")}</p>
        <div className="lime-tile text-night mt-5 rounded-2xl p-4">
          <p className="money text-lg font-extrabold">{t("loan.multiplier", { saved: formatINR(savings), amount: formatINR(eligible) })}</p>
          <p className="text-sm font-medium">{t("loan.multiplierSub")}</p>
        </div>
      </MoneyCard>

      <section aria-label={t("loan.how")}>
        <SectionTitle>{t("loan.how")}</SectionTitle>
        <ol className="space-y-2">
          {[
            { Icon: PiggyBank, text: t("loan.how1") },
            { Icon: CalendarCheck, text: t("loan.how2", { goal: CREDIT.streakGoal }) },
            { Icon: Building2, text: t("loan.how3") },
          ].map(({ Icon, text }, i) => (
            <li key={i} className="flex min-h-14 items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-card">
              <span aria-hidden className="chrome-dark text-lime grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                <Icon size={20} />
              </span>
              <span className="text-base font-medium text-ink">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label={t("trust.noLend")} className="flex items-start gap-3 rounded-[var(--radius-card)] border-2 border-night bg-card p-4">
        <ShieldCheck size={24} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
        <p className="text-base font-bold text-ink">{t("loan.lender")}</p>
      </section>

      {SOURCED_COMPARISON && (
        <section className="space-y-2" aria-label="Cost comparison">
          <p className="rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{t("loan.outside", { amount: formatINR(SOURCED_COMPARISON.lenderPerMonthPaise) })}</p>
          <p className="rounded-2xl bg-green-50 p-4 font-semibold text-green-800">{t("loan.through", { amount: formatINR(SOURCED_COMPARISON.sambhalPerMonthPaise) })}</p>
          <p className="text-sm text-muted">{t("loan.source", { source: SOURCED_COMPARISON.source })}</p>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-card">
      <dd className="text-lg font-extrabold text-ink">{value}</dd>
      <dt className="wrap-any mt-0.5 text-xs font-medium leading-snug text-ink-2">{label}</dt>
    </div>
  );
}
