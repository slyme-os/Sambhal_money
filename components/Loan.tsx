"use client";

// The credit screen. It shows eligibility only, names the partner NBFC as the lender,
// and has no apply, disburse or repay action. The comparison is illustrative.

import { CREDIT } from "@/lib/config";
import { formatINR } from "@/lib/money";
import { useSambhal } from "@/lib/store";
import { Ring } from "./ui";

export function Loan() {
  const { state } = useSambhal();
  const totalSaved = state.pots.bike + state.pots.emergency + state.pots.savings;
  const pct = CREDIT.streakDays / CREDIT.streakGoal;

  return (
    <div className="screen-in space-y-6 px-5 pb-8 pt-4">
      <section className="space-y-2 pt-2" aria-label="What this screen shows">
        <p className="text-sm font-semibold text-green">लोन की पात्रता</p>
        <h1 className="display text-[40px] font-[480]">Your savings, your eligibility.</h1>
        <p className="text-sm text-muted">यह स्क्रीन सिर्फ़ पात्रता दिखाती है। · This screen only shows eligibility.</p>
      </section>

      <section className="flex flex-col items-center rounded-[28px] border border-line p-6 text-center">
        <Ring value={pct}>
          <div>
            <p className="num display text-[44px] font-semibold">
              {CREDIT.streakDays}
              <span className="text-xl text-muted">/{CREDIT.streakGoal}</span>
            </p>
            <p className="mt-1 text-sm font-semibold">दिन लगातार बचत</p>
            <p className="text-xs text-muted">days saved in a row</p>
          </div>
        </Ring>
        <p className="mt-5 text-sm text-muted">
          {CREDIT.streakGoal - CREDIT.streakDays} दिन और · {CREDIT.streakGoal - CREDIT.streakDays} more days to 90
        </p>
      </section>

      <section aria-label="Underwriting inputs" className="grid grid-cols-3 gap-2">
        <Metric hi="कुल बचत" en="Total saved" value={formatINR(totalSaved)} />
        <Metric hi="औसत कमाई" en="Avg / day" value={formatINR(CREDIT.avgDailyEarnPaise)} />
        <Metric hi="काम के दिन" en="Days worked" value={String(CREDIT.daysWorked)} />
      </section>
      <p className="-mt-3 text-center text-xs text-muted">ये आँकड़े पात्रता देखने के लिए हैं · These figures are used to check eligibility</p>

      <section className="rounded-[28px] bg-lime-soft p-6" aria-label="Eligibility">
        <p className="text-sm font-semibold">पात्रता</p>
        <p className="mt-2 text-3xl font-semibold leading-snug">
          {formatINR(CREDIT.eligiblePaise)} तक लोन मिल सकता है
        </p>
        <p className="mt-3 text-sm text-muted">Eligible up to {formatINR(CREDIT.eligiblePaise)} · eligibility, not an offer</p>
      </section>

      <section className="rounded-2xl border border-line p-5" aria-label="Lender">
        <p className="font-semibold">लोन पार्टनर NBFC देगा। Sambhal पैसा नहीं देता।</p>
        <p className="mt-1 text-sm text-muted">The loan comes from a partner NBFC. Sambhal does not lend.</p>
      </section>

      <section className="space-y-3" aria-label="Illustrative comparison">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">उदाहरण · Illustrative only</p>
        <Compare tone="alert" hi={`बाहर से उधार: ${formatINR(CREDIT.borrowMonthlyPaise)}/महीना ब्याज.`} en={`Borrowing outside: ${formatINR(CREDIT.borrowMonthlyPaise)}/month interest`} />
        <Compare tone="green" hi={`Sambhal के ज़रिए: ${formatINR(CREDIT.sambhalMonthlyPaise)}/महीना.`} en={`Through Sambhal: ${formatINR(CREDIT.sambhalMonthlyPaise)}/month`} />
      </section>
    </div>
  );
}

function Metric({ hi, en, value }: { hi: string; en: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line p-3 text-center">
      <p className="num text-base font-semibold">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-tight">{hi}</p>
      <p className="text-xs leading-tight text-muted">{en}</p>
    </div>
  );
}

function Compare({ tone, hi, en }: { tone: "alert" | "green"; hi: string; en: string }) {
  const cls = tone === "alert" ? "bg-alert-tint text-alert" : "bg-mint text-green";
  return (
    <div className={`rounded-2xl p-4 ${cls}`}>
      <p className="font-semibold leading-snug">{hi}</p>
      <p className="mt-0.5 text-xs opacity-80">{en}</p>
    </div>
  );
}
