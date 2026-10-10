"use client";

// The credit screen. It shows eligibility only, names the partner NBFC as the lender,
// and has no apply, disburse or repay action. The comparison is illustrative.

import { CREDIT } from "@/lib/config";
import { formatINR } from "@/lib/money";
import { useSambhal } from "@/lib/store";
import { Bi, Ring } from "./ui";

export function Loan() {
  const { state } = useSambhal();
  const totalSaved = state.pots.bike + state.pots.emergency + state.pots.savings;
  const pct = CREDIT.streakDays / CREDIT.streakGoal;

  return (
    <div className="screen-in space-y-5 px-5 pb-8 pt-5">
      <Bi hi="लोन" en="Loan eligibility" />

      <section className="flex flex-col items-center rounded-3xl border border-line bg-paper p-6 text-center shadow-card">
        <Ring value={pct}>
          <div>
            <p className="num text-4xl font-extrabold">
              {CREDIT.streakDays}
              <span className="text-xl text-muted">/{CREDIT.streakGoal}</span>
            </p>
            <p className="text-sm font-semibold">दिन लगातार बचत</p>
            <p className="text-xs text-muted">days saved in a row</p>
          </div>
        </Ring>
        <p className="mt-4 text-sm text-muted">
          {CREDIT.streakGoal - CREDIT.streakDays} दिन और · {CREDIT.streakGoal - CREDIT.streakDays} more days to 90
        </p>
      </section>

      <section aria-label="Underwriting inputs" className="grid grid-cols-3 gap-2">
        <Metric hi="कुल बचत" en="Total saved" value={formatINR(totalSaved)} />
        <Metric hi="औसत कमाई" en="Avg / day" value={formatINR(CREDIT.avgDailyEarnPaise)} />
        <Metric hi="काम के दिन" en="Days worked" value={String(CREDIT.daysWorked)} />
      </section>
      <p className="-mt-3 text-center text-xs text-muted">ये आँकड़े पात्रता देखने के लिए हैं · These figures are used to check eligibility</p>

      <section className="rounded-3xl bg-amber-tint p-6 shadow-card" aria-label="Eligibility">
        <p className="text-sm font-semibold text-ink">पात्रता</p>
        <p className="mt-1 text-3xl font-extrabold leading-tight">
          {formatINR(CREDIT.eligiblePaise)} तक लोन मिल सकता है
        </p>
        <p className="mt-2 text-sm text-muted">Eligible up to {formatINR(CREDIT.eligiblePaise)} · eligibility, not an offer</p>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5" aria-label="Lender">
        <p className="font-semibold">लोन पार्टनर NBFC देगा। Sambhal पैसा नहीं देता।</p>
        <p className="mt-1 text-sm text-muted">The loan comes from a partner NBFC. Sambhal does not lend.</p>
      </section>

      <section className="rounded-2xl border border-line bg-paper p-5" aria-label="Illustrative comparison">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">उदाहरण · Illustrative only</p>
        <div className="mt-3 space-y-3">
          <Compare tone="alert" hi={`बाहर से उधार: ${formatINR(CREDIT.borrowMonthlyPaise)}/महीना ब्याज.`} en={`Borrowing outside: ${formatINR(CREDIT.borrowMonthlyPaise)}/month interest`} />
          <Compare tone="green" hi={`Sambhal के ज़रिए: ${formatINR(CREDIT.sambhalMonthlyPaise)}/महीना.`} en={`Through Sambhal: ${formatINR(CREDIT.sambhalMonthlyPaise)}/month`} />
        </div>
      </section>
    </div>
  );
}

function Metric({ hi, en, value }: { hi: string; en: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-3 text-center shadow-card">
      <p className="num text-lg font-extrabold">{value}</p>
      <p className="text-xs font-semibold leading-tight">{hi}</p>
      <p className="text-[10px] leading-tight text-muted">{en}</p>
    </div>
  );
}

function Compare({ tone, hi, en }: { tone: "alert" | "green"; hi: string; en: string }) {
  const cls = tone === "alert" ? "bg-alert-tint text-alert" : "bg-green-tint text-green";
  return (
    <div className={`rounded-2xl p-4 ${cls}`}>
      <p className="font-bold leading-snug">{hi}</p>
      <p className="mt-0.5 text-xs opacity-80">{en}</p>
    </div>
  );
}
