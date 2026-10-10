// Charts as inline SVG — no chart library. Each chart has an accessible summary,
// and values are printed as text, so colour is never the only signal.

import { formatINR } from "@/lib/money";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function Donut({ segments, size = 152, thickness = 22, center }: { segments: DonutSegment[]; size?: number; thickness?: number; center?: React.ReactNode }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={segments.map((s) => `${s.label} ${formatINR(s.value)}`).join(", ")}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-surface)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
    </div>
  );
}

export interface DayBar {
  key: string;
  label: string;
  earned: number;
  swept: number;
  today: boolean;
}

/** Earned (light) with the swept part (dark) inside it; today's swept bar in amber. */
export function DailyBars({ days, height = 150, summary }: { days: DayBar[]; height?: number; summary: string }) {
  const max = Math.max(1, ...days.map((d) => d.earned));
  const w = 100 / days.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={summary}>
      {days.map((d, i) => {
        const eh = (d.earned / max) * (height - 4);
        const sh = (d.swept / max) * (height - 4);
        const x = i * w + w * 0.15;
        const bw = w * 0.7;
        return (
          <g key={d.key}>
            <title>{`${d.label}: ${formatINR(d.earned)} / ${formatINR(d.swept)}`}</title>
            <rect x={x} y={height - eh} width={bw} height={eh} rx={0.8} fill="var(--primary-green-tint)" stroke={d.today ? "var(--accent-amber-ink)" : "none"} strokeWidth={d.today ? 0.4 : 0} />
            <rect x={x} y={height - sh} width={bw} height={sh} rx={0.8} fill={d.today ? "var(--accent-amber)" : "var(--primary-green)"} />
          </g>
        );
      })}
    </svg>
  );
}

export interface CohortWeek {
  key: string;
  label: string;
  pilot: number | null;
  control: number | null;
}

/** Grouped bars: pilot vs control on-time rent rate per week. */
export function CohortBars({ weeks, height = 220 }: { weeks: CohortWeek[]; height?: number }) {
  const W = 600;
  const top = 26;
  const bottom = 28;
  const plot = height - top - bottom;
  const group = W / weeks.length;
  const bw = Math.min(46, group * 0.3);
  const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="w-full"
      role="img"
      aria-label={weeks.map((w) => `${w.label}: pilot ${pct(w.pilot)}, control ${pct(w.control)}`).join("; ")}
    >
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={0} x2={W} y1={top + plot * (1 - g)} y2={top + plot * (1 - g)} stroke="var(--border-color)" strokeDasharray={g === 0 ? undefined : "4 4"} />
          <text x={4} y={top + plot * (1 - g) - 4} fontSize={11} fill="var(--text-secondary)">{`${g * 100}%`}</text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const cx = group * i + group / 2;
        const bars: [number | null, string, number][] = [
          [w.pilot, "var(--primary-green)", cx - bw - 3],
          [w.control, "#8b8e99", cx + 3],
        ];
        return (
          <g key={w.key}>
            {bars.map(([v, color, x], j) => {
              const h = v === null ? 0 : v * plot;
              return (
                <g key={j}>
                  <rect x={x} y={top + plot - h} width={bw} height={h} rx={4} fill={color} />
                  <text x={x + bw / 2} y={top + plot - h - 6} fontSize={13} fontWeight={700} textAnchor="middle" fill="var(--text-primary)">
                    {pct(v)}
                  </text>
                </g>
              );
            })}
            <text x={cx} y={height - 8} fontSize={12} textAnchor="middle" fill="var(--text-secondary)">
              {w.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
