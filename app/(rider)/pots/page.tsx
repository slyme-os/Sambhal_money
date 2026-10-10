"use client";

// S3 — Pots. Balance, target, what it's for, full history, and a withdrawal that
// says plainly when the money arrives: "पैसा कल तक आपके बैंक में". Never "instant".

import { ChevronDown, Clock } from "lucide-react";
import { useState } from "react";
import { useRider } from "@/components/StoreProvider";
import { AmountDisplay, Button, Card, Chip, Keypad, Money, ProgressBar, Sheet, TopBar } from "@/components/ui";
import { PLATFORMS } from "@/lib/config";
import { formatWhen } from "@/lib/day";
import { formatINR } from "@/lib/money";
import { balancesOf, requestWithdrawal } from "@/lib/store/state";
import type { StringKey } from "@/lib/strings";
import type { PotKind } from "@/lib/types";

const META: Record<PotKind, { name: StringKey; purpose: StringKey; icon: string; tone: "amber" | "brand" }> = {
  rent: { name: "potRent", purpose: "potRentFor", icon: "🏍️", tone: "amber" },
  emergency: { name: "potEmergency", purpose: "potEmergencyFor", icon: "🛟", tone: "brand" },
  savings: { name: "potSavings", purpose: "potSavingsFor", icon: "🪙", tone: "brand" },
};

export default function PotsPage() {
  const { state, t, lang } = useRider();
  const [open, setOpen] = useState<PotKind | null>(null);
  const [withdrawFrom, setWithdrawFrom] = useState<PotKind | null>(null);
  const [shown, setShown] = useState(8);
  if (!state) return <TopBar title={t("navPots")} />;

  const balances = balancesOf(state);
  const targets: Record<PotKind, number | null> = {
    rent: state.rentAgreement?.amountPaise ?? null,
    emergency: state.rider.split.emergencyTargetPaise,
    savings: state.rider.split.savingsTargetPaise,
  };
  const payoutById = new Map(state.payouts.map((p) => [p.id, p]));
  const sourceLabel = (s: string) => {
    const label = PLATFORMS.find((p) => p.value === s)?.label ?? s;
    return label.startsWith("source") ? t(label as StringKey) : label;
  };

  const history = (kind: PotKind) => {
    const ins = state.allocations
      .filter((a) => a.potKind === kind)
      .map((a) => {
        const p = payoutById.get(a.payoutId);
        return { id: a.id, at: p?.occurredAt ?? a.createdAt, paise: a.amountPaise, label: t("fromPayout", { source: sourceLabel(p?.source ?? "other") }), pending: false };
      });
    const outs = state.withdrawals
      .filter((w) => w.potKind === kind && w.status !== "cancelled")
      .map((w) => ({ id: w.id, at: w.requestedAt, paise: -w.amountPaise, label: t("withdrawnFor"), pending: w.status === "pending" }));
    return [...ins, ...outs].sort((a, b) => (a.at < b.at ? 1 : -1));
  };

  return (
    <div>
      <TopBar title={t("navPots")} />
      <div className="space-y-4 px-4 pb-8 pt-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-5 lg:space-y-0 lg:px-0 lg:pt-0">
        {(["rent", "emergency", "savings"] as const).map((kind) => {
          const meta = META[kind];
          const target = targets[kind];
          const expanded = open === kind;
          const rows = expanded ? history(kind) : [];
          return (
            <Card key={kind} className="overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface text-2xl">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-extrabold">{t(meta.name)}</h2>
                    <p className="text-sm text-ink-2">{t(meta.purpose)}</p>
                  </div>
                </div>
                <p className="num mt-3 text-3xl font-extrabold">
                  {formatINR(balances[kind])}
                  <span className="ml-2 text-base font-semibold text-ink-2">
                    {target ? t("ofTarget", { target: formatINR(target).slice(1) }) : t("noTarget")}
                  </span>
                </p>
                {target ? <ProgressBar value={balances[kind] / target} tone={meta.tone} label={t(meta.name)} className="mt-3" /> : null}
                <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">
                  <Button variant="secondary" disabled={balances[kind] <= 0} onClick={() => setWithdrawFrom(kind)}>
                    {t("withdraw")}
                  </Button>
                  <Button variant="ghost" aria-expanded={expanded} onClick={() => { setOpen(expanded ? null : kind); setShown(8); }}>
                    {t("history")} <ChevronDown size={20} aria-hidden className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </Button>
                </div>
              </div>
              {expanded && (
                <ul className="border-t border-line bg-surface/60">
                  {rows.length === 0 && <li className="p-4 text-base text-ink-2">{t("noHistory")}</li>}
                  {rows.slice(0, shown).map((r) => (
                    <li key={r.id} className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-2 last:border-0">
                      <span className="flex-1">
                        <span className="block text-base font-semibold">{r.label}</span>
                        <span className="flex items-center gap-1 text-sm text-ink-2">
                          {formatWhen(r.at, lang)}
                          {r.pending && (
                            <>
                              {" · "}
                              <Clock size={14} aria-hidden /> {t("pending")}
                            </>
                          )}
                        </span>
                      </span>
                      <span className={`num text-lg font-extrabold ${r.paise < 0 ? "text-alert" : "text-brand-pressed"}`}>
                        {r.paise < 0 ? "−" : "+"}
                        {formatINR(Math.abs(r.paise))}
                      </span>
                    </li>
                  ))}
                  {rows.length > shown && (
                    <li>
                      <button type="button" onClick={() => setShown((n) => n + 20)} className="press min-h-12 w-full text-base font-semibold text-brand">
                        + {rows.length - shown}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </Card>
          );
        })}
        <p className="text-sm text-ink-2 lg:col-span-3">{t("ledgerNote")}</p>
      </div>
      {withdrawFrom && <WithdrawSheet kind={withdrawFrom} onClose={() => setWithdrawFrom(null)} />}
    </div>
  );
}

function WithdrawSheet({ kind, onClose }: { kind: PotKind; onClose: () => void }) {
  const { state, commit, now, t, toast } = useRider();
  const [digits, setDigits] = useState("");
  const [confirming, setConfirming] = useState(false);
  if (!state) return null;
  const balance = balancesOf(state)[kind];
  const paise = Number(digits) * 100;
  const tooHigh = paise > balance;
  const potName = t(META[kind].name);

  const withdraw = () => {
    commit(requestWithdrawal(state, kind, paise, "user", now()));
    toast(t("withdrawDone", { x: formatINR(paise).slice(1) }));
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={confirming ? t("withdrawConfirm", { x: formatINR(paise).slice(1) }) : t("withdrawFrom", { pot: potName })}>
      {!confirming ? (
        <>
          <p className="text-center text-sm text-ink-2">
            {potName}: <Money paise={balance} className="font-semibold text-ink" />
          </p>
          <AmountDisplay digits={digits} label={t("withdraw")} />
          {tooHigh && <p className="mb-2 text-center text-base font-semibold text-alert">{t("amountTooHigh")}</p>}
          <div className="mb-3 flex flex-wrap justify-center gap-2">
            {[100, 500].filter((q) => q * 100 <= balance).map((q) => (
              <Chip key={q} selected={digits === String(q)} onClick={() => setDigits(String(q))}>
                ₹{q}
              </Chip>
            ))}
            <Chip selected={paise === Math.floor(balance / 100) * 100 && paise > 0} onClick={() => setDigits(String(Math.floor(balance / 100)))}>
              {t("withdrawMax")}
            </Chip>
          </div>
          <Keypad value={digits} onChange={setDigits} compact />
          <Button full size="lg" className="mt-3" disabled={!paise || tooHigh} onClick={() => setConfirming(true)}>
            {t("obNext")}
          </Button>
        </>
      ) : (
        <>
          <div className="rounded-2xl bg-brand-tint p-4">
            <p className="text-xl font-extrabold">{t("withdrawEta")}</p>
            <p className="mt-1 text-base text-ink-2">{t("withdrawEtaSub")}</p>
          </div>
          <p className="mt-3 text-sm text-ink-2">{t("ledgerNote")}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button size="lg" onClick={withdraw}>
              {t("withdrawCta")}
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setConfirming(false)}>
              {t("back")}
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
