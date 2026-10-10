-- Gig worker money app — core schema (SPEC §4).
-- Money is integer paise in bigint, never floats, never rupees.
-- HR-1/HR-2: pots are a ledger. No table here holds or routes money.
-- HR-3: no lending tables, columns or functions exist, by design.
-- HR-7: no Aadhaar, biometrics or document images are stored.

-- gen_random_uuid() is built into Postgres 13+; no extension needed.

-- ─── Operators (the paying customer) ───────────────────────────────────────────
create table public.operators (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  city          text not null,
  contact_name  text,
  contact_phone text,
  -- Addition: the code a rider types at onboarding to join this fleet.
  code          text not null unique,
  -- Addition: default UPI payee for rent; copied onto each rent agreement.
  payee_vpa     text,
  created_at    timestamptz not null default now()
);

-- Addition: maps a Supabase auth user to the operator account they act for.
create table public.operator_members (
  auth_user_id uuid primary key,
  operator_id  uuid not null references public.operators (id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- ─── Riders ────────────────────────────────────────────────────────────────────
create table public.riders (
  id                     uuid primary key default gen_random_uuid(),
  auth_user_id           uuid unique,
  name                   text not null,
  phone                  text not null,
  operator_id            uuid references public.operators (id),
  city                   text not null default 'Bengaluru',
  language               text not null default 'hi' check (language in ('hi', 'kn', 'en')),
  floor_paise            bigint not null default 30000 check (floor_paise >= 0),
  cohort                 text not null check (cohort in ('pilot', 'control')),
  -- Addition: S6 lets the rider change split percentages; stored in basis points.
  rent_share_bp          integer not null default 7000 check (rent_share_bp between 0 and 10000),
  emergency_share_bp     integer not null default 4000 check (emergency_share_bp between 0 and 10000),
  emergency_target_paise bigint not null default 300000 check (emergency_target_paise >= 0),
  entry_method           text not null default 'manual' check (entry_method in ('manual', 'csv', 'seed')),
  onboarded_at           timestamptz,
  created_at             timestamptz not null default now()
);
create index riders_operator_idx on public.riders (operator_id);

-- ─── Consent (DPDP, HR-7) ──────────────────────────────────────────────────────
-- Each grant is a row; withdrawing sets withdrawn_at. Re-granting inserts a new
-- row, so the full history with versions and timestamps is kept.
create table public.consents (
  id           uuid primary key default gen_random_uuid(),
  rider_id     uuid not null references public.riders (id) on delete cascade,
  purpose      text not null check (purpose in ('app_use', 'operator_share')),
  granted      boolean not null,
  version      text not null,
  granted_at   timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index consents_rider_purpose_idx on public.consents (rider_id, purpose);

-- ─── Income and spend ──────────────────────────────────────────────────────────
create table public.payouts (
  id           uuid primary key default gen_random_uuid(),
  rider_id     uuid not null references public.riders (id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  source       text not null check (source in ('rapido', 'zepto', 'swiggy', 'blinkit', 'cash', 'other')),
  occurred_at  timestamptz not null,
  entry_method text not null check (entry_method in ('manual', 'csv', 'seed')),
  created_at   timestamptz not null default now()
);
create index payouts_rider_time_idx on public.payouts (rider_id, occurred_at);

-- Addition: S1 needs "spent today" to compute safe-to-spend.
create table public.spends (
  id           uuid primary key default gen_random_uuid(),
  rider_id     uuid not null references public.riders (id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  occurred_at  timestamptz not null,
  entry_method text not null check (entry_method in ('manual', 'csv', 'seed')),
  created_at   timestamptz not null default now()
);
create index spends_rider_time_idx on public.spends (rider_id, occurred_at);

-- ─── Pots: a ledger, not a fund (HR-2) ─────────────────────────────────────────
create table public.pots (
  id            uuid primary key default gen_random_uuid(),
  rider_id      uuid not null references public.riders (id) on delete cascade,
  kind          text not null check (kind in ('rent', 'emergency', 'savings')),
  label_hi      text not null,
  label_en      text not null,
  -- Maintained by triggers below; always SUM(allocations) − SUM(live withdrawals).
  balance_paise bigint not null default 0 check (balance_paise >= 0),
  target_paise  bigint check (target_paise is null or target_paise >= 0),
  created_at    timestamptz not null default now(),
  unique (rider_id, kind)
);

create table public.allocations (
  id           uuid primary key default gen_random_uuid(),
  payout_id    uuid not null references public.payouts (id) on delete cascade,
  pot_id       uuid not null references public.pots (id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  created_at   timestamptz not null default now()
);
create index allocations_pot_idx on public.allocations (pot_id);
create index allocations_payout_idx on public.allocations (payout_id);

create table public.withdrawals (
  id           uuid primary key default gen_random_uuid(),
  pot_id       uuid not null references public.pots (id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  reason       text not null check (reason in ('rent', 'emergency', 'user', 'correction')),
  status       text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  requested_at timestamptz not null default now(),
  settled_at   timestamptz
);
create index withdrawals_pot_idx on public.withdrawals (pot_id);

-- ─── Rent ──────────────────────────────────────────────────────────────────────
create table public.rent_agreements (
  id           uuid primary key default gen_random_uuid(),
  rider_id     uuid not null references public.riders (id) on delete cascade,
  operator_id  uuid not null references public.operators (id),
  amount_paise bigint not null check (amount_paise > 0),
  cadence      text not null check (cadence in ('daily', 'weekly')),
  due_weekday  smallint check (due_weekday between 0 and 6),
  next_due_on  date not null,
  payee_vpa    text not null,
  -- Addition: shown as `pn` in the UPI intent.
  payee_name   text not null,
  active       boolean not null default true,
  check (cadence = 'daily' or due_weekday is not null)
);
create index rent_agreements_rider_idx on public.rent_agreements (rider_id);
create index rent_agreements_operator_idx on public.rent_agreements (operator_id);

-- The rider's self-report and the operator's report are separate columns so the
-- provisional signal is never mistaken for the authoritative one. `status` is
-- derived by trigger: operator report, else rider report, else what the job set.
create table public.rent_events (
  id                   uuid primary key default gen_random_uuid(),
  rent_agreement_id    uuid not null references public.rent_agreements (id) on delete cascade,
  due_on               date not null,
  amount_paise         bigint not null check (amount_paise > 0),
  status               text not null default 'due'
                         check (status in ('due', 'paid_on_time', 'paid_late', 'missed')),
  paid_at              timestamptz,
  method               text check (method in ('upi_intent', 'manual_confirm', 'operator_reported')),
  rider_report         text check (rider_report in ('paid_on_time', 'paid_late', 'missed')),
  rider_reported_at    timestamptz,
  operator_report      text check (operator_report in ('paid_on_time', 'paid_late', 'missed')),
  operator_reported_at timestamptz,
  unique (rent_agreement_id, due_on)
);

create table public.nudges (
  id           uuid primary key default gen_random_uuid(),
  rider_id     uuid not null references public.riders (id) on delete cascade,
  kind         text not null,
  sent_at      timestamptz not null default now(),
  acted_at     timestamptz,
  dismissed_at timestamptz,
  context_json jsonb not null default '{}'::jsonb
);
create index nudges_rider_idx on public.nudges (rider_id, sent_at);

-- The primary success metric: did a shock get covered without borrowing?
create table public.shock_events (
  id           uuid primary key default gen_random_uuid(),
  rider_id     uuid not null references public.riders (id) on delete cascade,
  description  text not null default '',
  amount_paise bigint not null check (amount_paise >= 0),
  covered_by   text not null check (covered_by in ('pot', 'borrowed', 'unpaid', 'other')),
  occurred_at  timestamptz not null default now()
);
create index shock_events_rider_idx on public.shock_events (rider_id, occurred_at);

-- ─── Ledger integrity ──────────────────────────────────────────────────────────

-- An allocation must move a payout into a pot of the same rider.
create function public.check_allocation_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select rider_id from public.payouts where id = new.payout_id)
     is distinct from (select rider_id from public.pots where id = new.pot_id) then
    raise exception 'allocation payout and pot belong to different riders';
  end if;
  return new;
end $$;

create trigger allocations_owner before insert or update on public.allocations
  for each row execute function public.check_allocation_owner();

-- Keep pots.balance_paise equal to SUM(allocations) − SUM(non-cancelled withdrawals).
-- The balance check constraint (>= 0) rejects any withdrawal that would overdraw.
create function public.apply_allocation_to_pot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.pots set balance_paise = balance_paise - old.amount_paise where id = old.pot_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.pots set balance_paise = balance_paise + new.amount_paise where id = new.pot_id;
  end if;
  return null;
end $$;

create trigger allocations_balance after insert or update or delete on public.allocations
  for each row execute function public.apply_allocation_to_pot();

create function public.apply_withdrawal_to_pot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.status <> 'cancelled' then
    update public.pots set balance_paise = balance_paise + old.amount_paise where id = old.pot_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.status <> 'cancelled' then
    update public.pots set balance_paise = balance_paise - new.amount_paise where id = new.pot_id;
  end if;
  return null;
end $$;

create trigger withdrawals_balance after insert or update or delete on public.withdrawals
  for each row execute function public.apply_withdrawal_to_pot();

create function public.derive_rent_status() returns trigger
language plpgsql as $$
begin
  new.status := coalesce(new.operator_report, new.rider_report, new.status);
  return new;
end $$;

create trigger rent_events_status before insert or update on public.rent_events
  for each row execute function public.derive_rent_status();
