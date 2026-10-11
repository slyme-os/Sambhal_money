"use client";

// Home answers three questions in order: how much is safe to spend today (the hero),
// how much came in and went to pots (two plain stats), and where it went (Today).

import { useState } from "react";
import { ArrowDownLeft, Landmark, PiggyBank, ReceiptText } from "lucide-react";
import { earnedToday, movedToday, safeToSpend, setAsideToday, todayActivity } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { useSambhal } from "@/lib/store";
import { BigNumber, EmptyState, Money, MoneyCard, Progress, SectionTitle, TextButton, TransactionRow, TrustBadge } from "../ds";
import { rowFor } from "../rows";

const PREVIEW_ROWS = 4;

export function Home({ onOpenEntry }: { onOpenEntry: (id: string) => void }) {
  const { state, t } = useSambhal();
  const [showAll, setShowAll] = useState(false);
  const earned = earnedToday(state);
  const setAside = setAsideToday(state);
  const safe = safeToSpend(state);
  const moved = movedToday(state);
  const activity = todayActivity(state);
  const visible = showAll ? activity : activity.slice(0, PREVIEW_ROWS);
  const over = safe < 0;

  return (
    <div className="screen-in space-y-4 px-4 pt-3">
      <MoneyCard tone={over ? "red" : "card"} label={t("home.safe")}>
        <p className="text-base font-semibold text-ink-2">{t("home.safe")}</p>
        <div className="mt-2">
          <BigNumber paise={over ? -safe : safe} sign={over ? "-" : undefined} tone={over ? "red" : earned === 0 ? "ink" : "green"} />
        </div>
        {earned === 0 ? (
          <p className="mt-3 text-sm text-ink-2">{t("home.notYet", { total: formatINR(state.essentialsPaise) })}</p>
        ) : over ? (
          <div className="mt-3">
            <p className="text-base font-bold text-red-700">{t("home.over", { amount: formatINR(-safe) })}</p>
            <p className="text-sm text-red-700">{t("home.overHint")}</p>
          </div>
        ) : (
          <div className="mt-4">
            <Progress value={setAside ? safe / setAside : 0} tone="amber" label={t("home.safe")} />
            <p className="mt-2 text-sm font-medium text-amber-700">{t("home.safeOf", { total: formatINR(setAside) })}</p>
          </div>
        )}
      </MoneyCard>

      <dl className="grid grid-cols-2 gap-3">
        <Stat icon={<ArrowDownLeft size={18} strokeWidth={2.4} aria-hidden />} label={t("home.earned")} paise={earned} />
        <Stat icon={<PiggyBank size={18} strokeWidth={2.2} aria-hidden />} label={t("home.moved")} paise={moved} />
      </dl>

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

function Stat({ icon, label, paise }: { icon: React.ReactNode; label: string; paise: number }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-card">
      <dt className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
        <span className="text-green-700">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1">
        <Money paise={paise} className="text-2xl font-extrabold text-ink" />
      </dd>
    </div>
  );
}
