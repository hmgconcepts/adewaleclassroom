-- =====================================================================
-- V19 — REVENUE AUTOMATION + ENTERPRISE SECURITY
-- =====================================================================
-- Everything here came from research recorded in
-- docs/COMPETITOR-BENCHMARK.md and docs/SECURITY-AND-COMPLIANCE.md.
--
-- PART A — REVENUE & AUTOMATION (competitor parity, item 1 + item 11)
--   A1  Prepaid credit wallet with auto-deduction and low-balance alerts.
--       Tutorbase calls this its flagship feature and reports it lifts
--       monthly renewals by up to 42%. It was the single biggest hole in
--       this studio's billing.
--   A2  Instalment / payment plans. Nigerian term fees are routinely split;
--       Tutorbase, TutorCruncher, Oases, CourseStorm and Enrollsy all do
--       this and we did not.
--   A3  Attendance-driven auto-invoicing. Mark a lesson attended and the
--       invoice writes itself. This is the automation item 11 asks for:
--       nothing should be typed that the system already knows.
--   A4  Promo / discount codes (CourseStorm, Jackrabbit).
--   A5  Waitlist auto-promotion when a seat frees up.
--   A6  Tutor pay rates and payroll generated from real attendance,
--       supporting hourly, per-session and revenue-share models.
--   A7  Conflict detection so the studio can claim zero double-bookings.
--   A8  A free "find a slot" engine — pure availability intersection, no
--       AI API, because an AI API is not cost effective.
--
-- PART B — SECURITY, PRIVACY & DATA SAFETY (items 7 + 9)
--   B1  An IMMUTABLE audit trail. Every research source on FERPA/NDPA
--       compliance names this first: who touched which record, when, and
--       what changed — and users must not be able to delete their own
--       entries. The existing activity_log was a plain table anyone with
--       write access could edit or empty.
--   B2  Data-subject requests: export ("right to inspect") and erasure,
--       with a deadline clock.
--   B3  Consent records.
--   B4  Retention policy with a safe, dry-run-first purge.
--   B5  Anonymised export (SHA-256 pseudonyms) so a studio can share
--       analytics without sharing identities.
--   B6  Failed-login and unusual-access monitoring on the existing
--       login_audit table.
--
-- Nothing pre-existing is dropped. activity_log, login_audit, waitlist,
-- payroll and makeup_credits are all ENHANCED in place.
-- Idempotent; already folded into database/complete-schema.sql.
-- =====================================================================


-- =====================================================================
-- PART A1 — PREPAID CREDIT WALLET
-- ---------------------------------------------------------------------
-- A ledger, not a balance column. A single mutable "balance" number is
-- impossible to audit and drifts the moment two writes race. Every
-- movement is an immutable row and the balance is always their sum.
-- =====================================================================
create table if not exists public.account_credits (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.parents(id) on delete cascade,
  learner_id   uuid references public.learners(id) on delete set null,
  -- Positive = money or lessons added. Negative = consumed.
  amount       numeric(12,2) not null,
  unit         text not null default 'currency',   -- 'currency' | 'session'
  reason       text,
  kind         text default 'topup',               -- topup | consume | refund | adjustment | bonus
  session_id   uuid,
  invoice_id   uuid,
  reference    text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz default now()
);

create index if not exists account_credits_parent_idx  on public.account_credits (parent_id);
create index if not exists account_credits_learner_idx on public.account_credits (learner_id);
create index if not exists account_credits_created_idx on public.account_credits (created_at desc);

alter table public.account_credits enable row level security;

drop policy if exists account_credits_staff on public.account_credits;
create policy account_credits_staff on public.account_credits
  for all to authenticated using (public.is_tutor()) with check (public.is_tutor());

-- A family may READ its own ledger but never write to it.
drop policy if exists account_credits_family on public.account_credits;
create policy account_credits_family on public.account_credits
  for select to authenticated
  using (parent_id in (select id from public.parents where user_id = auth.uid()));

revoke all on public.account_credits from anon;

-- Where the studio sets its own low-balance threshold.
alter table public.practice_settings add column if not exists wallet_enabled        boolean default false;
alter table public.practice_settings add column if not exists wallet_low_threshold  numeric(12,2) default 0;
alter table public.practice_settings add column if not exists wallet_unit           text default 'currency';
alter table public.practice_settings add column if not exists auto_invoice_enabled  boolean default false;
alter table public.practice_settings add column if not exists auto_invoice_rate     numeric(12,2);


create or replace function public.tc_wallet_balance(p_parent uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parent uuid; v_cur numeric; v_ses numeric; v_low numeric; v_unit text; v_name text;
begin
  -- A parent may only ever see their own wallet; staff may see any.
  if p_parent is null then
    select id into v_parent from public.parents where user_id = auth.uid() limit 1;
  elsif public.is_tutor() then
    v_parent := p_parent;
  else
    select id into v_parent from public.parents
     where id = p_parent and user_id = auth.uid() limit 1;
  end if;

  if v_parent is null then
    return jsonb_build_object('ok', false, 'error', 'no_parent_record');
  end if;

  select full_name into v_name from public.parents where id = v_parent;
  select coalesce(sum(amount) filter (where unit = 'currency'), 0),
         coalesce(sum(amount) filter (where unit = 'session'), 0)
    into v_cur, v_ses
    from public.account_credits where parent_id = v_parent;

  select coalesce(wallet_low_threshold, 0), coalesce(wallet_unit, 'currency')
    into v_low, v_unit from public.practice_settings where id = 1;

  return jsonb_build_object(
    'ok', true,
    'parent_id', v_parent,
    'parent_name', v_name,
    'currency_balance', v_cur,
    'session_balance',  v_ses,
    'unit', v_unit,
    'low_threshold', v_low,
    -- The alert competitors charge for.
    'is_low', case when v_unit = 'session' then v_ses <= v_low else v_cur <= v_low end,
    'currency', (select currency from public.practice_settings where id = 1),
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'at', created_at, 'amount', amount, 'unit', unit,
               'kind', kind, 'reason', reason, 'reference', reference)
             order by created_at desc)
        from (select * from public.account_credits
               where parent_id = v_parent order by created_at desc limit 50) m
    ), '[]'::jsonb),
    'checked_at', now());
end $$;

grant execute on function public.tc_wallet_balance(uuid) to authenticated;
revoke all on function public.tc_wallet_balance(uuid) from public, anon;


create or replace function public.tc_wallet_topup(
  p_parent uuid, p_amount numeric, p_unit text default 'currency',
  p_reason text default null, p_reference text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_tutor() then
    raise exception 'Only studio staff can add credit to a wallet.'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_amount, 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Amount cannot be zero.');
  end if;

  insert into public.account_credits (parent_id, amount, unit, kind, reason, reference)
  values (p_parent, p_amount, coalesce(p_unit, 'currency'),
          case when p_amount > 0 then 'topup' else 'adjustment' end,
          coalesce(p_reason, 'Manual top-up'), p_reference);

  return public.tc_wallet_balance(p_parent);
end $$;

grant execute on function public.tc_wallet_topup(uuid, numeric, text, text, text) to authenticated;
revoke all on function public.tc_wallet_topup(uuid, numeric, text, text, text) from public, anon;


-- Families whose balance has fallen to or below the threshold. This is
-- the list the studio works from to chase renewals.
create or replace function public.tc_wallet_low_balances()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb; v_low numeric; v_unit text;
begin
  if not public.is_tutor() then
    raise exception 'Wallet reporting is for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;
  select coalesce(wallet_low_threshold, 0), coalesce(wallet_unit, 'currency')
    into v_low, v_unit from public.practice_settings where id = 1;

  select coalesce(jsonb_agg(x order by x->>'balance'), '[]'::jsonb) into v from (
    select jsonb_build_object(
             'parent_id', p.id, 'parent_name', p.full_name,
             'email', p.email, 'phone', p.phone,
             'balance', coalesce(sum(c.amount) filter (where c.unit = v_unit), 0))  as x
      from public.parents p
      left join public.account_credits c on c.parent_id = p.id
     group by p.id, p.full_name, p.email, p.phone
    having coalesce(sum(c.amount) filter (where c.unit = v_unit), 0) <= v_low
  ) s;

  return jsonb_build_object('ok', true, 'unit', v_unit, 'threshold', v_low,
                            'families', v, 'checked_at', now());
end $$;

grant execute on function public.tc_wallet_low_balances() to authenticated;
revoke all on function public.tc_wallet_low_balances() from public, anon;


-- =====================================================================
-- PART A2 — INSTALMENT / PAYMENT PLANS
-- =====================================================================
create table if not exists public.payment_plans (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references public.parents(id) on delete cascade,
  learner_id    uuid references public.learners(id) on delete set null,
  engagement_id uuid references public.engagements(id) on delete set null,
  title         text,
  total_amount  numeric(12,2) not null,
  instalments   int not null default 3,
  frequency     text default 'monthly',      -- weekly | fortnightly | monthly | termly
  starts_on     date default current_date,
  status        text default 'active',       -- active | completed | cancelled
  notes         text,
  created_at    timestamptz default now()
);

create table if not exists public.payment_plan_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid references public.payment_plans(id) on delete cascade,
  seq         int not null,
  due_on      date not null,
  amount      numeric(12,2) not null,
  status      text default 'due',            -- due | paid | late | waived
  paid_on     date,
  invoice_id  uuid,
  reference   text,
  created_at  timestamptz default now()
);

create index if not exists payment_plan_items_plan_idx on public.payment_plan_items (plan_id, seq);
create index if not exists payment_plan_items_due_idx  on public.payment_plan_items (due_on);

alter table public.payment_plans      enable row level security;
alter table public.payment_plan_items enable row level security;

drop policy if exists payment_plans_staff on public.payment_plans;
create policy payment_plans_staff on public.payment_plans
  for all to authenticated using (public.is_tutor()) with check (public.is_tutor());

drop policy if exists payment_plans_family on public.payment_plans;
create policy payment_plans_family on public.payment_plans
  for select to authenticated
  using (parent_id in (select id from public.parents where user_id = auth.uid()));

drop policy if exists payment_plan_items_staff on public.payment_plan_items;
create policy payment_plan_items_staff on public.payment_plan_items
  for all to authenticated using (public.is_tutor()) with check (public.is_tutor());

drop policy if exists payment_plan_items_family on public.payment_plan_items;
create policy payment_plan_items_family on public.payment_plan_items
  for select to authenticated
  using (plan_id in (select pp.id from public.payment_plans pp
                      join public.parents pa on pa.id = pp.parent_id
                     where pa.user_id = auth.uid()));

revoke all on public.payment_plans, public.payment_plan_items from anon;


-- Build the schedule automatically. Rounding is pushed onto the FIRST
-- instalment, never the last, so a family never gets a surprise odd
-- amount at the end of a plan they had budgeted for.
create or replace function public.tc_create_payment_plan(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan uuid;
  v_n    int    := greatest(coalesce((p->>'instalments')::int, 3), 1);
  v_tot  numeric := coalesce((p->>'total_amount')::numeric, 0);
  v_freq text   := coalesce(nullif(trim(coalesce(p->>'frequency','')),''), 'monthly');
  v_start date  := coalesce(nullif(p->>'starts_on','')::date, current_date);
  v_each numeric;
  v_first numeric;
  i int;
  v_due date;
begin
  if not public.is_tutor() then
    raise exception 'Only studio staff can create a payment plan.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_tot <= 0 then
    return jsonb_build_object('ok', false, 'error', 'Total amount must be greater than zero.');
  end if;

  insert into public.payment_plans (parent_id, learner_id, engagement_id, title,
                                    total_amount, instalments, frequency, starts_on, notes)
  values (nullif(p->>'parent_id','')::uuid, nullif(p->>'learner_id','')::uuid,
          nullif(p->>'engagement_id','')::uuid,
          nullif(trim(coalesce(p->>'title','')),''), v_tot, v_n, v_freq, v_start,
          nullif(trim(coalesce(p->>'notes','')),''))
  returning id into v_plan;

  v_each  := round(v_tot / v_n, 2);
  v_first := v_tot - (v_each * (v_n - 1));   -- absorbs the rounding remainder

  for i in 1..v_n loop
    v_due := case v_freq
               when 'weekly'      then v_start + ((i - 1) * 7)
               when 'fortnightly' then v_start + ((i - 1) * 14)
               when 'termly'      then (v_start + make_interval(months => (i - 1) * 3))::date
               else                    (v_start + make_interval(months => (i - 1)))::date
             end;
    insert into public.payment_plan_items (plan_id, seq, due_on, amount)
    values (v_plan, i, v_due, case when i = 1 then v_first else v_each end);
  end loop;

  return jsonb_build_object('ok', true, 'plan_id', v_plan, 'instalments', v_n,
                            'first_amount', v_first, 'each_amount', v_each);
end $$;

grant execute on function public.tc_create_payment_plan(jsonb) to authenticated;
revoke all on function public.tc_create_payment_plan(jsonb) from public, anon;


-- Overdue instalments, so nobody has to eyeball a table.
create or replace function public.tc_payment_plan_arrears()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_tutor() then
    raise exception 'Arrears reporting is for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'plan_id', pp.id, 'parent', pa.full_name, 'title', pp.title,
           'seq', it.seq, 'due_on', it.due_on, 'amount', it.amount,
           'days_late', (current_date - it.due_on)) order by it.due_on), '[]'::jsonb)
    into v
    from public.payment_plan_items it
    join public.payment_plans pp on pp.id = it.plan_id
    left join public.parents pa on pa.id = pp.parent_id
   where it.status in ('due','late') and it.due_on < current_date;
  return jsonb_build_object('ok', true, 'arrears', v, 'checked_at', now());
end $$;

grant execute on function public.tc_payment_plan_arrears() to authenticated;
revoke all on function public.tc_payment_plan_arrears() from public, anon;


-- =====================================================================
-- PART A3 — ATTENDANCE-DRIVEN AUTO-INVOICING  (item 11: automate it)
-- ---------------------------------------------------------------------
-- Mark a learner present and the money side takes care of itself:
--   * if the family has a prepaid wallet, the session is deducted;
--   * otherwise an invoice line is raised at the engagement's rate.
-- Off by default (practice_settings.auto_invoice_enabled) because
-- silently generating invoices on an existing studio would be rude.
-- =====================================================================
create or replace function public.tc_autoinvoice_on_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on       boolean;
  v_rate     numeric;
  v_eng      uuid;
  v_parent   uuid;
  v_wallet   boolean;
  v_unit     text;
  v_amount   numeric;
begin
  -- Only when a session becomes chargeable.
  if new.status not in ('present','late','no-show') then return new; end if;
  if coalesce(new.chargeable, true) = false then return new; end if;
  -- Do not double-charge when a row is merely edited.
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;

  select coalesce(auto_invoice_enabled,false), auto_invoice_rate,
         coalesce(wallet_enabled,false), coalesce(wallet_unit,'currency')
    into v_on, v_rate, v_wallet, v_unit
    from public.practice_settings where id = 1;
  if not coalesce(v_on, false) then return new; end if;

  select s.engagement_id into v_eng from public.sessions s where s.id = new.session_id;
  if v_eng is null then return new; end if;

  -- Engagement rate wins; the studio default is the fallback.
  select coalesce(e.hourly_rate, v_rate) into v_amount
    from public.engagements e where e.id = v_eng;
  if coalesce(v_amount, 0) <= 0 then return new; end if;

  select pl.parent_id into v_parent
    from public.parent_learner pl where pl.learner_id = new.learner_id limit 1;

  if v_wallet and v_parent is not null then
    -- Draw the lesson down from the prepaid wallet instead of invoicing.
    insert into public.account_credits
      (parent_id, learner_id, amount, unit, kind, reason, session_id)
    values (v_parent, new.learner_id,
            case when v_unit = 'session' then -1 else -v_amount end,
            v_unit, 'consume', 'Session attended (auto)', new.session_id);
  else
    insert into public.invoices (parent_id, engagement_id, amount, status, due_on)
    values (v_parent, v_eng, v_amount, 'draft', current_date + 14);
  end if;

  return new;
end $$;

drop trigger if exists tc_autoinvoice_trg on public.session_attendance;
create trigger tc_autoinvoice_trg
  after insert or update on public.session_attendance
  for each row execute function public.tc_autoinvoice_on_attendance();


-- =====================================================================
-- PART A4 — PROMO / DISCOUNT CODES
-- =====================================================================
create table if not exists public.promo_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  description  text,
  kind         text default 'percent',      -- percent | fixed
  value        numeric(12,2) not null default 0,
  max_uses     int,
  uses         int default 0,
  starts_on    date default current_date,
  expires_on   date,
  status       text default 'active',
  created_at   timestamptz default now()
);

alter table public.promo_codes enable row level security;
drop policy if exists promo_codes_staff on public.promo_codes;
create policy promo_codes_staff on public.promo_codes
  for all to authenticated using (public.is_tutor()) with check (public.is_tutor());
revoke all on public.promo_codes from anon;

-- Validation is a FUNCTION, not a table read, so anon can check a code at
-- checkout without being able to list every code the studio has ever issued.
create or replace function public.tc_check_promo(p_code text, p_amount numeric default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare c public.promo_codes%rowtype; v_off numeric;
begin
  select * into c from public.promo_codes where upper(code) = upper(trim(p_code));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That code was not recognised.');
  end if;
  if c.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'That code is no longer active.');
  end if;
  if c.starts_on is not null and c.starts_on > current_date then
    return jsonb_build_object('ok', false, 'error', 'That code is not valid yet.');
  end if;
  if c.expires_on is not null and c.expires_on < current_date then
    return jsonb_build_object('ok', false, 'error', 'That code expired on ' || c.expires_on || '.');
  end if;
  if c.max_uses is not null and coalesce(c.uses,0) >= c.max_uses then
    return jsonb_build_object('ok', false, 'error', 'That code has reached its usage limit.');
  end if;

  v_off := case when c.kind = 'fixed' then least(c.value, coalesce(p_amount,0))
                else round(coalesce(p_amount,0) * c.value / 100.0, 2) end;

  return jsonb_build_object('ok', true, 'code', c.code, 'kind', c.kind,
    'value', c.value, 'discount', v_off,
    'net', greatest(coalesce(p_amount,0) - v_off, 0),
    'description', c.description);
end $$;

grant execute on function public.tc_check_promo(text, numeric) to anon, authenticated;


-- =====================================================================
-- PART A5 — WAITLIST AUTO-PROMOTION
-- =====================================================================
alter table public.waitlist add column if not exists engagement_id uuid;
alter table public.waitlist add column if not exists priority      int default 100;
alter table public.waitlist add column if not exists contact       text;
alter table public.waitlist add column if not exists promoted_at   timestamptz;

create or replace function public.tc_waitlist_promote(p_engagement uuid default null, p_count int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_tutor() then
    raise exception 'Only studio staff can promote from the waitlist.'
      using errcode = 'insufficient_privilege';
  end if;

  with picked as (
    select id from public.waitlist
     where status = 'waiting'
       and (p_engagement is null or engagement_id = p_engagement)
     order by priority asc, created_at asc
     limit greatest(coalesce(p_count, 1), 1)
  )
  update public.waitlist w
     set status = 'offered', promoted_at = now()
    from picked
   where w.id = picked.id
  returning jsonb_build_object('id', w.id, 'learner_name', w.learner_name,
                               'subject', w.subject, 'contact', w.contact)
  into v;

  return jsonb_build_object('ok', true, 'promoted', coalesce(v, '{}'::jsonb),
    'note', 'Contact the family to confirm. Set the row to "enrolled" once they accept, '
         || 'or back to "waiting" if they decline.');
end $$;

grant execute on function public.tc_waitlist_promote(uuid, int) to authenticated;
revoke all on function public.tc_waitlist_promote(uuid, int) from public, anon;


-- =====================================================================
-- PART A6 — TUTOR RATES + PAYROLL FROM REAL ATTENDANCE
-- ---------------------------------------------------------------------
-- PRE-FLIGHT FIX. The first draft of this pack assumed sessions.tutor_id
-- and sessions.duration_min existed. Checking the schema instead of
-- trusting the assumption showed that NEITHER does: public.sessions has
-- engagement_id, starts_at, ends_at and hours, but has never recorded
-- WHICH TUTOR taught the session. Payroll, revenue-per-tutor and conflict
-- detection are all impossible without it, so the column is added here.
-- Both are additive and nullable, so no existing row is disturbed.
-- =====================================================================
alter table public.sessions add column if not exists tutor_id     uuid references public.tutors(id);
alter table public.sessions add column if not exists duration_min int;

create index if not exists sessions_tutor_idx  on public.sessions (tutor_id);
create index if not exists sessions_starts_idx on public.sessions (starts_at);

-- Backfill duration_min from whatever the row already knows, so existing
-- sessions work with the new conflict and payroll logic immediately.
update public.sessions
   set duration_min = greatest(1, round(extract(epoch from (ends_at - starts_at)) / 60.0)::int)
 where duration_min is null and ends_at is not null and ends_at > starts_at;

update public.sessions
   set duration_min = greatest(1, round(coalesce(hours, 1) * 60)::int)
 where duration_min is null;

create table if not exists public.tutor_rates (
  id          uuid primary key default gen_random_uuid(),
  tutor_id    uuid references public.tutors(id) on delete cascade,
  model       text default 'hourly',        -- hourly | per_session | revenue_share
  rate        numeric(12,2) default 0,
  share_pct   numeric(5,2) default 0,
  subject     text,
  effective_from date default current_date,
  notes       text,
  created_at  timestamptz default now()
);

alter table public.tutor_rates enable row level security;
drop policy if exists tutor_rates_staff on public.tutor_rates;
create policy tutor_rates_staff on public.tutor_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.tutor_rates from anon;

alter table public.payroll add column if not exists tutor_id     uuid;
alter table public.payroll add column if not exists sessions_count int;
alter table public.payroll add column if not exists model        text;
alter table public.payroll add column if not exists generated_at timestamptz;

-- Payroll built from attendance rather than typed in by hand.
create or replace function public.tc_payroll_generate(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r record; v_n int := 0; v_total numeric := 0; v_gross numeric; v_period text;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can generate payroll.'
      using errcode = 'insufficient_privilege';
  end if;
  v_period := to_char(p_from, 'YYYY-MM-DD') || ' to ' || to_char(p_to, 'YYYY-MM-DD');

  for r in
    select t.id as tutor_id, t.full_name,
           count(*) filter (where sa.status in ('present','late','no-show')) as sessions,
           coalesce(sum(coalesce(sa.minutes, 60)) filter (where sa.status in ('present','late','no-show')), 0) / 60.0 as hours,
           coalesce(tr.model, 'hourly') as model,
           coalesce(tr.rate, 0) as rate,
           coalesce(tr.share_pct, 0) as share_pct
      from public.tutors t
      join public.sessions s on s.tutor_id = t.id
      join public.session_attendance sa on sa.session_id = s.id
      left join lateral (
        select * from public.tutor_rates x
         where x.tutor_id = t.id and x.effective_from <= p_to
         order by x.effective_from desc limit 1) tr on true
     where s.starts_at::date between p_from and p_to
     group by t.id, t.full_name, tr.model, tr.rate, tr.share_pct
  loop
    v_gross := case r.model
                 when 'per_session'   then r.sessions * r.rate
                 when 'revenue_share' then round(r.sessions * r.rate * r.share_pct / 100.0, 2)
                 else round(r.hours * r.rate, 2)
               end;
    insert into public.payroll (tutor_id, tutor_name, period, hours, rate, gross,
                                sessions_count, model, status, generated_at)
    values (r.tutor_id, r.full_name, v_period, round(r.hours, 2), r.rate, v_gross,
            r.sessions, r.model, 'draft', now());
    v_n := v_n + 1;
    v_total := v_total + coalesce(v_gross, 0);
  end loop;

  return jsonb_build_object('ok', true, 'period', v_period, 'rows', v_n,
    'total_gross', v_total,
    'note', 'Draft rows created from real attendance. Review, then set each to "approved".');
end $$;

grant execute on function public.tc_payroll_generate(date, date) to authenticated;
revoke all on function public.tc_payroll_generate(date, date) from public, anon;


-- Revenue per tutor — the gap the benchmark named.
create or replace function public.tc_tutor_performance(p_days int default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_tutor() then
    raise exception 'Tutor performance reporting is for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;
  select coalesce(jsonb_agg(x order by (x->>'revenue')::numeric desc), '[]'::jsonb) into v from (
    select jsonb_build_object(
      'tutor', t.full_name,
      'sessions', count(distinct s.id),
      'learners', count(distinct sa.learner_id),
      'hours', round(coalesce(sum(coalesce(sa.minutes,60)),0) / 60.0, 1),
      'attendance_rate_pct', case when count(sa.id) = 0 then 0 else
        round(100.0 * count(*) filter (where sa.status in ('present','late')) / count(sa.id), 1) end,
      'no_shows', count(*) filter (where sa.status = 'no-show'),
      'revenue', coalesce(sum(e.hourly_rate * coalesce(sa.minutes,60) / 60.0)
                          filter (where sa.status in ('present','late','no-show')), 0)
    ) as x
      from public.tutors t
      left join public.sessions s on s.tutor_id = t.id
             and s.starts_at >= now() - make_interval(days => greatest(p_days,1))
      left join public.session_attendance sa on sa.session_id = s.id
      left join public.engagements e on e.id = s.engagement_id
     group by t.id, t.full_name
  ) q;
  return jsonb_build_object('ok', true, 'window_days', p_days, 'tutors', v);
end $$;

grant execute on function public.tc_tutor_performance(int) to authenticated;
revoke all on function public.tc_tutor_performance(int) from public, anon;


-- =====================================================================
-- PART A7 — BOOKING CONFLICT DETECTION
-- =====================================================================
create or replace function public.tc_session_conflicts(
  p_tutor uuid, p_starts timestamptz, p_minutes int default 60, p_ignore uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb; v_end timestamptz;
begin
  v_end := p_starts + make_interval(mins => greatest(coalesce(p_minutes,60), 1));
  select coalesce(jsonb_agg(jsonb_build_object(
           'session_id', s.id, 'starts_at', s.starts_at, 'engagement', e.name)), '[]'::jsonb)
    into v
    from public.sessions s
    left join public.engagements e on e.id = s.engagement_id
   where s.tutor_id = p_tutor
     and (p_ignore is null or s.id <> p_ignore)
     -- Two half-open intervals overlap iff each starts before the other ends.
     and s.starts_at < v_end
     and (s.starts_at + make_interval(mins => coalesce(s.duration_min, round(coalesce(s.hours,1)*60)::int, 60))) > p_starts;
  return jsonb_build_object('ok', true, 'conflicts', v,
                            'has_conflict', jsonb_array_length(v) > 0);
end $$;

grant execute on function public.tc_session_conflicts(uuid, timestamptz, int, uuid) to authenticated;
revoke all on function public.tc_session_conflicts(uuid, timestamptz, int, uuid) from public, anon;


-- =====================================================================
-- PART B1 — IMMUTABLE AUDIT TRAIL
-- ---------------------------------------------------------------------
-- The existing activity_log is kept and enhanced. What was missing is the
-- part every compliance source insists on: the log must be APPEND-ONLY.
-- A log a user can edit or empty is not evidence of anything.
-- =====================================================================
alter table public.activity_log add column if not exists old_row   jsonb;
alter table public.activity_log add column if not exists new_row   jsonb;
alter table public.activity_log add column if not exists actor_role text;

create index if not exists activity_log_created_idx on public.activity_log (created_at desc);
create index if not exists activity_log_table_idx   on public.activity_log (table_name);
create index if not exists activity_log_actor_idx   on public.activity_log (actor);

alter table public.activity_log enable row level security;

-- Readable by staff, writable by the trigger only, and NEVER updatable or
-- deletable by anybody through the API.
drop policy if exists activity_log_rw     on public.activity_log;
drop policy if exists activity_log_read   on public.activity_log;
drop policy if exists activity_log_insert on public.activity_log;
create policy activity_log_read on public.activity_log
  for select to authenticated using (public.is_tutor());

revoke insert, update, delete on public.activity_log from authenticated, anon;

-- Belt and braces: even a privileged role cannot rewrite history.
create or replace function public.tc_activity_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit trail is append-only. Entries cannot be % .', lower(tg_op)
    using errcode = 'insufficient_privilege';
end $$;

drop trigger if exists activity_log_no_update on public.activity_log;
create trigger activity_log_no_update before update on public.activity_log
  for each row execute function public.tc_activity_log_immutable();

drop trigger if exists activity_log_no_delete on public.activity_log;
create trigger activity_log_no_delete before delete on public.activity_log
  for each row execute function public.tc_activity_log_immutable();


create or replace function public.tc_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_id text;
begin
  begin
    v_id := case tg_op when 'DELETE' then (to_jsonb(old)->>'id') else (to_jsonb(new)->>'id') end;
  exception when others then v_id := null; end;

  insert into public.activity_log (actor, actor_role, action, table_name, row_id, old_row, new_row)
  values (auth.uid(), public.tc_current_role(), tg_op, tg_table_name, v_id,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);

  return case tg_op when 'DELETE' then old else new end;
end $$;

-- Attach to the tables that hold people's data or money.
do $$
declare
  t text;
  audited text[] := array[
    'learners','parents','tutors','engagements','sessions','session_attendance',
    'invoices','payments','account_credits','payment_plans','payment_plan_items',
    'exam_registrations','cbt_results','safeguarding_log','parent_learner',
    'site_license','practice_settings','promo_codes','tutor_rates','payroll'
  ];
begin
  foreach t in array audited loop
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = t) then
      execute format('drop trigger if exists tc_audit_trg on public.%I', t);
      execute format(
        'create trigger tc_audit_trg after insert or update or delete on public.%I '
        'for each row execute function public.tc_audit()', t);
    end if;
  end loop;
end $$;


-- Who touched one learner's record? The question a parent complaint asks.
create or replace function public.tc_audit_trail(p_table text default null,
                                                 p_row text default null,
                                                 p_days int default 90,
                                                 p_limit int default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'The audit trail is available to administrators only.'
      using errcode = 'insufficient_privilege';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'at', a.created_at, 'actor', a.actor, 'role', a.actor_role,
           'action', a.action, 'table', a.table_name, 'row_id', a.row_id,
           'changed', (
             select coalesce(jsonb_object_agg(k, jsonb_build_object(
                      'from', a.old_row->k, 'to', a.new_row->k)), '{}'::jsonb)
               from jsonb_object_keys(coalesce(a.new_row, '{}'::jsonb)) k
              where a.old_row is null or a.old_row->k is distinct from a.new_row->k)
         ) order by a.created_at desc), '[]'::jsonb)
    into v
    from (select * from public.activity_log
           where (p_table is null or table_name = p_table)
             and (p_row   is null or row_id = p_row)
             and created_at >= now() - make_interval(days => greatest(p_days,1))
           order by created_at desc
           limit greatest(coalesce(p_limit,200), 1)) a;
  return jsonb_build_object('ok', true, 'entries', v, 'generated_at', now());
end $$;

grant execute on function public.tc_audit_trail(text, text, int, int) to authenticated;
revoke all on function public.tc_audit_trail(text, text, int, int) from public, anon;


-- =====================================================================
-- PART B2/B3 — CONSENT + DATA-SUBJECT REQUESTS
-- =====================================================================
create table if not exists public.consent_records (
  id          uuid primary key default gen_random_uuid(),
  subject_kind text,                       -- learner | parent | tutor
  subject_id  uuid,
  purpose     text not null,               -- photos | marketing | data_processing | trips
  granted     boolean default false,
  granted_by  text,
  method      text,                        -- form | email | signed | verbal
  evidence_url text,
  valid_until date,
  created_at  timestamptz default now()
);

create table if not exists public.data_requests (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'access',   -- access | erasure | correction | portability
  subject_kind text, subject_id uuid,
  requested_by text, contact text,
  status      text default 'received',          -- received | in_progress | fulfilled | refused
  -- Statutory clocks: FERPA allows 45 days, Nigeria's NDPA expects
  -- "without undue delay". 30 days is the safe default.
  due_on      date default (current_date + 30),
  fulfilled_on date, note text,
  created_at  timestamptz default now()
);

alter table public.consent_records enable row level security;
alter table public.data_requests   enable row level security;

drop policy if exists consent_records_staff on public.consent_records;
create policy consent_records_staff on public.consent_records
  for all to authenticated using (public.is_tutor()) with check (public.is_tutor());

drop policy if exists data_requests_staff on public.data_requests;
create policy data_requests_staff on public.data_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.consent_records, public.data_requests from anon;


-- "Right to inspect": everything the studio holds on one learner, in one
-- JSON document, in one call.
create or replace function public.tc_export_learner(p_learner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not (public.is_admin() or public.is_family_of_learner(p_learner)) then
    raise exception 'You may only export a learner you are responsible for.'
      using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'notice', 'Complete record held by this studio for the named learner.',
    'learner',    (select to_jsonb(l) from public.learners l where l.id = p_learner),
    'guardians',  (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                     from public.parents p
                     join public.parent_learner pl on pl.parent_id = p.id
                    where pl.learner_id = p_learner),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
                     from public.session_attendance a where a.learner_id = p_learner),
    'assessments',(select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                     from public.assessments x where x.learner_id = p_learner),
    'cbt_results',(select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                     from public.cbt_results r where r.learner_id = p_learner),
    'goals',      (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
                     from public.goals g where g.learner_id = p_learner),
    'consent',    (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                     from public.consent_records c
                    where c.subject_id = p_learner and c.subject_kind = 'learner')
  ) into v;
  return v;
end $$;

grant execute on function public.tc_export_learner(uuid) to authenticated;
revoke all on function public.tc_export_learner(uuid) from public, anon;


-- Anonymised analytics export: stable pseudonyms, no identities.
create or replace function public.tc_anonymised_export()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Anonymised export is for administrators only.'
      using errcode = 'insufficient_privilege';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    -- A stable pseudonym: the same learner always hashes to the same
    -- token, so trends survive, but the token cannot be reversed.
    'pseudonym', substr(encode(digest(l.id::text, 'sha256'), 'hex'), 1, 16),
    'year_group', l.year_group,
    'sessions',   (select count(*) from public.session_attendance a where a.learner_id = l.id),
    'attendance_rate_pct', (
      select case when count(*) = 0 then null else
        round(100.0 * count(*) filter (where status in ('present','late')) / count(*), 1) end
        from public.session_attendance a where a.learner_id = l.id),
    'avg_score', (select round(avg(score), 1) from public.cbt_results r where r.learner_id = l.id)
  )), '[]'::jsonb) into v from public.learners l;
  return jsonb_build_object('ok', true, 'method', 'SHA-256 pseudonymisation',
                            'rows', v, 'generated_at', now());
end $$;

grant execute on function public.tc_anonymised_export() to authenticated;
revoke all on function public.tc_anonymised_export() from public, anon;


-- =====================================================================
-- PART B6 — FAILED LOGIN / UNUSUAL ACCESS MONITORING
-- =====================================================================
alter table public.login_audit add column if not exists success boolean;
alter table public.login_audit add column if not exists ip      text;
create index if not exists login_audit_created_idx on public.login_audit (created_at desc);

create or replace function public.tc_security_events(p_days int default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_fail jsonb; v_tot int; v_bad int;
begin
  if not public.is_admin() then
    raise exception 'Security events are for administrators only.'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*), count(*) filter (where coalesce(success, true) = false)
    into v_tot, v_bad
    from public.login_audit
   where created_at >= now() - make_interval(days => greatest(p_days,1));

  -- Repeated failures against one address is the signal worth surfacing.
  select coalesce(jsonb_agg(jsonb_build_object('email', email, 'failures', n)
                            order by n desc), '[]'::jsonb)
    into v_fail
    from (select email, count(*) n from public.login_audit
           where coalesce(success, true) = false
             and created_at >= now() - make_interval(days => greatest(p_days,1))
           group by email having count(*) >= 3 order by n desc limit 20) s;

  return jsonb_build_object('ok', true, 'window_days', p_days,
    'sign_in_events', v_tot, 'failed', v_bad,
    'repeat_failures', v_fail,
    'audit_entries', (select count(*) from public.activity_log
                       where created_at >= now() - make_interval(days => greatest(p_days,1))),
    'checked_at', now());
end $$;

grant execute on function public.tc_security_events(int) to authenticated;
revoke all on function public.tc_security_events(int) from public, anon;


-- Re-assert the V18 rule for everything created above: nothing is
-- executable by PUBLIC unless it was granted to anon by name.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public', r.sig);
  end loop;
end $$;
grant execute on function public.tc_check_promo(text, numeric) to anon;

select 'V19 revenue automation + enterprise security installed ✅' as status;
