# Sambhal design system

Source of truth: `app/globals.css` (tokens) and `components/ds.tsx` (components). Light only.

## Principles
- Every screen answers: **Kitna hai? Kitna safe hai? Kahan gaya?**
- One primary action per screen (lime fill, ink text), in the thumb zone.
- Any money movement shows **amount + direction + destination** in a ConfirmSheet before it happens.
- One language at a time (Hindi default, English toggle). The app opts out of browser translation.
- Banned words: floor, swept, held, payout. Use: set aside, moved to your pots, payment received.
- Numbers beat words: "₹1,750 of ₹2,500", never "70%".

## Colour: modern luxury
Light canvas for reading, **night-forest hero surfaces** for the numbers that matter,
**lime yellow** as the signature accent and **slime green** for money moving in.

| Role | Token | Use |
|---|---|---|
| Hero surfaces | `.lux-card` (night → forest gradient, lime + slime glows, fine grain) | Safe to spend, pot totals, pot detail, chart, ring, eligibility, payment done |
| Signature accent | `lime` #DDF76A, `.lime-tile` gradient | Hero numbers on dark, primary button (with `.btn-glow`), active nav tab, selected chips, icon tiles |
| Money moving in | `slime` #8EDB4F, `.bar-lux` / `.bar-lux-dark` | "+₹ today" badges, chart bars, progress fills, ring gradient |
| Set aside | `amber-300` on dark, `amber-600/700` on light | Petrol + food (essentials) |
| Shortfall | `.lux-card-alert` + `coral` on dark, `red-600/700` on light | Spent past today's essentials |
| Chrome | `night` #0A1A11 (`.chrome-dark`) | Demo ribbon, floating nav, toasts, page frame behind the column |
| Neutrals | `canvas`, `card`, `surface`, `ink`, `ink-2`, `muted`, `line`, `line-strong` | Page, cards, text |

All text pairs ≥ 4.5:1 (lime on forest 12.9:1, night on lime 15:1; values in `globals.css`).
Lime is never text on a light background. Gradients, rings and the centred nav use plain
CSS (no `oklab`, `color-mix`, `translate`/`rotate` properties, `dvh`), so the app renders on
older Android WebViews (e.g. BlueStacks). Tailwind scans only `app/`, `components/`, `lib/`.

## Type
- **Inter** for Latin text and every number (tabular figures); **Noto Sans Devanagari** for Hindi.
- Money: `.money` (tabular) and `.money-hero` (tight); hero 56–64px extra bold, ₹ with Indian grouping.
- Body 16px; secondary 14px; nothing under 12px. Hindi gets 1.6 line height.

## Space & shape
- 4/8pt grid; screen gutter 16px; card padding 16–20px.
- Radius: cards 24px, sheets 28px, buttons and keys 16px, nav 22px, chips full.
- Touch targets ≥ 48px (primary 56px, nav 64px).

## Components (`components/ds.tsx`)
`Money`, `BigNumber`, `MoneyCard`, `SectionTitle`, `Progress`, `Ring`, `PotGlyph`, `PotCard`,
`PrimaryButton`, `SecondaryButton`, `TextButton`, `Chip`, `TransactionRow`, `TrustBadge`, `EmptyState`,
`Sheet`, `ConfirmBody` (ConfirmSheet), `Keypad`, `AmountDisplay`, `ToastHost` (with Undo), `SkeletonScreen`.

## Motion
150–250ms, state changes only: screen rise 200ms, sheet 240ms, money rows flow into pots 220ms
(staggered), press scale 120ms. Everything collapses under `prefers-reduced-motion`.
