"use client";

// SMS auto-capture. First the consent screen (what is read, that nothing leaves the
// phone, that nothing is added without a tap), then the inbox of payments and spends
// found in bank / UPI SMS. Payments open the usual preview-and-confirm; spends are
// added with their category. "Add all" previews the totals before anything changes.

import { useState } from "react";
import { ClipboardPaste, Hand, Lock, MessageSquareText, Power, RefreshCw, Share2, Sparkles } from "lucide-react";
import { movedToday, reducer, type State } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { requestSmsPermission } from "@/lib/sms";
import { parseSms, sampleSms, type DetectedTxn } from "@/lib/smsParse";
import { newId, useSambhal } from "@/lib/store";
import { timeLabel } from "@/lib/time";
import { CAT_ICONS, ConfirmBody, EmptyState, Money, PrimaryButton, SecondaryButton, Sheet, TextButton } from "../ds";
import { sourceLabel } from "../rows";

export interface PaymentPrefill {
  amountPaise: number;
  source: DetectedTxn["source"] & string;
  at: number;
  smsRef: string;
}

export function SmsSheet({ onClose, onAddPayment }: { onClose: () => void; onAddPayment: (p: PaymentPrefill) => void }) {
  const { state, dispatch, t, lang, showToast, scanSms, smsMode } = useSambhal();
  const [view, setView] = useState<"main" | "all">("main");
  const [denied, setDenied] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteMiss, setPasteMiss] = useState(false);
  const [checking, setChecking] = useState(false);
  const native = smsMode === "auto";
  const share = smsMode === "share";
  const pending = state.sms.pending;

  const addSamples = () => {
    // Unique refs per tap, so the demo can be replayed.
    const stamp = Date.now();
    const txns: DetectedTxn[] = [];
    sampleSms(stamp).forEach((msg, i) => {
      const parsed = parseSms(msg.body, msg.at);
      if (parsed) txns.push({ ...parsed, ref: `sample-${i}-${stamp}` });
    });
    dispatch({ type: "smsFound", txns, scannedAt: state.sms.lastScanAt });
  };

  const allow = async () => {
    if (share) return dispatch({ type: "smsEnable" });
    if (!native) {
      dispatch({ type: "smsEnable" });
      addSamples();
      return;
    }
    const granted = await requestSmsPermission();
    if (!granted) return setDenied(true);
    dispatch({ type: "smsEnable" });
    setChecking(true);
    // The store scans as soon as capture is on; this covers the first read too.
    setTimeout(() => void scanSms().finally(() => setChecking(false)), 50);
  };

  const addSpend = (txn: DetectedTxn) => {
    const id = newId("s");
    dispatch({ type: "spend", id, at: txn.at, amountPaise: txn.amountPaise, category: txn.category, smsRef: txn.ref });
    showToast({ message: t("sms.added", { n: 1 }), undo: () => dispatch({ type: "remove", id }) });
  };

  // Simulate "Add all" on a copy of the state so the preview shows real totals.
  const actionsFor = (txns: DetectedTxn[]) =>
    [...txns]
      .sort((a, b) => a.at - b.at)
      .map((x) =>
        x.direction === "in"
          ? ({ type: "payout", id: newId("p"), at: x.at, amountPaise: x.amountPaise, source: x.source ?? "other", smsRef: x.ref } as const)
          : ({ type: "spend", id: newId("s"), at: x.at, amountPaise: x.amountPaise, category: x.category, smsRef: x.ref } as const),
      );
  const inTotal = pending.filter((x) => x.direction === "in").reduce((s, x) => s + x.amountPaise, 0);
  const outTotal = pending.filter((x) => x.direction === "out").reduce((s, x) => s + x.amountPaise, 0);
  const simulated: State = actionsFor(pending).reduce((s, a) => reducer(s, a), state);
  const potsDelta = movedToday(simulated) - movedToday(state);

  const addAll = () => {
    const n = pending.length;
    for (const a of actionsFor(pending)) dispatch(a);
    setView("main");
    showToast({ message: t("sms.added", { n }) });
  };

  const readPasted = () => {
    const txn = parseSms(pasted, Date.now());
    if (!txn) return setPasteMiss(true);
    dispatch({ type: "smsFound", txns: [txn], scannedAt: state.sms.lastScanAt });
    setPasted("");
    setPasteMiss(false);
    setShowPaste(false);
  };

  if (!state.sms.enabled) {
    const points = share
      ? [
          { Icon: Share2, text: t("sms.shareHow") },
          { Icon: MessageSquareText, text: t("sms.shareOnly") },
          { Icon: Lock, text: t("sms.consent2") },
          { Icon: Hand, text: t("sms.consent3") },
        ]
      : [
          { Icon: MessageSquareText, text: t("sms.consent1") },
          { Icon: Lock, text: t("sms.consent2") },
          { Icon: Hand, text: t("sms.consent3") },
          { Icon: Power, text: t("sms.consent4") },
        ];
    return (
      <Sheet onClose={onClose} label={t("sms.consentTitle")}>
        <div className="space-y-4">
          <div className="lux-card flex items-center gap-3 rounded-[var(--radius-card)] p-4">
            <span className="lime-tile text-night grid h-12 w-12 shrink-0 place-items-center rounded-2xl" aria-hidden>
              <MessageSquareText size={24} />
            </span>
            <h2 className="pr-8 text-xl font-bold text-on-dark">{t("sms.consentTitle")}</h2>
          </div>
          <ul className="space-y-2">
            {points.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 rounded-2xl bg-lime-50 p-3">
                <Icon size={20} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
                <span className="text-base font-medium text-ink">{text}</span>
              </li>
            ))}
          </ul>
          {smsMode === "web" && <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">{t("sms.webOnly")}</p>}
          {denied && <p className="rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">{t("sms.denied")}</p>}
          <div className="space-y-1">
            <PrimaryButton icon={native ? MessageSquareText : share ? Share2 : Sparkles} onClick={() => void allow()}>
              {native ? t("sms.allow") : share ? t("action.done") : t("sms.trySample")}
            </PrimaryButton>
            <TextButton tone="muted" className="w-full" onClick={onClose}>
              {t("sms.notNow")}
            </TextButton>
          </div>
        </div>
      </Sheet>
    );
  }

  if (view === "all") {
    return (
      <Sheet onClose={onClose} label={t("sms.addAllTitle", { n: pending.length })}>
        <ConfirmBody
          title={t("sms.addAllTitle", { n: pending.length })}
          rows={[
            ...(inTotal ? [{ label: t("sms.rowIn"), paise: inTotal, tone: "green" as const }] : []),
            ...(potsDelta ? [{ label: t("sms.rowPots"), paise: potsDelta, tone: "green" as const }] : []),
            ...(outTotal ? [{ label: t("sms.rowOut"), paise: outTotal, tone: "amber" as const }] : []),
          ]}
          confirmLabel={t("action.confirm")}
          onConfirm={addAll}
          onBack={() => setView("main")}
        />
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} label={t("sms.title")}>
      <div className="space-y-4">
        <div className="pr-10">
          <h2 className="text-xl font-bold text-ink">{t("sms.title")}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5 font-semibold text-green-700">
              <span aria-hidden className="h-2 w-2 rounded-full bg-green-600" />
              {t("sms.statusOn")}
            </span>
            {state.sms.lastScanAt > 0 && <span>· {t("sms.lastCheck", { time: timeLabel(state.sms.lastScanAt, lang) })}</span>}
          </p>
        </div>

        {share && (
          <p className="flex items-start gap-2 rounded-2xl bg-lime-50 p-3 text-sm font-medium text-ink">
            <Share2 size={18} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
            {t("sms.shareHow")}
          </p>
        )}

        {pending.length === 0 ? (
          <EmptyState icon={MessageSquareText} title={t("sms.title")} body={t("sms.empty")} />
        ) : (
          <ul className="space-y-2">
            {pending.map((txn) => (
              <DetectedRow
                key={txn.ref}
                txn={txn}
                onAdd={() =>
                  txn.direction === "in"
                    ? onAddPayment({ amountPaise: txn.amountPaise, source: txn.source ?? "other", at: txn.at, smsRef: txn.ref })
                    : addSpend(txn)
                }
                onIgnore={() => dispatch({ type: "smsDismiss", ref: txn.ref })}
              />
            ))}
          </ul>
        )}

        {pending.length > 1 && (
          <PrimaryButton onClick={() => setView("all")}>
            {t("sms.addAll", { n: pending.length })}
          </PrimaryButton>
        )}

        <div className="space-y-2">
          {native ? (
            <SecondaryButton icon={RefreshCw} onClick={() => { setChecking(true); void scanSms().finally(() => setChecking(false)); }} disabled={checking}>
              {t("sms.checkNow")}
            </SecondaryButton>
          ) : smsMode === "web" ? (
            <SecondaryButton icon={Sparkles} onClick={addSamples}>
              {t("sms.trySample")}
            </SecondaryButton>
          ) : null}
          <SecondaryButton icon={ClipboardPaste} onClick={() => setShowPaste(!showPaste)}>
            {t("sms.paste")}
          </SecondaryButton>
        </div>

        {showPaste && (
          <div className="space-y-2">
            <label htmlFor="sms-paste" className="sr-only">{t("sms.paste")}</label>
            <textarea
              id="sms-paste"
              value={pasted}
              onChange={(e) => { setPasted(e.target.value); setPasteMiss(false); }}
              placeholder={t("sms.pastePlaceholder")}
              rows={4}
              className="w-full rounded-2xl border-2 border-line-strong bg-card p-3 text-base text-ink placeholder:text-muted focus:border-green-700 focus:outline-none"
            />
            {pasteMiss && <p className="text-sm font-semibold text-red-600" role="alert">{t("sms.pasteNone")}</p>}
            <SecondaryButton onClick={readPasted} disabled={!pasted.trim()}>
              {t("sms.pasteRead")}
            </SecondaryButton>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function DetectedRow({ txn, onAdd, onIgnore }: { txn: DetectedTxn; onAdd: () => void; onIgnore: () => void }) {
  const { t, lang } = useSambhal();
  const incoming = txn.direction === "in";
  const Icon = incoming ? MessageSquareText : CAT_ICONS[txn.category ?? "other"];
  const title = incoming
    ? t("sms.in", { source: sourceLabel(txn.source ?? "other", t) })
    : t("sms.out", { category: t(`cat.${txn.category ?? "other"}`) });
  return (
    <li className="rounded-2xl bg-card p-3 shadow-card">
      <div className="flex items-start gap-3">
        <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${incoming ? "bg-lime-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{title}</p>
          <p className="truncate text-sm text-muted">
            <span translate="no">{txn.counterparty}</span> · {timeLabel(txn.at, lang)}
          </p>
        </div>
        <Money paise={txn.amountPaise} sign={incoming ? "+" : "-"} className={`text-lg font-extrabold ${incoming ? "text-green-700" : "text-ink"}`} />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <TextButton tone="muted" onClick={onIgnore}>{t("sms.ignore")}</TextButton>
        <button type="button" onClick={onAdd} className="press btn-glow min-h-12 rounded-xl bg-lime px-5 text-base font-extrabold text-night">
          {t("sms.add")}
        </button>
      </div>
    </li>
  );
}

/** Totals for the Home banner. */
export function smsTotals(pending: DetectedTxn[]) {
  return {
    in: formatINR(pending.filter((x) => x.direction === "in").reduce((s, x) => s + x.amountPaise, 0)),
    out: formatINR(pending.filter((x) => x.direction === "out").reduce((s, x) => s + x.amountPaise, 0)),
  };
}
