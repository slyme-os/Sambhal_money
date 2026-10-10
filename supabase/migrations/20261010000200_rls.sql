-- Row Level Security (SPEC §4, HR-7).
--
-- Riders read and write only their own rows. Operators read rent status — paid,
-- late or missed — for their own riders who have a live `operator_share` consent,
-- and nothing else. Operators have NO policy on payouts, spends, pots, allocations,
-- withdrawals, nudges, shock_events or consents, so RLS denies them by default.
-- tests/rls.test.ts asserts every one of those denials.

-- ─── Identity helpers ──────────────────────────────────────────────────────────
-- security definer so policies can look up identity without recursing into RLS.

create function public.current_rider_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.riders where auth_user_id = auth.uid()
$$;

create function public.current_operator_id() returns uuid
language sql stable security definer set search_path = public as $$
  select operator_id from public.operator_members where auth_user_id = auth.uid()
$$;

create function public.operator_share_granted(p_rider uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.consents
    where rider_id = p_rider and purpose = 'operator_share' and granted and withdrawn_at is null
  )
$$;

-- True when the current operator may see this rider's rent status.
create function public.operator_can_see_rider(p_rider uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.riders r
    where r.id = p_rider
      and r.operator_id is not null
      and r.operator_id = public.current_operator_id()
      and public.operator_share_granted(r.id)
  )
$$;

-- ─── Enable RLS everywhere ─────────────────────────────────────────────────────
alter table public.operators        enable row level security;
alter table public.operator_members enable row level security;
alter table public.riders           enable row level security;
alter table public.consents         enable row level security;
alter table public.payouts          enable row level security;
alter table public.spends           enable row level security;
alter table public.pots             enable row level security;
alter table public.allocations      enable row level security;
alter table public.withdrawals      enable row level security;
alter table public.rent_agreements  enable row level security;
alter table public.rent_events      enable row level security;
alter table public.nudges           enable row level security;
alter table public.shock_events     enable row level security;

-- ─── Privileges (column-level where RLS alone is not enough) ───────────────────
revoke all on all tables in schema public from anon;

-- Riders are created only through onboard_rider(), which assigns the cohort.
-- A rider can never change his cohort or operator himself.
revoke insert, update, delete on public.riders from authenticated;
grant update (name, language, city, floor_paise, rent_share_bp, emergency_share_bp, emergency_target_paise)
  on public.riders to authenticated;

-- Pot balances are maintained by triggers only.
revoke insert, update, delete on public.pots from authenticated;
grant update (target_paise) on public.pots to authenticated;

revoke update on public.allocations from authenticated;
revoke delete on public.consents, public.withdrawals from authenticated;
revoke update on public.consents from authenticated;
grant update (withdrawn_at) on public.consents to authenticated;
revoke update on public.withdrawals from authenticated;
grant update (status, settled_at) on public.withdrawals to authenticated;

-- Rent events change only through rider_report_rent() / operator_mark_rent().
revoke insert, update, delete on public.rent_events from authenticated;
revoke insert, update, delete on public.operators, public.operator_members from authenticated;

-- ─── Operators ─────────────────────────────────────────────────────────────────
create policy operators_member_read on public.operators for select to authenticated
  using (id = public.current_operator_id());
create policy operators_rider_read on public.operators for select to authenticated
  using (id = (select operator_id from public.riders where id = public.current_rider_id()));

create policy operator_members_self on public.operator_members for select to authenticated
  using (auth_user_id = auth.uid());

-- ─── Rider-owned tables ────────────────────────────────────────────────────────
create policy riders_self_read on public.riders for select to authenticated
  using (auth_user_id = auth.uid());
create policy riders_self_update on public.riders for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy consents_self on public.consents for all to authenticated
  using (rider_id = public.current_rider_id()) with check (rider_id = public.current_rider_id());

create policy payouts_self on public.payouts for all to authenticated
  using (rider_id = public.current_rider_id()) with check (rider_id = public.current_rider_id());

create policy spends_self on public.spends for all to authenticated
  using (rider_id = public.current_rider_id()) with check (rider_id = public.current_rider_id());

create policy pots_self on public.pots for all to authenticated
  using (rider_id = public.current_rider_id()) with check (rider_id = public.current_rider_id());

create policy allocations_self on public.allocations for all to authenticated
  using (pot_id in (select id from public.pots where rider_id = public.current_rider_id()))
  with check (pot_id in (select id from public.pots where rider_id = public.current_rider_id()));

create policy withdrawals_self on public.withdrawals for all to authenticated
  using (pot_id in (select id from public.pots where rider_id = public.current_rider_id()))
  with check (pot_id in (select id from public.pots where rider_id = public.current_rider_id()));

create policy nudges_self on public.nudges for all to authenticated
  using (rider_id = public.current_rider_id()) with check (rider_id = public.current_rider_id());

create policy shock_events_self on public.shock_events for all to authenticated
  using (rider_id = public.current_rider_id()) with check (rider_id = public.current_rider_id());

-- ─── Rent ──────────────────────────────────────────────────────────────────────
create policy rent_agreements_rider_read on public.rent_agreements for select to authenticated
  using (rider_id = public.current_rider_id());

-- Operators manage agreements (CSV upload) for riders in their own fleet.
create policy rent_agreements_operator_read on public.rent_agreements for select to authenticated
  using (operator_id = public.current_operator_id());
create policy rent_agreements_operator_insert on public.rent_agreements for insert to authenticated
  with check (
    rent_agreements.operator_id = public.current_operator_id()
    and exists (
      select 1 from public.riders r
      where r.id = rent_agreements.rider_id and r.operator_id = rent_agreements.operator_id
    )
  );
create policy rent_agreements_operator_update on public.rent_agreements for update to authenticated
  using (operator_id = public.current_operator_id())
  with check (operator_id = public.current_operator_id());

create policy rent_events_rider_read on public.rent_events for select to authenticated
  using (rent_agreement_id in (select id from public.rent_agreements where rider_id = public.current_rider_id()));

-- The one thing an operator may read about a rider: rent paid yes / no / late,
-- and only with a live operator_share consent.
create policy rent_events_operator_read on public.rent_events for select to authenticated
  using (exists (
    select 1 from public.rent_agreements a
    where a.id = rent_events.rent_agreement_id
      and a.operator_id = public.current_operator_id()
      and public.operator_can_see_rider(a.rider_id)
  ));

-- ─── RPCs ──────────────────────────────────────────────────────────────────────

-- S7 onboarding. Creates the rider, his three pots, the app-use consent, the
-- optional operator-share consent and the rent agreement. The cohort is assigned
-- here — balanced per operator — so the pilot/control comparison is not cherry-picked.
create function public.onboard_rider(
  p_name text,
  p_phone text,
  p_language text,
  p_operator_code text,
  p_floor_paise bigint,
  p_rent_amount_paise bigint,
  p_rent_cadence text,
  p_due_weekday smallint,
  p_consent_version text,
  p_operator_share boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_operator public.operators%rowtype;
  v_rider uuid;
  v_pilots int;
  v_controls int;
  v_cohort text;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_next date;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if public.current_rider_id() is not null then raise exception 'already onboarded'; end if;

  if p_operator_code is not null and p_operator_code <> '' then
    select * into v_operator from public.operators where code = upper(p_operator_code);
    if not found then raise exception 'unknown operator code'; end if;
    select count(*) filter (where cohort = 'pilot'), count(*) filter (where cohort = 'control')
      into v_pilots, v_controls from public.riders where operator_id = v_operator.id;
    v_cohort := case
      when v_pilots < v_controls then 'pilot'
      when v_controls < v_pilots then 'control'
      when random() < 0.5 then 'pilot' else 'control' end;
  else
    v_cohort := 'pilot';
  end if;

  insert into public.riders (auth_user_id, name, phone, operator_id, language, floor_paise, cohort, onboarded_at)
  values (auth.uid(), p_name, p_phone, v_operator.id, p_language, p_floor_paise, v_cohort, now())
  returning id into v_rider;

  insert into public.pots (rider_id, kind, label_hi, label_en, target_paise) values
    (v_rider, 'rent', 'किराया', 'Rent', p_rent_amount_paise),
    (v_rider, 'emergency', 'इमरजेंसी', 'Emergency', 300000),
    (v_rider, 'savings', 'बचत', 'Savings', null);

  insert into public.consents (rider_id, purpose, granted, version)
  values (v_rider, 'app_use', true, p_consent_version);
  if p_operator_share and v_operator.id is not null then
    insert into public.consents (rider_id, purpose, granted, version)
    values (v_rider, 'operator_share', true, p_consent_version);
  end if;

  if v_operator.id is not null and p_rent_amount_paise > 0 then
    v_next := case when p_rent_cadence = 'daily' then v_today
                   else v_today + ((p_due_weekday - extract(dow from v_today)::int + 7) % 7) end;
    insert into public.rent_agreements
      (rider_id, operator_id, amount_paise, cadence, due_weekday, next_due_on, payee_vpa, payee_name)
    values (v_rider, v_operator.id, p_rent_amount_paise, p_rent_cadence,
            case when p_rent_cadence = 'weekly' then p_due_weekday end,
            v_next, coalesce(v_operator.payee_vpa, ''), v_operator.name);
  end if;
  return v_rider;
end $$;

-- S4: the rider tells us whether he sent the rent from his UPI app. Provisional.
create function public.rider_report_rent(p_event uuid, p_paid boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_due date;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  select e.due_on into v_due
  from public.rent_events e join public.rent_agreements a on a.id = e.rent_agreement_id
  where e.id = p_event and a.rider_id = public.current_rider_id();
  if not found then raise exception 'rent event not found'; end if;
  if not p_paid then return; end if;
  update public.rent_events set
    rider_report = case when v_today <= v_due then 'paid_on_time' else 'paid_late' end,
    rider_reported_at = now(),
    paid_at = coalesce(paid_at, now()),
    method = coalesce(method, 'upi_intent')
  where id = p_event;
end $$;

-- §7: the operator marks rent as received; this is authoritative and overrides
-- the rider's self-report without erasing it.
create function public.operator_mark_rent(p_event uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('paid_on_time', 'paid_late', 'missed') then
    raise exception 'invalid status %', p_status;
  end if;
  update public.rent_events e set
    operator_report = p_status,
    operator_reported_at = now(),
    method = case when p_status = 'missed' then e.method else coalesce(e.method, 'operator_reported') end,
    paid_at = case when p_status = 'missed' then e.paid_at else coalesce(e.paid_at, now()) end
  from public.rent_agreements a
  where e.id = p_event
    and a.id = e.rent_agreement_id
    and a.operator_id = public.current_operator_id()
    and public.operator_can_see_rider(a.rider_id);
  if not found then raise exception 'rent event not found'; end if;
end $$;

-- §7 rider list: name, phone, cohort for consented riders in this fleet. Nothing else.
create function public.operator_riders()
returns table (rider_id uuid, name text, phone text, cohort text)
language sql stable security definer set search_path = public as $$
  select r.id, r.name, r.phone, r.cohort
  from public.riders r
  where r.operator_id = public.current_operator_id()
    and public.operator_share_granted(r.id)
  order by r.name
$$;

-- §7 CSV upload of rider payout data. Write-only: the operator gets back a count,
-- never the rows, and still cannot select from payouts.
create function public.operator_import_payout(
  p_rider uuid, p_amount_paise bigint, p_source text, p_occurred_at timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.operator_can_see_rider(p_rider) then raise exception 'rider not in fleet or no consent'; end if;
  insert into public.payouts (rider_id, amount_paise, source, occurred_at, entry_method)
  values (p_rider, p_amount_paise, p_source, p_occurred_at, 'csv');
end $$;

-- Functions are executable only where granted below. This runs after every
-- function above exists. Trigger functions need no EXECUTE grant to fire, and
-- operator_share_granted() is reachable only through operator_can_see_rider().
revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.current_rider_id(),
  public.current_operator_id(),
  public.operator_can_see_rider(uuid),
  public.onboard_rider(text, text, text, text, bigint, bigint, text, smallint, text, boolean),
  public.rider_report_rent(uuid, boolean),
  public.operator_mark_rent(uuid, text),
  public.operator_riders(),
  public.operator_import_payout(uuid, bigint, text, timestamptz)
to authenticated;
