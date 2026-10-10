"use client";

// Small, hand-built pieces. Every tap target is at least 48px. Hindi is the primary
// label everywhere and English sits under it in small text.

import { useEffect, useRef, type ReactNode } from "react";

/** Hindi label first, English subtext below. */
export function Bi({ hi, en, tone = "ink", className = "" }: { hi: string; en?: string; tone?: "ink" | "light"; className?: string }) {
  return (
    <span className={`block ${className}`}>
      <span className={`block text-base font-semibold leading-snug ${tone === "light" ? "text-white" : "text-ink"}`}>{hi}</span>
      {en && <span className={`block text-xs ${tone === "light" ? "text-white/80" : "text-muted"}`}>{en}</span>}
    </span>
  );
}

export function Bar({ value, color = "var(--green)", label }: { value: number; color?: string; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className="h-2.5 w-full overflow-hidden rounded-full bg-line">
      <div className="bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Ring({ value, size = 168, stroke = 14, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--amber)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="ring-fill"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="बंद करो / Close" onClick={onClose} className="backdrop-in absolute inset-0 bg-ink/40" />
      <div className="sheet-in relative max-h-[92dvh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-paper px-5 pb-8 pt-3 shadow-raised sm:rounded-3xl">
        <div aria-hidden className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line sm:hidden" />
        {children}
      </div>
    </div>
  );
}

export function Keypad({ value, onChange, max = 6 }: { value: string; onChange: (next: string) => void; max?: number }) {
  const press = (key: string) => {
    if (key === "del") return onChange(value.slice(0, -1));
    const next = (value + key).replace(/^0+(?=\d)/, "");
    if (next.length <= max) onChange(next);
  };
  // Physical keyboard on desktop: digits and Backspace.
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
          aria-label={k === "del" ? "मिटाओ / Delete" : k}
          className="press num h-16 rounded-2xl bg-surface text-2xl font-semibold active:bg-line"
        >
          {k === "del" ? "⌫" : k}
        </button>
      ))}
    </div>
  );
}

export function Button({ children, variant = "primary", onClick, disabled, type = "button", className = "" }: {
  children: ReactNode;
  variant?: "primary" | "amber" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const style = {
    primary: "bg-green text-white",
    amber: "bg-amber text-ink",
    ghost: "border-2 border-line bg-paper text-ink",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`press flex min-h-14 w-full items-center justify-center rounded-2xl px-5 text-lg font-bold shadow-card disabled:opacity-40 ${style} ${className}`}>
      {children}
    </button>
  );
}
