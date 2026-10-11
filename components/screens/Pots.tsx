"use client";

// Pots: total, one card per pot ("₹1,750 of ₹2,500 · ~2 weeks at this rate"), the
// 30-day chart, and today's payments. Tapping a pot opens its detail.

import { ArrowLeft, ArrowUpFromLine, Pencil, Plus, ReceiptText } from "lucide-react";
import {
  chartDays, etaDays, movedToday, potBalance, shares, todayActivity, totalInPots, type State,
} from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { useSambhal } from "@/lib/store";
import {
  BigNumber, EmptyState, MoneyCard, PotCard, PotGlyph, Progress, SecondaryButton, SectionTitle, TextButton,
  TransactionRow, etaText, potName,
} from "../ds";
import { rowFor, sourceLabel } from "../rows";

export function Pots({ onOpenPot, onNewPot, onOpenEntry }: { onOpenPot: (id: string) => void; onNewPot: () => void; onOpenEntry: (id: string) => void }) {
  const { state, t } = useSambhal();
  const payments = todayActivity(state).filter((e) => e.kind === "payout");
  const today = movedToday(state);

  return (
    <div className="screen-in space-y-4 px-4 pt-2">
      <MoneyCard tone="lux" label={t("pots.total")} className="pt-6">
        <p className="text-base font-semibold text-on-dark-2">{t("pots.total")}</p>
        <div className="mt-3">
          <BigNumber paise={totalInPots(state)} size="hero" tone="lime" />
        </div>
        {today > 0 && (
          <p className="money mt-3 inline-flex items-center gap-1.5 rounded-full bg-forest-800 px-3 py-1 text-sm font-bold text-slime">
            {t("pots.todayPlus", { amount: formatINR(today) })}
          </p>
        )}
      </MoneyCard>

      <section aria-label={t("pots.title")} className="space-y-3">
        <SectionTitle action={<TextButton icon={Plus} onClick={onNewPot}>{t("pots.new")}</TextButton>}>{t("pots.title")}</SectionTitle>
        {state.pots.map((p) => (
          <PotCard key={p.id} pot={p} balance={potBalance(state, p.id)} eta={etaDays(state, p)} todayPaise={movedToday(state, p.id)} onOpen={() => onOpenPot(p.id)} />
        ))}
      </section>

      <Chart state={state} />

      <section aria-label={t("pots.activity")}>
        <SectionTitle>{t("pots.activity")}</SectionTitle>
        {payments.length === 0 ? (
          <EmptyState icon={ReceiptText} title={t("home.emptyTitle")} body={t("home.emptyBody")} />
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] bg-card px-4 shadow-card">
            {payments.map((e) => (
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

function Chart({ state }: { state: State }) {
  const { t } = useSambhal();
  const days = chartDays(state);
  const max = Math.max(1, ...days.map((d) => d.movedPaise));
  return (
    <section aria-label={t("pots.chart")} className="lux-card rounded-[var(--radius-card)] p-4">
      <h2 className="text-base font-bold text-on-dark">{t("pots.chart")}</h2>
      <div className="mt-4 flex h-28 items-end gap-[3px]" role="img" aria-label={t("pots.chartLabel", { amount: formatINR(days.at(-1)?.movedPaise ?? 0) })}>
        {days.map((d, i) => (
          <div
            key={`${d.label}-${i}`}
            className={`flex-1 rounded-t-[3px] ${d.today ? "bg-lime" : d.movedPaise ? "bg-slime" : "bg-track-dark"}`}
            style={{ height: `${Math.max(4, (d.movedPaise / max) * 100)}%` }}
            title={`${d.label}: ${formatINR(d.movedPaise)}`}
          />
        ))}
      </div>
      <p className="mt-3 flex gap-4 text-sm text-on-dark-2">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-slime" />{t("pots.chartPast")}</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-lime" />{t("pots.chartToday")}</span>
      </p>
    </section>
  );
}

export function PotDetail({ potId, onBack, onEdit, onWithdraw, onOpenEntry }: {
  potId: string; onBack: () => void; onEdit: () => void; onWithdraw: () => void; onOpenEntry: (id: string) => void;
}) {
  const { state, t } = useSambhal();
  const pot = state.pots.find((p) => p.id === potId)!;
  const name = potName(pot, t);
  const balance = potBalance(state, pot.id);
  const left = Math.max(0, pot.goalPaise - balance);
  const share = shares(state.pots)[pot.id] ?? 0;
  const isFirst = state.pots[0]?.id === pot.id;
  const added = todayActivity(state).filter((e) => (e.kind === "payout" && (e.alloc[pot.id] ?? 0) > 0) || (e.kind === "withdraw" && e.potId === pot.id));

  return (
    <div className="screen-in space-y-4 px-4 pt-1">
      <div className="flex items-center gap-1">
        <TextButton icon={ArrowLeft} tone="muted" onClick={onBack} className="-ml-2">{t("action.back")}</TextButton>
        <span className="flex-1" />
        <TextButton icon={Pencil} onClick={onEdit}>{t("pot.edit")}</TextButton>
      </div>

      <MoneyCard tone="lux" label={name} className="pt-6">
        <div className="flex items-center gap-3">
          <PotGlyph icon={pot.icon} size="lg" />
          <h1 className="text-xl font-bold text-on-dark">{name}</h1>
        </div>
        <p className="mt-5 text-sm font-medium text-on-dark-2">{t("pot.balance")}</p>
        <BigNumber paise={balance} size="hero" tone="lime" />
        <p className="mt-2 text-base text-on-dark-2">
          {left === 0 ? t("pots.goalOf", { goal: formatINR(pot.goalPaise) }) : t("pots.of", { balance: formatINR(balance), goal: formatINR(pot.goalPaise) })}
        </p>
        <div className="mt-4">
          <Progress value={balance / pot.goalPaise} tone="dark" label={name} />
        </div>
        <p className="mt-2 text-sm font-semibold text-on-dark">
          {left === 0 ? `${t("pots.reached")} ✓` : `${t("pots.toGo", { amount: formatINR(left) })} · ${etaText(etaDays(state, pot), t)}`}
        </p>
        <p className="mt-4 rounded-xl bg-forest-800 px-3 py-2 text-sm text-on-dark-2">
          {isFirst ? t("pot.shareRest", { pct: share }) : t("pot.share", { pct: share })} · {t("pot.shareExample", { n: share })}
        </p>
      </MoneyCard>

      <SecondaryButton icon={ArrowUpFromLine} onClick={onWithdraw} disabled={balance <= 0}>
        {t("pot.withdraw")}
      </SecondaryButton>

      <section aria-label={t("pot.addedToday")}>
        <SectionTitle>{t("pot.addedToday")}</SectionTitle>
        {added.length === 0 ? (
          <p className="rounded-[var(--radius-card)] bg-card p-4 text-sm text-muted shadow-card">{t("pot.nothingToday")}</p>
        ) : (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] bg-card px-4 shadow-card">
            {added.map((e) =>
              e.kind === "payout" ? (
                <li key={e.id}>
                  <TransactionRow kind="in" title={t("row.payment", { source: sourceLabel(e.source, t) })} sub={t("row.toPots", { amount: formatINR(e.alloc[pot.id]) })} paise={e.alloc[pot.id]} onClick={() => onOpenEntry(e.id)} />
                </li>
              ) : (
                <li key={e.id}>
                  <TransactionRow {...rowFor(e, state, t)} onClick={() => onOpenEntry(e.id)} />
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
