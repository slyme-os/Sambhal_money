"use client";

// Home answers three questions in order: how much is safe to spend today (the hero),
// how much came in and went to pots (two plain stats), and where it went (Today).

import { useState } from "react";
import { ArrowDownLeft, ChevronRight, Landmark, MessageSquareText, PiggyBank, ReceiptText, Sparkles } from "lucide-react";
import { earnedToday, movedToday, safeToSpend, setAsideToday, spendsByCategory, spentToday, todayActivity } from "@/lib/ledger";
import { timeLabel } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { useSambhal } from "@/lib/store";
import { BigNumber, CAT_ICONS, EmptyState, Money, MoneyCard, Progress, SecondaryButton, SectionTitle, TextButton, TransactionRow, TrustBadge } from "../ds";
import { ComingTag, smsTotals } from "../sheets/SmsSheet";
import { rowFor } from "../rows";

const PREVIEW_ROWS = 4;

export function Home({ onOpenEntry, onOpenSms }: { onOpenEntry: (id: string) => void; onOpenSms: () => void }) {
  const { state, t } = useSambhal();
  const spends = spendsByCategory(state);
  const [showAll, setShowAll] = useState(false);
  const earned = earnedToday(state);
  const setAside = setAsideToday(state);
  const safe = safeToSpend(state);
  const moved = movedToday(state);
  const activity = todayActivity(state);
  const visible = showAll ? activity : activity.slice(0, PREVIEW_ROWS);
  const over = safe < 0;

  return (
    <div className="screen-in space-y-4 px-4 pt-2">
      <MoneyCard tone={over ? "luxAlert" : "lux"} label={t("home.safe")} className="pb-6 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-on-dark-2">{t("home.safe")}</p>
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${over ? "bg-coral" : "bg-slime"}`} />
        </div>
        <div className="mt-3">
          <BigNumber paise={over ? -safe : safe} sign={over ? "-" : undefined} tone={over ? "coral" : earned === 0 ? "white" : "lime"} />
        </div>
        {earned === 0 ? (
          <p className="mt-4 text-sm text-on-dark-2">{t("home.notYet", { total: formatINR(state.essentialsPaise) })}</p>
        ) : over ? (
          <div className="mt-4">
            <p className="text-base font-bold text-coral">{t("home.over", { amount: formatINR(-safe) })}</p>
            <p className="text-sm text-on-dark-2">{t("home.overHint")}</p>
          </div>
        ) : (
          <div className="mt-5">
            <Progress value={setAside ? safe / setAside : 0} tone="amberDark" label={t("home.safe")} />
            <p className="mt-2 text-sm font-semibold text-amber-300">{t("home.safeOf", { total: formatINR(setAside) })}</p>
          </div>
        )}
      </MoneyCard>

      <dl className="grid grid-cols-2 gap-3">
        <Stat icon={<ArrowDownLeft size={18} strokeWidth={2.4} aria-hidden />} label={t("home.earned")} paise={earned} />
        <Stat icon={<PiggyBank size={18} strokeWidth={2.2} aria-hidden />} label={t("home.moved")} paise={moved} />
      </dl>

      {spends.length > 0 && (
        <section aria-label={t("home.spentToday")} className="rounded-[var(--radius-card)] bg-card p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-bold text-ink">{t("home.spentToday")}</h2>
            <Money paise={spentToday(state)} className="text-xl font-extrabold text-ink" />
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {spends.map(({ category, paise }) => {
              const Icon = CAT_ICONS[category];
              return (
                <li key={category} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-amber-50 px-3 text-sm font-semibold text-amber-700">
                  <Icon size={16} aria-hidden />
                  {t(`cat.${category}`)} <Money paise={paise} className="text-ink" />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <SmsCard onOpen={onOpenSms} />

      <TrustBadge icon={Landmark}>{t("trust.bank")}</TrustBadge>

      <section aria-label={t("home.today")}>
        <SectionTitle
          action={
            activity.length > PREVIEW_ROWS && !showAll ? (
              <TextButton onClick={() => setShowAll(true)}>{t("home.seeAll")}</TextButton>
            ) : undefined
          }
        >
          {t("home.today")}
        </SectionTitle>
        {activity.length === 0 ? (
          <EmptyState icon={ReceiptText} title={t("home.emptyTitle")} body={t("home.emptyBody")} />
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] bg-card px-4 shadow-card">
            {visible.map((e) => (
              <li key={e.id}>
                <TransactionRow {...rowFor(e, state, t)} onClick={() => onOpenEntry(e.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** SMS auto-capture on Home: an invitation when off, a banner when something was found. */
function SmsCard({ onOpen }: { onOpen: () => void }) {
  const { state, t, lang, smsMode } = useSambhal();
  const { enabled, pending, lastScanAt } = state.sms;
  const web = smsMode === "web";
  if (!enabled) {
    return (
      <section aria-label={t("sms.cardTitle")} className="rounded-[var(--radius-card)] bg-card p-4 shadow-card">
        <div className="flex items-start gap-3">
          <span aria-hidden className="lime-tile text-night grid h-11 w-11 shrink-0 place-items-center rounded-xl">
            <MessageSquareText size={22} />
          </span>
          <div>
            <h2 className="text-base font-bold text-ink">{t("sms.cardTitle")}</h2>
            {web && (
              <div className="mt-1">
                <ComingTag />
              </div>
            )}
            <p className="mt-1 text-sm text-muted">{web ? t("sms.webOnly") : smsMode === "share" ? t("sms.cardBodyShare") : t("sms.cardBody")}</p>
          </div>
        </div>
        <SecondaryButton icon={web ? Sparkles : MessageSquareText} className="mt-3" onClick={onOpen}>
          {web ? t("sms.trySample") : t("sms.turnOn")}
        </SecondaryButton>
      </section>
    );
  }
  if (pending.length > 0) {
    const totals = smsTotals(pending);
    return (
      <button type="button" onClick={onOpen} className="press lime-tile btn-glow text-night flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-card)] p-4 text-left">
        <span aria-hidden className="chrome-dark grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lime">
          <MessageSquareText size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold">{t("sms.found", { n: pending.length })}</span>
          <span className="money block text-sm font-semibold">{t("sms.foundSub", totals)}</span>
        </span>
        <ChevronRight size={22} aria-hidden />
      </button>
    );
  }
  if (web) {
    return (
      <button type="button" onClick={onOpen} className="press flex min-h-12 w-full items-center gap-2 rounded-2xl px-1 text-left text-sm font-semibold text-green-700">
        <Sparkles size={16} aria-hidden />
        {t("sms.trySample")}
        <ComingTag />
      </button>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="press flex min-h-12 w-full items-center gap-2 rounded-2xl px-1 text-left text-sm font-semibold text-green-700">
      <span aria-hidden className="h-2 w-2 rounded-full bg-green-600" />
      {t("sms.statusOn")}
      {lastScanAt > 0 && <span className="font-medium text-muted">· {t("sms.lastCheck", { time: timeLabel(lastScanAt, lang) })}</span>}
    </button>
  );
}

function Stat({ icon, label, paise }: { icon: React.ReactNode; label: string; paise: number }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-card">
      <dt className="flex items-start gap-2 text-sm font-medium leading-snug text-ink-2">
        <span className="lime-tile text-night grid h-7 w-7 shrink-0 place-items-center rounded-lg">{icon}</span>
        <span className="pt-0.5">{label}</span>
      </dt>
      <dd className="mt-2">
        <Money paise={paise} className="text-[26px] font-extrabold text-ink" />
      </dd>
    </div>
  );
}
