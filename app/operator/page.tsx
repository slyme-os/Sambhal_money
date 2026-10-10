"use client";

// §7 Operator dashboard — desktop-first. The headline is the one chart that sells
// the next contract: on-time rent, pilot vs control. The rider list shows name,
// phone, on-time streak and last rent status — nothing else (HR-7). Everything
// below passes through toOperatorInput(), whose type carries no money fields; in
// production the same boundary is enforced by RLS (supabase/migrations).

import { Check, Download, FileUp, LogOut, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CohortBars } from "@/components/charts";
import { parsePayoutCsv, parseRentAgreementCsv, downloadText } from "@/lib/csv";
import { istDate } from "@/lib/day";
import { buildOperatorView, comparisonCsv, toOperatorInput, type CohortRate, type OperatorRiderInput, type OperatorRow } from "@/lib/operator";
import { effectiveRentStatus, paidStatusFor } from "@/lib/rent";
import { DEMO_OPERATOR, generateFleet } from "@/lib/seed";
import { loadOperatorReports, loadRider, saveOperatorReports, saveRider, type OperatorReports } from "@/lib/store/persist";
import { importPayouts, updateRentAgreement, type RiderState } from "@/lib/store/state";
import type { RentStatus } from "@/lib/types";

const SESSION_KEY = "gmoney.operator.session";

export default function OperatorPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setAuthed(sessionStorage.getItem(SESSION_KEY) === "1");
    } catch {
      setAuthed(false);
    }
  }, []);
  if (authed === null) return <div className="p-8 text-ink-2">Loading…</div>;
  if (!authed) {
    return (
      <Login
        onOk={() => {
          try {
            sessionStorage.setItem(SESSION_KEY, "1");
          } catch {
            /* session-only login */
          }
          setAuthed(true);
        }}
      />
    );
  }
  return (
    <Dashboard
      onLogout={() => {
        try {
          sessionStorage.removeItem(SESSION_KEY);
        } catch {
          /* ignore */
        }
        setAuthed(false);
      }}
    />
  );
}

function Login({ onOk }: { onOk: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <form
        className="w-full max-w-sm rounded-2xl border border-line bg-paper p-6 shadow-raised"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim().toUpperCase() === DEMO_OPERATOR.code) onOk();
          else setError(true);
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-xl font-extrabold text-white">₹</span>
          <h1 className="text-xl font-extrabold">Fleet dashboard</h1>
        </div>
        <label className="block text-sm font-semibold text-ink-2" htmlFor="op-code">
          Operator code
        </label>
        <input
          id="op-code"
          autoFocus
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(false); }}
          className="mt-1 min-h-12 w-full rounded-xl border-2 border-line px-3 text-lg font-semibold uppercase tracking-widest outline-none focus:border-brand"
        />
        {error && <p className="mt-2 text-sm font-semibold text-alert">Unknown operator code</p>}
        <p className="mt-3 rounded-xl bg-info-tint p-3 text-sm text-info">
          Demo build: use code <b>{DEMO_OPERATOR.code}</b>. Production signs operators in with Supabase Auth, and RLS scopes them to their own fleet.
        </p>
        <button type="submit" className="press mt-4 min-h-12 w-full rounded-xl bg-brand text-lg font-semibold text-white">
          Sign in
        </button>
      </form>
    </div>
  );
}

const STATUS: Record<RentStatus, { label: string; cls: string; mark: string }> = {
  paid_on_time: { label: "On time", cls: "bg-brand-tint text-brand-pressed", mark: "✓" },
  paid_late: { label: "Late", cls: "bg-amber-tint text-amber-ink", mark: "!" },
  missed: { label: "Missed", cls: "bg-alert-tint text-alert", mark: "✕" },
  due: { label: "Due", cls: "bg-surface text-ink-2", mark: "…" },
};

const pct = (r: CohortRate) => (r.rate === null ? "–" : `${Math.round(r.rate * 100)}%`);
const shortDate = (d: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [now] = useState(() => new Date().toISOString());
  const [reports, setReports] = useState<OperatorReports>({});
  const [local, setLocal] = useState<RiderState | null>(null);
  const [filter, setFilter] = useState<"all" | "pilot" | "control">("all");
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    setReports(loadOperatorReports());
    setLocal(loadRider());
  }, []);

  const today = istDate(now);
  const fleet = useMemo(() => generateFleet({ now }), [now]);

  // The on-device rider (demo or newly onboarded into this fleet) replaces / joins
  // the generated fleet, so rent paid in the rider app shows up here.
  const sources = useMemo(() => {
    const list = fleet.riders.map((b) => (local && local.rider.id === b.rider.id ? local : b));
    if (local && local.mode === "local" && local.rider.operatorId === DEMO_OPERATOR.id) list.push(local);
    return list.map((s) => ({
      rider: s.rider,
      consents: s.consents,
      rentEvents: s.rentEvents.map((e) => (reports[e.id] ? { ...e, operatorReport: reports[e.id] } : e)),
    }));
  }, [fleet, local, reports]);

  const inputs = sources.map(toOperatorInput).filter((x): x is OperatorRiderInput => x !== null);
  const hidden = sources.length - inputs.length;
  const view = buildOperatorView(inputs, today);
  const rows = view.rows.filter((r) => filter === "all" || r.cohort === filter);
  const gap = view.cumulative.pilot.rate !== null && view.cumulative.control.rate !== null
    ? Math.round((view.cumulative.pilot.rate - view.cumulative.control.rate) * 100)
    : null;

  const mark = (riderId: string, eventId: string, dueOn: string, received: boolean) => {
    const status: RentStatus = received ? paidStatusFor(dueOn, today) : "missed";
    const next = { ...reports, [eventId]: status };
    saveOperatorReports(next);
    setReports(next);
    if (local && local.rider.id === riderId) {
      const updated: RiderState = {
        ...local,
        rentEvents: local.rentEvents.map((e) =>
          e.id === eventId ? { ...e, operatorReport: status, operatorReportedAt: new Date().toISOString(), status: effectiveRentStatus({ ...e, operatorReport: status }, today) } : e,
        ),
      };
      saveRider(updated);
      setLocal(updated);
    }
  };

  const localPhone = local?.rider.phone.replace(/\D/g, "").slice(-10);
  const uploadAgreements = async (file?: File) => {
    if (!file) return;
    const parsed = parseRentAgreementCsv(await file.text(), DEMO_OPERATOR.payeeVpa);
    let applied = 0;
    if (local?.rentAgreement) {
      const row = parsed.rows.find((r) => r.phone.replace(/\D/g, "").slice(-10) === localPhone);
      if (row) {
        const updated = updateRentAgreement(local, { amountPaise: row.amountPaise, cadence: row.cadence, dueWeekday: row.dueWeekday }, new Date().toISOString());
        saveRider(updated);
        setLocal(updated);
        applied = 1;
      }
    }
    setNotice(
      `Rent agreements: ${parsed.rows.length} valid, ${parsed.errors.length} rejected${parsed.errors.length ? ` (${parsed.errors.slice(0, 3).join("; ")})` : ""}. ` +
        `${applied} applied to the on-device rider; the rest are written to rent_agreements once the database is connected.`,
    );
  };

  const uploadPayouts = async (file?: File) => {
    if (!file) return;
    const parsed = parsePayoutCsv(await file.text());
    let added = 0;
    if (local) {
      const mine = parsed.rows.filter((r) => r.phone && r.phone.replace(/\D/g, "").slice(-10) === localPhone);
      if (mine.length) {
        const r = importPayouts(local, mine, new Date().toISOString());
        saveRider(r.state);
        setLocal(r.state);
        added = r.added;
      }
    }
    // Write-only: report counts, never the rows (operators cannot read payouts).
    setNotice(
      `Payout upload: ${parsed.rows.length} rows accepted, ${parsed.errors.length} rejected. ${added} added to the on-device rider. ` +
        `Payout data is write-only for operators — it feeds riders' sweeps and is never shown back here.`,
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-2xl font-extrabold text-white">₹</span>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{DEMO_OPERATOR.name}</h1>
          <p className="text-sm text-ink-2">
            {DEMO_OPERATOR.city} pilot · {inputs.length} riders sharing rent status
            {hidden > 0 && ` · ${hidden} not sharing (hidden)`}
          </p>
        </div>
        <span className="rounded-full bg-info-tint px-3 py-1 text-sm font-semibold text-info">Demo data</span>
        <button type="button" onClick={onLogout} className="press flex min-h-12 items-center gap-2 rounded-xl border-2 border-line bg-paper px-4 font-semibold">
          <LogOut size={18} aria-hidden /> Sign out
        </button>
      </header>

      <p className="mb-6 flex items-start gap-2 rounded-2xl border border-line bg-paper p-4 text-sm text-ink-2">
        <ShieldCheck size={20} className="shrink-0 text-brand" aria-hidden />
        You see whether rent was paid on time, late, or missed — for riders who chose to share it. Riders&apos; earnings, savings and
        spending are never visible to operators; the database enforces this.
      </p>

      {/* Headline comparison */}
      <section className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <Kpi label="Pilot · on-time rent" value={pct(view.cumulative.pilot)} sub={`${view.cumulative.pilot.onTime}/${view.cumulative.pilot.total} rent payments · this week ${pct(view.thisWeek.pilot)}`} tone="brand" />
          <Kpi label="Control · on-time rent" value={pct(view.cumulative.control)} sub={`${view.cumulative.control.onTime}/${view.cumulative.control.total} rent payments · this week ${pct(view.thisWeek.control)}`} tone="ink" />
          <Kpi label="Difference" value={gap === null ? "–" : `${gap > 0 ? "+" : ""}${gap} pts`} sub="Pilot minus control, cumulative" tone={gap !== null && gap > 0 ? "brand" : "ink"} />
        </div>
        <div className="rounded-2xl border border-line bg-paper p-5 shadow-card">
          <div className="mb-2 flex flex-wrap items-center gap-4">
            <h2 className="flex-1 text-lg font-extrabold">On-time rent by week</h2>
            <span className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-sm bg-brand" aria-hidden /> Pilot</span>
            <span className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-sm bg-[#8b8e99]" aria-hidden /> Control</span>
            <button
              type="button"
              onClick={() => downloadText(`rent-comparison-${today}.csv`, comparisonCsv(view))}
              className="press flex min-h-12 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
            >
              <Download size={18} aria-hidden /> Export CSV
            </button>
          </div>
          <CohortBars weeks={view.weeks.map((w) => ({ key: w.weekStart, label: `wk of ${shortDate(w.weekStart)}`, pilot: w.pilot.rate, control: w.control.rate }))} />
        </div>
      </section>

      {/* Riders */}
      <section className="mt-6 rounded-2xl border border-line bg-paper shadow-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <h2 className="flex-1 text-lg font-extrabold">Riders</h2>
          <div role="radiogroup" aria-label="Cohort" className="flex gap-1 rounded-xl bg-surface p-1">
            {(["all", "pilot", "control"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={`press min-h-10 rounded-lg px-3 text-sm font-semibold capitalize ${filter === f ? "bg-paper shadow-card" : "text-ink-2"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-ink-2">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">Rider</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">On-time streak</th>
                <th className="px-4 py-3 font-semibold">Last rent</th>
                <th className="px-4 py-3 font-semibold">Next due</th>
                <th className="px-4 py-3 font-semibold">Record payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RiderRow key={r.riderId} row={r} today={today} onMark={mark} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Uploads */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <Upload title="Upload rent agreements" help="Columns: phone, rent_rupees, cadence (daily|weekly), due_weekday (mon…sun), payee_vpa" onFile={uploadAgreements} />
        <Upload title="Upload rider payouts" help="Columns: phone, date, time, amount, source. Write-only: rows feed riders' sweeps and are never shown back." onFile={uploadPayouts} />
      </section>
      {notice && (
        <p role="status" className="mt-4 rounded-2xl bg-info-tint p-4 text-sm text-info">
          {notice}
        </p>
      )}

      <p className="mt-8 text-center text-sm text-ink-2">
        <Link href="/" className="underline">Rider app</Link>
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "brand" | "ink" }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-5 shadow-card">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className={`num mt-1 text-4xl font-extrabold tracking-tight ${tone === "brand" ? "text-brand" : "text-ink"}`}>{value}</p>
      <p className="mt-1 text-sm text-ink-2">{sub}</p>
    </div>
  );
}

function RiderRow({ row, today, onMark }: { row: OperatorRow; today: string; onMark: (riderId: string, eventId: string, dueOn: string, received: boolean) => void }) {
  const target = row.last?.provisional ? { eventId: row.last.eventId, dueOn: row.last.dueOn } : row.upcoming ?? (row.last?.status === "missed" ? { eventId: row.last.eventId, dueOn: row.last.dueOn } : null);
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3">
        <span className="block font-semibold text-ink">{row.name}</span>
        <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${row.cohort === "pilot" ? "bg-brand-tint text-brand-pressed" : "bg-surface text-ink-2"}`}>
          {row.cohort}
        </span>
      </td>
      <td className="num px-4 py-3 text-ink-2">{row.phone}</td>
      <td className="num px-4 py-3 text-base font-extrabold">{row.onTimeStreak}</td>
      <td className="px-4 py-3">
        {row.last ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-sm font-extrabold ${STATUS[row.last.status].cls}`}>
              <span aria-hidden>{STATUS[row.last.status].mark} </span>
              {STATUS[row.last.status].label}
            </span>
            <span className="text-ink-2">{shortDate(row.last.dueOn)}</span>
            {row.last.provisional && <span className="rounded-full border border-amber px-2 py-0.5 text-xs font-semibold text-amber-ink">rider-reported</span>}
          </span>
        ) : (
          <span className="text-ink-2">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.upcoming ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{shortDate(row.upcoming.dueOn)}</span>
            {row.upcoming.provisionalPaid && <span className="rounded-full border border-amber px-2 py-0.5 text-xs font-semibold text-amber-ink">rider says paid</span>}
          </span>
        ) : (
          <span className="text-ink-2">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {target && (
          <span className="flex gap-2">
            <button type="button" onClick={() => onMark(row.riderId, target.eventId, target.dueOn, true)} className="press flex min-h-10 items-center gap-1 rounded-lg bg-brand px-3 text-sm font-semibold text-white">
              <Check size={16} aria-hidden /> Received
            </button>
            {target.dueOn < today && (
              <button type="button" onClick={() => onMark(row.riderId, target.eventId, target.dueOn, false)} className="press flex min-h-10 items-center gap-1 rounded-lg border-2 border-line px-3 text-sm font-semibold">
                <X size={16} aria-hidden /> Missed
              </button>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

function Upload({ title, help, onFile }: { title: string; help: string; onFile: (f?: File) => void }) {
  return (
    <label className="press flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-dashed border-line bg-paper p-5">
      <FileUp size={24} className="shrink-0 text-brand" aria-hidden />
      <span>
        <span className="block text-base font-extrabold">{title}</span>
        <span className="mt-1 block text-sm text-ink-2">{help}</span>
      </span>
      <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );
}
