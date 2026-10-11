# Sambhal design system

Source of truth: `app/globals.css` (tokens) and `components/ds.tsx` (components). Light only.

## Principles
- Every screen answers: **Kitna hai? Kitna safe hai? Kahan gaya?**
- One primary action per screen (lime fill, ink text), in the thumb zone.
- Any money movement shows **amount + direction + destination** in a ConfirmSheet before it happens.
- One language at a time (Hindi default, English toggle). The app opts out of browser translation.
- Banned words: floor, swept, held, payout. Use: set aside, moved to your pots, payment received.
- Numbers beat words: "₹1,750 of ₹2,500", never "70%".

## Colour (signal logic)
| Role | Token | Use |
|---|---|---|
| Safe money | `green-600/700/800`, `green-50/100` | Safe-to-spend number, pot progress, positive amounts |
| Set aside | `amber-600/700`, `amber-50/100` | Petrol + food (essentials), "arrives tomorrow" notes |
| Shortfall | `red-600/700`, `red-50/100` | Spent past today's essentials, errors |
| Primary action | `lime` (#D4E9A0) + `ink` text | Only the primary button |
| Neutrals | `canvas`, `card`, `surface`, `ink`, `ink-2`, `muted`, `line`, `line-strong` | Page, cards, text, dividers, input borders |

All text pairs are ≥ 4.5:1 (values in `globals.css` comments). Input borders (`line-strong`) are 3.9:1.

## Type
- **Inter** for Latin text and every number (tabular figures); **Noto Sans Devanagari** for Hindi.
- Money: `.money` (tabular) and `.money-hero` (tight); hero 56–64px extra bold, ₹ with Indian grouping.
- Body 16px; secondary 14px; nothing under 12px. Hindi gets 1.6 line height.

## Space & shape
- 4/8pt grid; screen gutter 16px; card padding 16–20px.
- Radius: cards 20px, sheets 24px, buttons and keys 16px, chips full.
- Touch targets ≥ 48px (primary 56px, nav 64px).

## Components (`components/ds.tsx`)
`Money`, `BigNumber`, `MoneyCard`, `SectionTitle`, `Progress`, `Ring`, `PotGlyph`, `PotCard`,
`PrimaryButton`, `SecondaryButton`, `TextButton`, `Chip`, `TransactionRow`, `TrustBadge`, `EmptyState`,
`Sheet`, `ConfirmBody` (ConfirmSheet), `Keypad`, `AmountDisplay`, `ToastHost` (with Undo), `SkeletonScreen`.

## Motion
150–250ms, state changes only: screen rise 200ms, sheet 240ms, money rows flow into pots 220ms
(staggered), press scale 120ms. Everything collapses under `prefers-reduced-motion`.
