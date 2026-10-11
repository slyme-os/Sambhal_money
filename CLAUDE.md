# Sambhal — project guide for Claude

Savings app for Bengaluru gig riders (Rapido, Swiggy, Zomato, Uber, Zepto). Every payment:
set aside daily essentials (petrol + food) first, sweep the extra into pots. Savings build
loan *eligibility* with a partner NBFC. Money always stays in the rider's own bank account.

Branch: `feat/gmoney-mvp`. Remote: `slyme-os/sambhal_money` (moved to `Sambhal_money`; push works).

## Non-negotiable rules (legal + trust)
- **Sambhal does not lend.** The line "The loan comes from a partner NBFC. Sambhal does not lend."
  stays on the Loan screen in every language. No apply / repay / disburse action anywhere.
- Loan screen shows eligibility only ("eligibility can build up", "not an offer"). ₹8,000 figure
  is CEO-approved with that wording. No repayment terms until a real NBFC + legal review.
- `LENDER_COMPARISON` in `lib/config.ts` stays `null` unless figures are sourced (with a source line).
- No return, yield or growth claims, ever.
- Daily essentials (default ₹300) are never moved to pots.
- Every money movement shows amount + direction + destination before confirming (ConfirmBody).
- SMS: opt-in, consent shown before the permission prompt, nothing added until the rider taps Add,
  SMS text never stored or uploaded (only parsed fields), turning off deletes captured data.
- Demo ribbon stays until real release (all figures are sample data).

## Commands
```bash
npm test              # vitest (56 tests: sweep, ledger, i18n, SMS parser, SMS inbox)
npx tsc --noEmit      # typecheck
npx eslint components lib app tests
npm run build         # web build
npm run build:web     # static export to out/ (what the APK bundles)
npm run android:sync  # build:web + cap sync android
```
Run tests + typecheck + lint before every commit. The Android SDK cannot be downloaded in the
cloud sandbox (dl.google.com is blocked): **APKs are built by GitHub Actions** (`.github/workflows/android.yml`).

## Architecture
- Next.js 15 + React 19 + Tailwind v4, fully client-side. Capacitor 8 wraps the static export for Android.
- `lib/sweep.ts` — pure sweep: floor first, extra split 20% emergency / 30% savings / rest bike. Don't change without tests.
- `lib/ledger.ts` — the whole state as a ledger. Pot balances are **derived** (openings + allocations − withdrawals).
  Reducer is pure. Working day starts 4 AM IST (`lib/time.ts`). Adding/removing a payment replays the day (`recomputeDay`).
- `lib/store.tsx` — context, localStorage persistence (`sambhal:v1`), rollover, toasts, SMS scanning, `smsMode`.
- `lib/i18n/` — 8 languages (kn, hi, en, ta, te, ml, bn, or). `en.ts` is the source of truth; every language must have
  every key with identical `{placeholders}` (enforced by `tests/i18n.test.ts`). One language at a time; app opts out of
  browser translation. Banned words in copy: floor, swept, held, payout.
- `lib/smsParse.ts` — bank/UPI SMS → `{direction, amountPaise, counterparty, source|category, ref}`; `lib/sms.ts` bridge.
- `components/ds.tsx` — design system (Money, BigNumber, MoneyCard, PotCard, buttons, Chip, TransactionRow, Sheet,
  ConfirmBody, Keypad, Toast…). Screens in `components/screens/`, sheets in `components/sheets/`.
- Design tokens in `app/globals.css`; rules in `docs/DESIGN.md`. Android/Play steps in `docs/ANDROID.md`.

## Design rules
- Modern luxury: light canvas, night-forest `lux-card` heroes, lime `#DDF76A` accent (primary button, active tab,
  hero numbers on dark), slime `#8EDB4F` for money in, amber = set aside, coral/red = shortfall.
- One primary button per screen; tap targets ≥ 48px; works at 360px; text contrast ≥ 4.5:1; lime never as text on light.
- **Old Android WebViews (BlueStacks):** no Tailwind `translate-*`/`rotate-*`, `dvh`, opacity modifiers (`/40`), or
  Tailwind gradient utilities. Use plain CSS classes in `globals.css`. Tailwind scans only `app/ components/ lib/`.
- Fonts: variables must sit on `<html>` (they did not work on `<body>`). Inter + Noto per script.
- Next's minifier once dropped a closure variable when inlining (`sampleSms`); avoid inner closures over params in small exported helpers.

## Android
- Flavors: **sideload** (APK installed from a file; no SMS permission because Play Protect blocks sideloaded apps
  asking for SMS; SMS arrives via Share → Sambhal) and **play** (adds `READ_SMS` in `android/app/src/play/AndroidManifest.xml`).
- Native plugin: `android/app/src/main/java/app/sambhal/money/SmsInboxPlugin.java` (registered in `MainActivity`).
- Fixed debug key `android/app/sambhal-debug.keystore` (committed, debug only) so APKs update in place.
- CI artifacts: `sambhal-apk-<n>` (install this) and `sambhal-play-debug-apk-<n>` (testing only).
- App ID `app.sambhal.money` (permanent once on Play).

## Working style (keep token use low)
- Make the change, run the checks, commit, push. Don't take screenshots or schedule check-ins unless asked.
- Commit and push finished work to `feat/gmoney-mvp` (a stop hook requires a clean, pushed tree).
- Ask only for real product/legal decisions; make design calls yourself and say what you chose.

## Open items
- Native-speaker review of kn/ta/te/ml/bn/or translations (money + Loan wording).
- Real-phone test of SMS capture (play build) and Share → Sambhal (sideload build).
- Before release: remove demo ribbon + sample data (`seedState`), replace `CREDIT` figures, Play declarations
  (SMS permissions form, financial features / NBFC details, privacy policy, Data safety).
