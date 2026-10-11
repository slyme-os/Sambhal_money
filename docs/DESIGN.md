# Sambhal design system

Source of truth: `app/globals.css` (tokens) and `components/ds.tsx` (components). Light only.

## Principles
- Every screen answers: **Kitna hai? Kitna safe hai? Kahan gaya?**
- One primary action per screen (lime fill, ink text), in the thumb zone.
- Any money movement shows **amount + direction + destination** in a ConfirmSheet before it happens.
- **8 languages, one at a time:** ಕನ್ನಡ, हिन्दी, English, தமிழ், తెలుగు, മലയാളം, বাংলা, ଓଡ଼ିଆ
  (Bengaluru's language first, then the languages most migrant riders speak). First launch opens
  on a language picker pre-selected from the phone's language; the header button and the options
  menu reopen it any time. Strings live in `lib/i18n/<code>.ts`; English is the source of truth and
  `tests/i18n.test.ts` checks every language has every key with the same `{placeholders}`.
  Each script has its own Noto Sans font, downloaded only when shown. The app opts out of browser
  translation.
- Banned words: floor, swept, held, payout. Use: set aside, moved to your pots, payment received.
- Numbers beat words: "₹1,750 of ₹2,500", never "70%".

## Colour: monochrome, one accent
Warm-neutral greys and near-black ink carry everything. **Lime #DDF76A is the only
colour**, so wherever it appears is where to look. Red appears only for a shortfall or an
error. Meaning never rides on colour alone: every row has an icon and words.

| Role | Token | Use |
|---|---|---|
| Hero surfaces | `.lux-card` (near-black gradient, one soft lime glow, fine grain) | Safe to spend, pot totals, pot detail, chart, ring, eligibility, payment done |
| The accent | `lime` #DDF76A, `.lime-tile` | Primary button (`.btn-glow`), active nav tab, selected chips, hero numbers on dark, today's chart bar, the eligibility tile |
| Icon tiles on light | `.chrome-dark` + `text-lime` | Stat icons, "How it works", SMS card, empty states |
| Progress | `.bar-lux` (ink) on light, `.bar-lux-dark` (lime) on dark | Pot goals, streak ring |
| Money in / set aside | ink-family greys (`green-*`, `amber-*`, `slime` are mapped to greys) | Rows and badges: icon + label say what it is |
| Shortfall / error | `.lux-card-alert` + `coral` on dark, `red-600/700` on light | Spent past today's essentials, over the cap, invalid input |
| Chrome | `night` #111111 (`.chrome-dark`) | Demo ribbon, floating nav, toasts, page frame |
| Neutrals | `canvas`, `card`, `surface`, `ink`, `ink-2`, `muted`, `line`, `line-strong` | Page, cards, text |

All text pairs ≥ 4.5:1 (lime on night 15:1, ink on lime 16:1; values in `globals.css`).
Lime is never text on a light background. Gradients, rings and the centred nav use plain
CSS (no `oklab`, `color-mix`, `translate`/`rotate` properties, `dvh`), so the app renders on
older Android WebViews (e.g. BlueStacks). Tailwind scans only `app/`, `components/`, `lib/`.

## Type
- **Inter** for Latin text and every number (tabular figures); **Noto Sans** Devanagari, Kannada, Tamil,
  Telugu, Malayalam, Bengali and Oriya for each script (font variables sit on `<html>`).
- Money: `.money` (tabular) and `.money-hero` (tight); hero 56–64px extra bold, ₹ with Indian grouping.
- Body 16px; secondary 14px; nothing under 12px. Every Indic script gets 1.6 line height.

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
