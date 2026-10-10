# Gmoney — gig worker money app (MVP)

A pilot-grade PWA for Indian delivery and bike-taxi riders. Every payout is split:
the day's **petrol + food floor** stays spendable, and the surplus is swept into
**rent → emergency → savings** pots. When a payout lands and rent is due within 3 days,
the app says *“₹1,420 अभी आया। किराया ₹2,450 अभी भेज दो?”* and opens the rider's own UPI
app in one tap. A separate fleet dashboard proves the effect: on-time rent, **pilot vs
control**.

*Gmoney* is a working name — change `APP_NAME` in `lib/config.ts`.

## Hard rules this code is built around

We never hold or route money (UPI intents only) · pots are a ledger, not a fund · no
lending of any kind · no SMS or notification reading · rent stays liquid · the rider is
never charged · operators see rent paid / late / missed and nothing else, enforced by
row-level security · honest copy (never “instant”). See SPEC §2 and
[`docs/DECISIONS.md`](docs/DECISIONS.md), which also records how the SPEC and the
frontend prompt were merged.

## Run it

Requires Node 18.18+ (tested on Node 22).

```bash
npm install
npm run dev          # http://localhost:3000
```

Production build (what Lighthouse was run against):

```bash
npm run build && npm start
```

**Desktop works too.** At 1024px and wider the rider app switches to a website layout: a left sidebar with the main actions, navigation and English/हिंदी switch, two- and three-column pages, centred dialogs instead of bottom sheets, and full keyboard entry on the amount keypads. Phones keep the thumb-first layout with the bottom tab bar.

Open on a phone on the same Wi-Fi via `http://<your-computer's-LAN-IP>:3000`. Chrome
only offers “Install app” over HTTPS, so deploy to Vercel to test installation.

### Demo walkthrough (5 minutes)

1. `/` opens in **English** as **Ravi**, a seeded pilot rider with 30 days of history. His
   rent is due in two days and his rent pot is full. Tap **हिंदी** (top right) or
   Settings → Language to switch to Hindi.
2. **+ Payment came** → type `1420` → Rapido → **Add**. You see the split: floor first,
   then each pot.
3. Back on Home: the **rent nudge**. **Yes, send now** hands off to a UPI intent (a fake
   `@example` payee, so nothing can be paid). Answer **Did you send it? → Yes**. Rent is now
   recorded as *paid on time — rider-reported*.
4. **Sudden expense?** → log a shock in three taps.
5. **Pots** → withdraw → “Money in your bank by tomorrow”.
6. `/operator` (code **QRDEMO**) → pilot vs control on-time rent, with Ravi's payment
   marked *rider-reported*. **Received** makes it authoritative. **Export CSV**.
7. Settings → **Start as a new rider** runs onboarding (S7). In demo mode the OTP is shown on
   screen. **Restart the demo** restores Ravi.

## Test

```bash
npm test             # 142 tests
npm run typecheck
npm run lint
```

- `tests/sweep.test.ts`: every SPEC §5 edge case (bad day, partial floor, big first
  payout, ₹20 minimum and carry, 4am boundary, rounding, cash, backdated and
  idempotent), plus property tests.
- `tests/ledger.test.ts`: pot balance = Σ allocations − Σ withdrawals, property-tested.
- `tests/rls.test.ts`: runs the **real migrations on real Postgres** (PGlite, in
  process) with a Supabase `auth.uid()` shim.
  - Riders see only their own rows.
  - Operators can't read `payouts`, `pots`, `allocations`, `withdrawals`,
    `shock_events`, `spends`, `nudges` or `consents`, with one explicit test each.
  - Operators read `rent_events` only with a live consent. Withdrawing consent hides it
    immediately, and savings keep working.
  - Pot balances are trigger-maintained and can never go negative.
- `tests/store.test.ts`: every rider action (S2–S7) as pure functions.
- `tests/seed.test.ts`: the seed obeys the sweep engine, and `seed.sql` loads into the
  real schema.
- `tests/operator.test.ts`: the HR-7 projection carries no money fields.

## Seed

```bash
npm run seed                 # supabase/seed.sql: 1 operator, 25 pilot + 25 control riders, 30 days
npm run seed -- --purge      # supabase/purge-seed.sql: removes every seeded rider
```

Every seeded row is `entry_method = 'seed'` or belongs to a seeded rider. The browser
demo uses the same deterministic generator, so it never opens empty. The full 50-rider
file (≈7k payouts, ≈13k allocations) loads with every pot balance matching its ledger.

## Database (Supabase) — not provisioned yet

HR-7 requires confirming the **India region (ap-south-1)** before a project is created,
so none was. When you're ready:

```bash
npx supabase link --project-ref <ref>     # a project created in ap-south-1 (Mumbai)
npx supabase db push                      # applies supabase/migrations
npm run seed && psql "$DATABASE_URL" -f supabase/seed.sql
```

Until then the rider's ledger lives in the browser (`localStorage`), and phone OTP and
operator login run in clearly labelled demo mode. `docs/DECISIONS.md` §5 lists what
switches on with the database.

## Deploy (Vercel)

```bash
npx vercel            # preview
npx vercel --prod
```

The demo build needs no environment variables.

## Layout

```
app/(rider)/         rider PWA: home (S1), payout (S2), pots (S3), shock (S5), hisab, settings (S6), onboarding (S7)
app/operator/        fleet dashboard (§7), desktop-first
components/          hand-built UI primitives, SVG charts, rent nudge (S4), app shell
lib/sweep.ts         the sweep engine — pure functions, integer paise
lib/ledger.ts        replay / recompute, pot balances, day summary
lib/rent.ts          rent cycle, nudge trigger, UPI intent builder
lib/store/           rider actions (pure) + device persistence
lib/operator.ts      HR-7 projection + pilot/control comparison
lib/seed.ts          deterministic seed generator
lib/strings.ts       all copy — English default, Hindi switchable (review sheet: docs/HINDI-REVIEW.md)
supabase/migrations/ schema, ledger triggers, RLS, RPCs
tests/               vitest + fast-check + PGlite
```

## Status against SPEC §9

| Milestone | Status |
|---|---|
| 1. Schema + sweep engine + tests | ✅ |
| 2. Rider PWA: S1, S2, S3, S7 | ✅ Ledger on-device; phone OTP in demo mode until Supabase exists |
| 3. Nudge (S4) + shock log (S5) | ✅ UPI intents, rider vs operator reports, local notifications |
| 4. Operator dashboard + RLS tests | ✅ All eight “operator cannot read” denial tests |
| 5. Fund rail / KYC / credit | ⛔ Not started (by design) |

**Lighthouse** (production build): mobile performance 97–99 and desktop 100; accessibility
100 and best practices 100 on both; CLS 0. First Load JS 130 KB.

**Before merging:** review the Hindi in [`docs/HINDI-REVIEW.md`](docs/HINDI-REVIEW.md)
(18 strings flagged), and answer the open questions in `docs/DECISIONS.md` §2.
