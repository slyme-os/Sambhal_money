"use client";

// Sambhal design system: the only building blocks screens use.
// Rules: one PrimaryButton per screen; every tap target ≥ 48px; money is always a
// <Money> (tabular, never translated); any money movement goes through ConfirmSheet.

import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Bike, Coins, Delete, Gift, GraduationCap, HeartPulse, House,
  Landmark, LifeBuoy, Smartphone, X, type LucideIcon,
} from "lucide-react";
import { formatINR } from "@/lib/money";
import type { MsgKey, Vars } from "@/lib/i18n";
import type { Pot, PotIcon } from "@/lib/ledger";
import { useSambhal } from "@/lib/store";

// ---------- money ----------

export function Money({ paise, sign, className = "" }: { paise: number; sign?: "+" | "-"; className?: string }) {
  return (
    <span className={`money ${className}`} translate="no">
      {sign === "+" ? "+" : sign === "-" ? "−" : ""}
      {formatINR(Math.abs(paise))}
    </span>
  );
}

const BIG = { hero: "text-[56px] min-[380px]:text-[64px]", lg: "text-[40px]", md: "text-[28px]" } as const;
const TONE = { ink: "text-ink", green: "text-green-700", amber: "text-amber-700", red: "text-red-600", lime: "text-lime", coral: "text-coral", white: "text-on-dark" } as const;

/** The number a screen is about. Extra bold, tabular, huge. */
export function BigNumber({ paise, size = "hero", tone = "ink", sign }: { paise: number; size?: keyof typeof BIG; tone?: keyof typeof TONE; sign?: "+" | "-" }) {
  return <Money paise={paise} sign={sign} className={`money-hero block font-extrabold ${BIG[size]} ${TONE[tone]}`} />;
}

// ---------- surfaces ----------

export function MoneyCard({ children, tone = "card", className = "", label }: { children: ReactNode; tone?: "card" | "green" | "amber" | "red" | "lux" | "luxAlert"; className?: string; label?: string }) {
  const bg = { card: "bg-card shadow-card", green: "bg-green-50", amber: "bg-amber-50", red: "bg-red-50", lux: "lux-card", luxAlert: "lux-card lux-card-alert" }[tone];
  return (
    <section aria-label={label} className={`rounded-[var(--radius-card)] p-5 ${bg} ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Progress({ value, tone = "green", label }: { value: number; tone?: "green" | "amber" | "red" | "dark" | "amberDark"; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const fill = { green: "bar-lux", amber: "bg-amber-600", red: "bg-red-600", dark: "bar-lux-dark", amberDark: "bg-amber-300" }[tone];
  const track = { green: "bg-[#e4ebda]", amber: "bg-amber-100", red: "bg-red-100", dark: "bg-[#24402f]", amberDark: "bg-[#24402f]" }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className={`h-2.5 w-full overflow-hidden rounded-full ${track}`}>
      <div className={`bar-fill h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, size = 168, stroke = 12, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ring-rotate" aria-hidden>
        <defs>
          <linearGradient id="ring-lux" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8edb4f" />
            <stop offset="100%" stopColor="#ddf76a" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ring-lux)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} className="ring-fill" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

// ---------- pots ----------

export const POT_ICONS: Record<PotIcon, LucideIcon> = {
  bike: Bike, shield: LifeBuoy, coins: Coins, phone: Smartphone, heart: HeartPulse, school: GraduationCap, gift: Gift, home: House,
};

export function PotGlyph({ icon, size = "md" }: { icon: PotIcon; size?: "md" | "lg" }) {
  const Icon = POT_ICONS[icon];
  const box = size === "lg" ? "lime-tile text-night h-14 w-14 rounded-2xl" : "h-12 w-12 rounded-2xl bg-lime-50 text-green-700";
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center ${box}`}>
      <Icon size={size === "lg" ? 28 : 24} strokeWidth={2} />
    </span>
  );
}

export function potName(pot: Pot, t: (k: MsgKey, v?: Vars) => string): string {
  return pot.nameKey ? t(pot.nameKey) : (pot.label ?? "");
}

export function etaText(days: number | null, t: (k: MsgKey, v?: Vars) => string): string {
  if (days === null) return t("pots.noPace");
  if (days === 0) return t("pots.reached");
  if (days <= 1) return t("pots.eta.day");
  if (days < 14) return t("pots.eta.days", { n: days });
  if (days < 60) return t("pots.eta.weeks", { n: Math.round(days / 7) });
  return t("pots.eta.months", { n: Math.round(days / 30) });
}

/** "₹1,750 of ₹2,500" and when it'll be full. Progress shows rupees left, not %. */
export function PotCard({ pot, balance, eta, todayPaise, onOpen }: { pot: Pot; balance: number; eta: number | null; todayPaise: number; onOpen?: () => void }) {
  const { t } = useSambhal();
  const name = potName(pot, t);
  const left = Math.max(0, pot.goalPaise - balance);
  const body = (
    <>
      <div className="flex items-center gap-3">
        <PotGlyph icon={pot.icon} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">{name}</p>
          <p className="text-sm text-muted">
            {t("pots.of", { balance: formatINR(balance), goal: formatINR(pot.goalPaise) })}
          </p>
        </div>
        <Money paise={balance} className="text-xl font-extrabold" />
      </div>
      <div className="mt-3">
        <Progress value={balance / pot.goalPaise} label={name} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 text-sm">
          <span className={left === 0 ? "font-semibold text-green-700" : "text-ink-2"}>
            {left === 0 ? t("pots.reached") : `${t("pots.toGo", { amount: formatINR(left) })} · ${etaText(eta, t)}`}
          </span>
          {todayPaise > 0 && <span className="money font-semibold text-green-700">{t("pots.todayPlus", { amount: formatINR(todayPaise) })}</span>}
        </div>
      </div>
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} className="press block w-full rounded-[var(--radius-card)] bg-card p-4 text-left shadow-card">
      {body}
    </button>
  ) : (
    <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-card">{body}</div>
  );
}

// ---------- actions ----------

type BtnProps = { children: ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; className?: string; icon?: LucideIcon; ariaLabel?: string };

/** The one primary action on a screen: lime fill, ink text, 56px. */
export function PrimaryButton({ children, onClick, disabled, type = "button", className = "", icon: Icon }: BtnProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime px-5 text-lg font-extrabold text-night active:bg-lime-press disabled:bg-surface disabled:text-muted ${disabled ? "" : "btn-glow"} ${className}`}>
      {Icon && <Icon size={22} strokeWidth={2.4} aria-hidden />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled, type = "button", className = "", icon: Icon, ariaLabel }: BtnProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel} className={`press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-night bg-card px-5 text-base font-bold text-night disabled:border-line disabled:text-muted ${className}`}>
      {Icon && <Icon size={20} strokeWidth={2.2} aria-hidden />}
      {children}
    </button>
  );
}

export function TextButton({ children, onClick, className = "", icon: Icon, tone = "green" }: BtnProps & { tone?: "green" | "red" | "muted" }) {
  const color = { green: "text-green-700", red: "text-red-600", muted: "text-ink-2" }[tone];
  return (
    <button type="button" onClick={onClick} className={`press inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 text-base font-semibold ${color} ${className}`}>
      {Icon && <Icon size={18} strokeWidth={2.2} aria-hidden />}
      {children}
    </button>
  );
}

export function Chip({ children, selected, onClick, label }: { children: ReactNode; selected: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={`press inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 px-4 text-base font-semibold ${selected ? "border-night bg-lime text-night" : "border-transparent bg-card text-ink shadow-card"}`}
    >
      {children}
    </button>
  );
}

// ---------- rows ----------

/** One money movement: what, where, how much, in which direction. */
export function TransactionRow({ kind, title, sub, paise, onClick }: { kind: "in" | "out" | "withdraw"; title: string; sub: string; paise: number; onClick?: () => void }) {
  const Icon = kind === "in" ? ArrowDownLeft : kind === "out" ? ArrowUpRight : Landmark;
  const tile = kind === "in" ? "bg-lime-50 text-green-700" : kind === "out" ? "bg-amber-50 text-amber-700" : "bg-surface text-ink-2";
  const inner = (
    <>
      <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tile}`}>
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold text-ink">{title}</span>
        <span className="block truncate text-sm text-muted">{sub}</span>
      </span>
      <Money paise={paise} sign={kind === "in" ? "+" : "-"} className={`text-base font-bold ${kind === "in" ? "text-green-700" : "text-ink"}`} />
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="press flex min-h-16 w-full items-center gap-3 rounded-xl py-2 text-left">
      {inner}
    </button>
  ) : (
    <div className="flex min-h-16 items-center gap-3 py-2">{inner}</div>
  );
}

// ---------- trust & empty ----------

export function TrustBadge({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-lime-50 px-3 py-2.5 text-sm font-semibold text-ink-2">
      <Icon size={18} strokeWidth={2.2} className="shrink-0 text-green-700" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] bg-card px-5 py-7 text-center shadow-card">
      <span aria-hidden className="lime-tile text-night grid h-14 w-14 place-items-center rounded-2xl">
        <Icon size={28} strokeWidth={2} />
      </span>
      <p className="mt-3 text-lg font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-[30ch] text-sm text-muted">{body}</p>
      {action && <div className="mt-4 w-full">{action}</div>}
    </div>
  );
}

// ---------- sheets ----------

/** Bottom sheet. Escape and the backdrop close it; body scroll is locked while open. */
export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  const { t } = useSambhal();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label={t("action.close")} onClick={onClose} className="backdrop-in backdrop absolute inset-0" />
      <div ref={panel} tabIndex={-1} className="sheet-in relative max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-t-[var(--radius-sheet)] bg-card px-5 pb-6 pt-2 shadow-sheet outline-none">
        <div className="flex items-center justify-between">
          <span aria-hidden className="mx-auto my-2 h-1.5 w-10 rounded-full bg-line" />
        </div>
        <button type="button" onClick={onClose} aria-label={t("action.close")} className="press absolute right-2 top-2 grid h-12 w-12 place-items-center rounded-full text-ink-2">
          <X size={22} aria-hidden />
        </button>
        <div className="pb-safe">{children}</div>
      </div>
    </div>
  );
}

export interface ConfirmRow {
  label: string;
  paise: number;
  tone?: "green" | "amber" | "ink";
  icon?: LucideIcon;
}

/** Every money movement: amount, direction and destination, shown before it happens. */
export function ConfirmBody({ title, sub, rows, note, confirmLabel, onConfirm, onBack, danger }: {
  title: string; sub?: string; rows: ConfirmRow[]; note?: ReactNode; confirmLabel: string; onConfirm: () => void; onBack: () => void; danger?: boolean;
}) {
  const { t } = useSambhal();
  return (
    <div className="space-y-4">
      <div className="pr-10">
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {rows.length > 0 && (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const Icon = r.icon;
            const bg = r.tone === "amber" ? "bg-amber-50" : r.tone === "green" ? "bg-lime-50" : "bg-surface";
            return (
              <li key={r.label} className={`flow-in flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 ${bg}`} style={{ animationDelay: `${i * 90}ms` }}>
                {Icon && <Icon size={20} strokeWidth={2.2} aria-hidden className={r.tone === "amber" ? "text-amber-700" : "text-green-700"} />}
                <span className="flex-1 text-base font-semibold text-ink">{r.label}</span>
                <Money paise={r.paise} className="text-lg font-extrabold" />
              </li>
            );
          })}
        </ol>
      )}
      {note}
      <div className="space-y-1 pt-1">
        {danger ? (
          <button type="button" onClick={onConfirm} className="press flex min-h-14 w-full items-center justify-center rounded-2xl bg-red-600 px-5 text-lg font-bold text-white">
            {confirmLabel}
          </button>
        ) : (
          <PrimaryButton onClick={onConfirm}>{confirmLabel}</PrimaryButton>
        )}
        <TextButton onClick={onBack} tone="muted" className="w-full">
          {t("action.back")}
        </TextButton>
      </div>
    </div>
  );
}

// ---------- input ----------

export function Keypad({ value, onChange, max = 5 }: { value: string; onChange: (next: string) => void; max?: number }) {
  const { t } = useSambhal();
  const press = (key: string) => {
    if (key === "del") return onChange(value.slice(0, -1));
    const next = (value + key).replace(/^0+(?=\d)/, "");
    if (next.length <= max) onChange(next);
  };
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === "Backspace") pressRef.current("del");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Keypad">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          aria-label={k === "del" ? t("action.remove") : k}
          className="press money grid h-14 place-items-center rounded-2xl bg-card text-2xl font-bold text-ink shadow-card active:bg-lime-50"
        >
          {k === "del" ? <Delete size={24} aria-hidden /> : k}
        </button>
      ))}
    </div>
  );
}

/** The amount being typed, big. Shows ₹0 muted until there are digits. */
export function AmountDisplay({ paise, tone = "ink" }: { paise: number; tone?: keyof typeof TONE }) {
  return (
    <p className="py-1 text-center" aria-live="polite">
      {paise > 0 ? <BigNumber paise={paise} size="lg" tone={tone} /> : <span className="money money-hero block text-[40px] font-extrabold text-muted">₹0</span>}
    </p>
  );
}

// ---------- feedback ----------

export function ToastHost({ withActionBar }: { withActionBar: boolean }) {
  const { toast, dismissToast, t } = useSambhal();
  if (!toast) return null;
  return (
    <div className={`pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-4 ${withActionBar ? "bottom-[calc(10.5rem+env(safe-area-inset-bottom))]" : "bottom-[calc(6rem+env(safe-area-inset-bottom))]"}`}>
      <div role="status" key={toast.id} className={`toast-in pointer-events-auto flex min-h-14 w-full max-w-[448px] items-center gap-3 rounded-2xl px-4 py-2 shadow-sheet ${toast.tone === "alert" ? "bg-red-700 text-white" : "chrome-dark text-white"}`}>
        <span className="flex-1 text-base font-medium">{toast.message}</span>
        {toast.undo && (
          <button
            type="button"
            onClick={() => {
              toast.undo?.();
              dismissToast();
            }}
            className="press min-h-12 rounded-xl px-3 text-base font-bold text-lime"
          >
            {t("action.undo")}
          </button>
        )}
      </div>
    </div>
  );
}

export function SkeletonScreen() {
  const { t } = useSambhal();
  return (
    <div className="space-y-4 px-4 pt-4" aria-busy="true" aria-label={t("state.loading")}>
      <div className="skeleton h-[212px] rounded-[var(--radius-card)]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-[84px] rounded-[var(--radius-card)]" />
        <div className="skeleton h-[84px] rounded-[var(--radius-card)]" />
      </div>
      <div className="skeleton h-6 w-24 rounded-lg" />
      <div className="skeleton h-16 rounded-xl" />
      <div className="skeleton h-16 rounded-xl" />
    </div>
  );
}
