"use client";

// Hand-built primitives (no component library). Rules from the design brief:
// every tap target ≥ 48px, pressed = scale 0.97 / 100ms, no text under 12px,
// colour never the only signal, no gesture is the only way to do anything.

import Link from "next/link";
import { ArrowLeft, Delete, X } from "lucide-react";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { formatINR } from "@/lib/money";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "amber" | "white";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white active:bg-brand-pressed shadow-card",
  secondary: "bg-paper text-ink border-2 border-line active:bg-surface",
  danger: "bg-alert text-white shadow-card",
  ghost: "bg-transparent text-ink-2 active:bg-surface",
  amber: "bg-amber text-ink shadow-card",
  white: "bg-white text-brand shadow-card",
};
const SIZES = { md: "min-h-12 px-4 text-base", lg: "min-h-14 px-5 text-lg" };

export function Button({
  variant = "primary",
  size = "md",
  full,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES; full?: boolean }) {
  return (
    <button
      type={type}
      className={`press inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${full ? "w-full" : ""} ${className}`}
      {...props}
    />
  );
}

export function Money({ paise, className = "" }: { paise: number; className?: string }) {
  return <span className={`num ${className}`}>{formatINR(paise)}</span>;
}

const BAR_TONES = {
  brand: ["bg-surface", "bg-brand"],
  amber: ["bg-surface", "bg-amber"],
  alert: ["bg-alert-tint", "bg-alert"],
  white: ["bg-white/25", "bg-white"],
} as const;

export function ProgressBar({
  value,
  tone = "brand",
  label,
  className = "",
}: {
  value: number;
  tone?: keyof typeof BAR_TONES;
  label: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(v));
    return () => cancelAnimationFrame(id);
  }, [v]);
  const [track, fill] = BAR_TONES[tone];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className={`h-2.5 w-full overflow-hidden rounded-full ${track} ${className}`}
    >
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${width * 100}%`, transition: "width 400ms ease-out" }} />
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-paper shadow-card ${className}`}>{children}</div>;
}

export function Chip({
  selected,
  onClick,
  children,
  dot,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  dot?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`press inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-base font-semibold ${
        selected ? "border-brand bg-brand-tint text-ink" : "border-line bg-paper text-ink"
      }`}
    >
      {dot && <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: dot }} />}
      {children}
      {selected && <span className="sr-only">✓</span>}
    </button>
  );
}

export function TopBar({ title, back, right }: { title?: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-line bg-paper/95 px-2 backdrop-blur lg:static lg:mb-2 lg:h-16 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
      {back && (
        <Link href={back} aria-label="Back / वापस" className="press flex h-12 w-12 items-center justify-center rounded-full active:bg-surface">
          <ArrowLeft size={24} aria-hidden />
        </Link>
      )}
      <h1 className={`flex-1 truncate text-lg font-extrabold tracking-tight lg:text-3xl ${back ? "" : "pl-2 lg:pl-0"}`}>{title}</h1>
      {right}
    </header>
  );
}

/** Bottom sheet. Drag down is a shortcut; the close button is always there. */
export function Sheet({
  open,
  onClose,
  title,
  tone = "default",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  tone?: "default" | "alert" | "amber" | "brand";
  children: ReactNode;
}) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const band = { default: "bg-paper", alert: "bg-alert-tint", amber: "bg-amber-tint", brand: "bg-brand-tint" }[tone];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6" role="dialog" aria-modal="true">
      <div className="backdrop-in absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        className="sheet-in relative max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-paper pb-safe shadow-raised lg:max-w-md lg:rounded-3xl"
        style={{ transform: drag ? `translateY(${drag}px)` : undefined }}
      >
        <div
          className={`sticky top-0 z-10 rounded-t-3xl ${band} px-5 pb-3 pt-2`}
          onPointerDown={(e) => {
            start.current = e.clientY;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => start.current !== null && setDrag(Math.max(0, e.clientY - start.current))}
          onPointerUp={() => {
            if (drag > 110) onClose();
            setDrag(0);
            start.current = null;
          }}
        >
          <div aria-hidden className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-black/15 lg:hidden" />
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-xl font-extrabold tracking-tight">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close / बंद करो" className="press -mr-2 flex h-12 w-12 items-center justify-center rounded-full active:bg-black/5">
              <X size={24} aria-hidden />
            </button>
          </div>
        </div>
        <div className="px-5 pb-6 pt-3">{children}</div>
      </div>
    </div>
  );
}

/** Big ₹ amount as typed on the keypad. */
export function AmountDisplay({ digits, label }: { digits: string; label: string }) {
  const rupees = digits ? Number(digits) : 0;
  return (
    <div aria-live="polite" aria-label={`${label}: ₹${rupees}`} className="flex min-h-20 items-center justify-center">
      <span className={`num text-5xl font-extrabold tracking-tight ${digits ? "text-ink" : "text-ink-3"}`}>
        ₹{new Intl.NumberFormat("en-IN").format(rupees)}
      </span>
    </div>
  );
}

/** Numeric keypad for rupee amounts. Also accepts a physical keyboard. */
export function Keypad({
  value,
  onChange,
  maxLength = 6,
  compact,
}: {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  compact?: boolean;
}) {
  const press = (key: string) => {
    if (key === "del") return onChange(value.slice(0, -1));
    const next = (value + key).replace(/^0+/, "");
    if (next.length <= maxLength) onChange(next);
  };
  const latest = useRef(press);
  latest.current = press;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(e.key)) latest.current(e.key);
      else if (e.key === "Backspace") latest.current("del");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "del"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          aria-label={k === "del" ? "Delete / मिटाओ" : k}
          className={`press num flex items-center justify-center rounded-xl bg-surface font-semibold active:bg-line ${compact ? "h-14 text-xl" : "h-16 text-2xl"}`}
        >
          {k === "del" ? <Delete size={26} aria-hidden /> : k}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  sub,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  sub?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="press flex min-h-14 w-full items-center gap-3 rounded-xl py-2 text-left disabled:opacity-60"
    >
      <span className="flex-1">
        <span className="block text-base font-semibold">{label}</span>
        {sub && <span className="mt-0.5 block text-sm text-ink-2">{sub}</span>}
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-ink-3"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-7" : "translate-x-1"}`} />
        <span className="sr-only">{checked ? "ON" : "OFF"}</span>
      </span>
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  format,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  step: number;
  min: number;
  max: number;
  format: (v: number) => string;
  label: string;
}) {
  return (
    <div className="flex max-w-md items-center gap-3" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`− ${label}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
        className="press flex h-12 w-12 items-center justify-center rounded-xl border-2 border-line text-2xl font-semibold disabled:opacity-40"
      >
        −
      </button>
      <span className="num min-w-24 flex-1 text-center text-2xl font-extrabold">{format(value)}</span>
      <button
        type="button"
        aria-label={`+ ${label}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
        className="press flex h-12 w-12 items-center justify-center rounded-xl border-2 border-line text-2xl font-semibold disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`press min-h-12 flex-1 rounded-lg px-2 text-base font-semibold disabled:opacity-50 ${
            value === o.value ? "bg-paper text-ink shadow-card" : "text-ink-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-2xl ${className}`} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-lg font-extrabold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/** Renders children into <body>, outside any animated (transformed) ancestor. */
export function BodyPortal({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.body), []);
  return el ? createPortal(children, el) : null;
}
