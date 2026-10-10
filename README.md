# Sambhal · संभल

A money app for Indian gig workers. A rider names a daily running cost (petrol and food,
₹300). Everything he earns above that is swept into three pots: **Bike & Repairs,
Emergency, Savings**. After about 90 days of saving, the record becomes his credit file,
and a partner NBFC lends against it.

This is a 2-hour demo build (the master prompt, Step 1–4). Everything runs in the browser.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # sweep cases, rounding property tests, state
npm run build        # production build
```

Open the app on a phone-width window (360–430 px). On desktop it shows as a phone-width
column, centred.

## What's in the demo

- **घर / Home:** the hero number "आज खर्च कर सकते हो ₹300" (safe to spend), earned today,
  floor held back and swept. Three pot cards. Two buttons: **पेमेंट आया / Payment came**
  and **खर्च हुआ / I spent**.
- **Payment came:** a keypad, a source (Rapido, Zepto, Swiggy, Blinkit, कैश), and an
  animated split showing where every rupee went. A payout that doesn't reach the floor
  says so: nothing is swept.
- **गुल्लक / Pots:** total saved, each pot's progress, today's payments, and 30 days of
  savings.
- **लोन / Loan:** the 90-day streak ring, total saved, average daily earnings and days
  worked, **₹8,000 तक लोन मिल सकता है** as eligibility, the partner-NBFC line, and an
  illustrative comparison (₹500 vs ₹150 a month).

## The rules the code keeps

- **The floor is never swept.** `sweep()` fills the floor first, and only the surplus is
  split.
- **Split of the surplus:** 20% emergency, 30% savings, and the rest (about 50%) to bike
  & repairs. Rounding goes to bike & repairs, so the parts always add up to the surplus.
- **We never hold money.** Pots are labels on money in the rider's own account.
- **We never lend.** The credit screen shows eligibility and names the NBFC. There is no
  apply, disburse or repay action.
- **No SMS reading, no permission requests.** Payouts are logged by tapping.
- **No backend, no database, no login.** State lives in React, seeded from
  `lib/seed.ts`. A reload starts the demo over.

## Layout

```
lib/sweep.ts         the sweep: pure, integer paise
lib/state.ts         the reducer: payout, spend, safe-to-spend
lib/seed.ts          opening state (₹730 earned today, pots), 30-day history
lib/config.ts        floor, payout sources, credit inputs (demo figures)
lib/money.ts         paise → ₹ formatting
lib/store.tsx        in-memory store
components/          App shell, Home, Pots, Loan, PayoutSheet, SpendSheet, ui
tests/sweep.test.ts  the prompt's cases, rounding property, state behaviour
```

## Notes for the demo

- The credit figures (streak 74/90, ₹8,000 eligibility, ₹1,050 average) are constants in
  `lib/config.ts`, so the pitch is the same every time.
- Hindi is primary, English is the small subtext on every label.
- Deploy only after you've checked the live URL on a real phone. Nothing is deployed yet.
