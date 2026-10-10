# Decisions log

What was decided while building the MVP, and why. Everything here is reversible; the
open questions at the bottom are the ones only you can answer.

## 1. Two prompts, one product

Two briefs went in: **SPEC.md** (product, legal hard rules, stack, data model, milestones)
and the **frontend master prompt** (visual system, components, interaction rules). Where
they agreed, both were followed. Where they conflicted, **SPEC wins on anything legal or
architectural; the frontend prompt wins on look and feel.**

| Topic | Frontend prompt said | SPEC said | Built |
|---|---|---|---|
| Framework | React 18 + Vite | Next.js 15 App Router PWA — “do not substitute” | **Next.js 15 PWA** |
| Visual system | Green `#0C831F` / amber / red / purple tokens as CSS variables, Inter, “Energetic Pragmatism”, no component library | Big numbers, few words, sunlight-readable | **The prompt's token system**, as CSS variables in `app/globals.css`; secondary grey darkened to `#5B5E6B` for outdoor contrast |
| Animation | Framer Motion | First load < 200 KB JS, minimal deps | **CSS animations** (fade + 8px slide 200ms, sheet spring, press 0.97, staggered sweep drop). First Load JS is **130 KB** |
| Fonts | Inter, 5 weights | — | Inter **3 weights** (the prompt's own constraint), Devanagari from the system font every Android ships |
| Home hero | “Today's earnings” + “Sweep Now” button | **“आज खर्च कर सकते हो ₹X”**; sweep happens automatically per payout | **SPEC hero** in the prompt's green card. No manual sweep button — the sweep *is* logging a payout |
| Pots | Rent, Emergency, Bike Service, Phone EMI | `rent`, `emergency`, `savings` (UNIQUE per rider) | **SPEC's three pots** |
| Shock mode | Emergency withdrawal + loan-vs-pot comparison | Shock *log* with “how did you cover it” — the primary metric; **no lending UI** (HR-3) | **SPEC shock log**, plus an optional draw from the emergency pot. The loan comparison was dropped — showing loan pricing sits too close to HR-3 and HR-8 |
| Withdrawal ETA | “Money in your bank in 30 minutes” | **Never “instant”**; “कल तक / by next working day” (HR-8) | **“पैसा कल तक आपके बैंक में”** |
| Fleet screen | Riders' savings streaks, avg savings/week, “Top up ₹50 to Ravi's pot” | Operator sees **rent paid yes/no/late only** (HR-7); never move money (HR-1); no gamification (§12) | **SPEC operator dashboard**: pilot-vs-control on-time chart, name/phone/on-time streak/last status, mark received, CSV in/out |
| Streak badge “🔥 7-day streak” | Yes | No gamification until the core is proven (§12) | **Not built** for riders. Operators see an on-time *rent* streak (a fact, not a reward) |
| Insights | Income donut, platform ledger, savings trend | Nothing forbids history; growth/returns charts are forbidden | **हिसाब screen**: 14-day earned vs set-aside bars, income by platform, rent record, shocks. Ledger facts only |
| Voice button | Mock mic with fake “Listening…” | — | **Not built.** A mic that does nothing would mislead low-literacy users. Real voice entry (Web Speech, `hi-IN`) is a good next step |
| Dark mode | No | Respect the system setting at most | Light only |
| Language | EN + HI toggle | Hindi first, written as riders speak; `hi`/`kn`/`en` | **English by default (your call, overriding SPEC)**; Hindi one tap away — the हिंदी button on Home, Settings → Language, and the first onboarding step. Kannada slot reserved |

## 2. SPEC §11 questions — defaults taken (please confirm)

SPEC says to ask these before starting. You asked me to build it all, so I took the
safe default for each and kept it easy to change.

1. **Operator partner / real rent and VPA?** Not known → a clearly fake fleet,
   **“QuickRide EV (Demo)”**, code `QRDEMO`, payee `quickride.rent.demo@example`. The
   `@example` handle cannot exist, so a demo UPI intent can never pay a real person.
   Seeded phone numbers start `+91 0…`, which no Indian mobile number does.
2. **Should control riders see the app?** Default: yes, the savings app **without
   nudges** (SPEC §7: “gets no nudges but is still tracked”). Constant
   `CONTROL_SEES_APP` in `lib/config.ts`. The rent card's “pay now” button is also
   pilot-only, so control riders aren't prompted by the side door.
3. **Hindi or Kannada first?** You chose **English as the default**, with Hindi as the switchable option. Kannada strings are not written (see
   `docs/HINDI-REVIEW.md`).
4. **App name?** Working name **Gmoney** (your folder name), defined once as `APP_NAME`
   in `lib/config.ts`.
5. **Supabase region / billing?** **Not provisioned.** HR-7 requires confirming
   ap-south-1 first. The schema, RLS and seed are written and tested locally against
   real Postgres (PGlite); the running app stores the ledger on the device until the
   project exists.

## 3. Schema additions (beyond SPEC §4)

All are additive and covered by tests.

- `spends` — S1's safe-to-spend needs “spent today”; SPEC has no table for it.
- `riders.rent_share_bp`, `emergency_share_bp`, `emergency_target_paise` — S6 lets the
  rider change the split; it has to be stored.
- `riders.entry_method` — so `npm run seed -- --purge` can remove seeded riders.
- `operators.code`, `operators.payee_vpa`, `operator_members` — onboarding's
  “operator code” step, the default UPI payee, and mapping auth users to operators.
- `rent_agreements.payee_name` — the `pn` field of the UPI intent.
- `rent_events.rider_report`, `rider_reported_at`, `operator_report`,
  `operator_reported_at` — SPEC S4 wants the rider's self-report and the operator's
  authoritative report distinguishable “in the data, not hidden”. `status` is derived
  by trigger: operator report, else rider report, else due/missed.

## 4. Sweep engine interpretations

- **Rounding.** “Give any remainder to the rent pot”: the rent share (70%) is
  *rounded up*, so its paise remainder goes to rent. Within the 40/60
  emergency/savings split, emergency rounds down and savings takes the rest. Rent never
  gets more than its cycle target. Sum of allocations = surplus exactly
  (property-tested, 2,000 random cases).
- **Rent cycle target** = the instalment amount. After rent is paid the pot drops and
  the target re-opens for the next cycle, so rent is never overfunded.
- **Sub-₹20 carry** carries to the next payout *of the same working day* and resets at
  the 4am boundary.
- **Backdated payouts** recompute from the affected working day onwards (not just that
  day), because later days' pot balances depend on it. Earlier days stay frozen.
- **Floor changes** apply from today; history is not rewritten.

## 5. Things that need the database to be real

These work end-to-end in the demo and are fully specified in SQL, but run on-device
until Supabase is provisioned:

- **Phone OTP** — onboarding shows a labelled demo code instead of sending an SMS.
- **Operator login** — demo code `QRDEMO`; production uses Supabase Auth +
  `operator_members`, and RLS scopes the operator to his fleet.
- **Operator ↔ rider sync** — today they share one browser's storage. Rent marked
  “received” on `/operator` flows into the on-device rider; the other 49 riders are
  generated.
- **Push notifications** — local notifications fire when the rider allows them; true
  web push (server → phone while the app is closed) needs a VAPID key and a sender.

## 6. Not built, on purpose

Lending/advances/credit (HR-3), SMS or notification reading (HR-4), wallets or holding
money (HR-1), investment returns (HR-2), rider fees (HR-6), gamification, an admin
panel, a marketing site — SPEC §12.
