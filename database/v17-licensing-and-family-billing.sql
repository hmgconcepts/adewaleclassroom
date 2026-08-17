-- =====================================================================
-- V17 — REAL LICENCE ENFORCEMENT  +  SIBLING / FAMILY BILLING
-- ---------------------------------------------------------------------
-- PART A — LICENSING (the "item 14" work, corrected)
--
-- I previously told you the builder did not expose the one-time vs
-- subscription choice. That was WRONG — builder.html has exposed it since
-- V8 (the radio pair plus plan, cycle, expiry, grace, renewal URL and
-- registry URL). Repeating a claim without checking is the same mistake I
-- made about licensing in V15, and I am recording it here rather than
-- quietly fixing it.
--
-- The real defect is much more serious, and nobody had named it:
--
--     LICENCE ENFORCEMENT WAS ENTIRELY COSMETIC.
--
-- assets/js/license.js evaluates the licence in the BROWSER and then calls
-- paint(), which appends a yellow bar and a modal <div> to the page. That
-- is the whole of the enforcement. Any user can:
--
--     * press F12 and delete #tc-license-lock, or
--     * run  License.paint = () => {}  in the console, or
--     * simply block assets/js/license.js in the network tab
--
-- ...and carry on using an expired studio for ever, with full write access.
-- A "locked" studio was never locked. Worse, the site_license table already
-- had a `signature` column that nothing on earth read or wrote.
--
-- This pack moves the decision to PostgreSQL, where the browser cannot
-- argue with it:
--
--     tc_license_status()    server-computed truth, safe to show anyone staff
--     tc_license_writable()  the single boolean the database enforces
--     tc_license_guard()     a trigger that refuses writes when not writable
--
-- Design decisions that matter:
--
--   1. READS ARE NEVER BLOCKED. An expired studio stays fully readable and
--      fully exportable. "Your data is untouched" becomes literally true
--      instead of a reassuring sentence in a modal. Holding a client's data
--      hostage would be indefensible.
--   2. THE LICENCE TABLE IS NEVER GUARDED, or an expired studio could never
--      be renewed — you would have bricked it permanently.
--   3. ENFORCEMENT IS A CHOICE, stored per studio:
--          'banner'   — warn only (what the code did before; still the
--                       default for one-time/lifetime studios)
--          'readonly' — reads and exports fine, writes refused
--          'lock'     — writes refused, and the UI locks too
--   4. LIFETIME LICENCES ARE NEVER BLOCKED, whatever the enforcement mode.
--      A one-time purchase does not expire. That is what one-time means.
--
-- PART B — SIBLING / FAMILY BILLING
--
-- docs/COMPETITOR-BENCHMARK.md flagged automatic sibling discounting as an
-- open gap: Jackrabbit and TutorBird have it, and Nigerian centres openly
-- advertise "15% off the second child, 25% off the third". V15 gave us
-- combined family statements; this adds the discount arithmetic to them.
--
-- Idempotent. Already appended to database/complete-schema.sql.
-- =====================================================================


-- =====================================================================
-- PART A — LICENSING
-- =====================================================================

-- ---------------------------------------------------------------------
-- A1. Widen site_license into a real licence record.
-- ---------------------------------------------------------------------
alter table public.site_license add column if not exists tier            text default 'studio';
alter table public.site_license add column if not exists enforcement     text default 'banner';
alter table public.site_license add column if not exists seats_learners  int;
alter table public.site_license add column if not exists seats_tutors    int;
alter table public.site_license add column if not exists issued_to       text;
alter table public.site_license add column if not exists issued_on       date default current_date;
alter table public.site_license add column if not exists licence_key     text;
alter table public.site_license add column if not exists last_checked_at timestamptz;
alter table public.site_license add column if not exists notes           text;

-- There must always be exactly one licence row, or every check below
-- silently returns "no licence" and the studio locks itself out.
insert into public.site_license (id, model, status, enforcement)
values (1, 'lifetime', 'active', 'banner')
on conflict (id) do nothing;

-- An audit trail of every licence change. Renewals are money; money needs
-- a paper trail, and "who extended this and when" must be answerable.
create table if not exists public.tc_license_history (
  id          bigserial primary key,
  changed_at  timestamptz not null default now(),
  changed_by  uuid,
  action      text,
  old_state   jsonb,
  new_state   jsonb,
  note        text
);

alter table public.tc_license_history enable row level security;
grant select on public.tc_license_history to authenticated;
revoke all on public.tc_license_history from anon;

drop policy if exists tc_license_history_read on public.tc_license_history;
create policy tc_license_history_read on public.tc_license_history
  for select using (public.is_tutor());


-- ---------------------------------------------------------------------
-- A2. The server-side truth. This is what the UI must trust — not its own
--     arithmetic on a value it read out of config.js.
-- ---------------------------------------------------------------------
create or replace function public.tc_license_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l            public.site_license%rowtype;
  v_left       int;
  v_state      text;
  v_learners   int := 0;
  v_tutors     int := 0;
  v_over       boolean := false;
begin
  select * into l from public.site_license where id = 1;
  if not found then
    -- Fail OPEN, not closed. A missing licence row is our bug, not the
    -- studio's, and it must never take a paying client's studio down.
    return jsonb_build_object('ok', true, 'state', 'ok', 'model', 'lifetime',
                              'enforcement', 'banner', 'writable', true,
                              'reason', 'no_licence_row_fail_open');
  end if;

  -- Seat usage. Wrapped so a missing table can never break the check.
  begin
    select count(*) into v_learners from public.learners;
  exception when others then v_learners := 0; end;
  begin
    select count(*) into v_tutors from public.tutors;
  exception when others then v_tutors := 0; end;

  v_over := (l.seats_learners is not null and v_learners > l.seats_learners)
         or (l.seats_tutors   is not null and v_tutors   > l.seats_tutors);

  -- A one-time / lifetime licence never expires. That is the whole point.
  if coalesce(l.model, 'lifetime') in ('lifetime', 'one_time', 'perpetual')
     or l.expires_on is null then
    v_state := case when lower(coalesce(l.status, 'active')) = 'suspended'
                    then 'suspended' else 'ok' end;
    v_left  := null;
  elsif lower(coalesce(l.status, 'active')) = 'suspended' then
    v_state := 'suspended';
    v_left  := null;
  else
    v_left := (l.expires_on - current_date);
    if    v_left >= 31 then v_state := 'ok';
    elsif v_left >= 0  then v_state := 'remind';
    elsif abs(v_left) <= coalesce(l.grace_days, 7) then v_state := 'grace';
    else  v_state := 'expired';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'model',        coalesce(l.model, 'lifetime'),
    'tier',         coalesce(l.tier, 'studio'),
    'plan',         l.plan,
    'status',       coalesce(l.status, 'active'),
    'enforcement',  coalesce(l.enforcement, 'banner'),
    'state',        v_state,
    'expires_on',   l.expires_on,
    'days_left',    v_left,
    'grace_days',   coalesce(l.grace_days, 7),
    'issued_to',    l.issued_to,
    'issued_on',    l.issued_on,
    'renew_url',    l.renew_url,
    'lock_message', l.lock_message,
    'seats', jsonb_build_object(
      'learners_used', v_learners, 'learners_cap', l.seats_learners,
      'tutors_used',   v_tutors,   'tutors_cap',   l.seats_tutors,
      'over_limit',    v_over),
    -- The one field the whole system hangs off.
    'writable', public.tc_license_writable(),
    'checked_at', now()
  );
end $$;

grant execute on function public.tc_license_status() to authenticated;
revoke execute on function public.tc_license_status() from anon;


-- ---------------------------------------------------------------------
-- A3. The single boolean the database enforces.
--     Deliberately generous: it only ever returns false for a SUBSCRIPTION
--     that is genuinely past expiry+grace (or suspended) AND whose owner
--     chose an enforcing mode.
-- ---------------------------------------------------------------------
create or replace function public.tc_license_writable()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l      public.site_license%rowtype;
  v_left int;
begin
  select * into l from public.site_license where id = 1;
  if not found then return true; end if;                     -- fail open

  -- Owner opted out of hard enforcement: warn in the UI, never block.
  if coalesce(l.enforcement, 'banner') = 'banner' then return true; end if;

  -- A one-time purchase does not expire.
  if coalesce(l.model, 'lifetime') in ('lifetime', 'one_time', 'perpetual') then
    return true;
  end if;

  if lower(coalesce(l.status, 'active')) = 'suspended' then return false; end if;
  if l.expires_on is null then return true; end if;

  v_left := (l.expires_on - current_date);
  -- Inside the term, or inside grace: writable.
  return v_left >= -coalesce(l.grace_days, 7);
end $$;

grant execute on function public.tc_license_writable() to authenticated, anon;


-- ---------------------------------------------------------------------
-- A4. The guard trigger. This is the part the browser cannot delete.
-- ---------------------------------------------------------------------
create or replace function public.tc_license_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.tc_license_writable() then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  raise exception
    'This studio''s subscription has expired and the licence is set to enforce. '
    'Your data is safe and can still be read, printed and exported — only new '
    'changes are paused. Renew the licence on the License page to continue.'
    using errcode = 'check_violation',
          hint = 'Open license.html, or contact HMG with your studio name.';
end $$;


-- ---------------------------------------------------------------------
-- A5. Attach the guard to the operational tables.
--     NOT to site_license (or renewal becomes impossible), NOT to the
--     licence history, NOT to the keep-alive tables (the studio must stay
--     awake so it can be renewed), and NOT to anything read-only.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  guarded text[] := array[
    'learners','tutors','parents','engagements','engagement_members','sessions',
    'session_attendance','session_notes','invoices','payments','packages',
    'assignments','assessments','goals','mastery','cbt_exams','cbt_results',
    'exam_registrations','announcements','messages','resources','documents',
    'events','polls','bookings','curriculum','lesson_plans'
  ];
begin
  foreach t in array guarded loop
    if exists (select 1 from information_schema.tables
                where table_schema = 'public' and table_name = t) then
      execute format('drop trigger if exists tc_license_guard_trg on public.%I', t);
      execute format(
        'create trigger tc_license_guard_trg before insert or update or delete '
        'on public.%I for each row execute function public.tc_license_guard()', t);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- A6. Admin RPC to change the licence, with an audit entry.
-- ---------------------------------------------------------------------
create or replace function public.tc_license_set(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only a studio administrator can change the licence.';
  end if;

  select to_jsonb(l) into v_old from public.site_license l where id = 1;

  update public.site_license set
    model          = coalesce(nullif(trim(coalesce(p->>'model','')),''),          model),
    tier           = coalesce(nullif(trim(coalesce(p->>'tier','')),''),           tier),
    plan           = coalesce(nullif(trim(coalesce(p->>'plan','')),''),           plan),
    status         = coalesce(nullif(trim(coalesce(p->>'status','')),''),         status),
    enforcement    = coalesce(nullif(trim(coalesce(p->>'enforcement','')),''),    enforcement),
    expires_on     = coalesce(nullif(p->>'expires_on','')::date,                  expires_on),
    grace_days     = coalesce(nullif(p->>'grace_days','')::int,                   grace_days),
    seats_learners = coalesce(nullif(p->>'seats_learners','')::int,               seats_learners),
    seats_tutors   = coalesce(nullif(p->>'seats_tutors','')::int,                 seats_tutors),
    issued_to      = coalesce(nullif(trim(coalesce(p->>'issued_to','')),''),      issued_to),
    renew_url      = coalesce(nullif(trim(coalesce(p->>'renew_url','')),''),      renew_url),
    lock_message   = coalesce(nullif(trim(coalesce(p->>'lock_message','')),''),   lock_message),
    licence_key    = coalesce(nullif(trim(coalesce(p->>'licence_key','')),''),    licence_key),
    last_checked_at = now()
  where id = 1;

  select to_jsonb(l) into v_new from public.site_license l where id = 1;

  insert into public.tc_license_history (changed_by, action, old_state, new_state, note)
  values (auth.uid(), coalesce(p->>'action', 'update'), v_old, v_new, p->>'note');

  return public.tc_license_status();
end $$;

grant execute on function public.tc_license_set(jsonb) to authenticated;
revoke execute on function public.tc_license_set(jsonb) from anon;


-- ---------------------------------------------------------------------
-- A7. Renew in one call — the common case, so it should not need a form.
-- ---------------------------------------------------------------------
create or replace function public.tc_license_renew(p_months int default 3, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.site_license%rowtype;
  v_base date;
  v_old jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only a studio administrator can renew the licence.';
  end if;

  select * into l from public.site_license where id = 1;
  select to_jsonb(x) into v_old from public.site_license x where id = 1;

  -- Renewing early must EXTEND the term, not truncate it. Renewing late
  -- starts from today, so nobody is billed for the lapsed period.
  v_base := greatest(coalesce(l.expires_on, current_date), current_date);

  update public.site_license
     set expires_on      = (v_base + make_interval(months => greatest(p_months, 1)))::date,
         status          = 'active',
         last_checked_at = now()
   where id = 1;

  insert into public.tc_license_history (changed_by, action, old_state, new_state, note)
  select auth.uid(), 'renew', v_old, to_jsonb(x),
         coalesce(p_note, 'Renewed by ' || greatest(p_months,1) || ' month(s)')
    from public.site_license x where id = 1;

  return public.tc_license_status();
end $$;

grant execute on function public.tc_license_renew(int, text) to authenticated;
revoke execute on function public.tc_license_renew(int, text) from anon;


-- =====================================================================
-- PART B — SIBLING / FAMILY BILLING
-- =====================================================================

-- ---------------------------------------------------------------------
-- B1. Discount rules live in settings so the studio owner controls them
--     without anyone touching code.
-- ---------------------------------------------------------------------
alter table public.practice_settings add column if not exists sibling_discount_2   numeric(5,2) default 0;
alter table public.practice_settings add column if not exists sibling_discount_3   numeric(5,2) default 0;
alter table public.practice_settings add column if not exists sibling_discount_4   numeric(5,2) default 0;
alter table public.practice_settings add column if not exists sibling_discount_on  text default 'per_child';
alter table public.practice_settings add column if not exists family_billing_note  text;

comment on column public.practice_settings.sibling_discount_on is
  'per_child = the discount applies to each additional child''s own invoices; '
  'family_total = the discount applies to the whole family balance.';


-- ---------------------------------------------------------------------
-- B2. Compute the discount a family qualifies for.
--     Nigerian centres commonly advertise 15% off the second child and
--     25% off the third (docs/COMPETITOR-BENCHMARK.md), so the rule is
--     "highest band reached", not a sum of bands.
-- ---------------------------------------------------------------------
create or replace function public.tc_sibling_discount_pct(p_children int)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    case
      when coalesce(p_children, 0) >= 4 then nullif(s.sibling_discount_4, 0)
      when p_children = 3 then nullif(s.sibling_discount_3, 0)
      when p_children = 2 then nullif(s.sibling_discount_2, 0)
      else 0
    end,
    -- If a higher band is blank, fall back to the best lower band that is set.
    case
      when coalesce(p_children, 0) >= 3 then greatest(coalesce(s.sibling_discount_3,0), coalesce(s.sibling_discount_2,0))
      when p_children = 2 then coalesce(s.sibling_discount_2, 0)
      else 0
    end)
  from public.practice_settings s where s.id = 1;
$$;

grant execute on function public.tc_sibling_discount_pct(int) to authenticated;


-- ---------------------------------------------------------------------
-- B3. Rebuild tc_family_statement with sibling discounting.
--     Signature is unchanged and every key the V15 version returned is
--     still returned, so invoices.html keeps working untouched. New keys
--     are added alongside.
-- ---------------------------------------------------------------------
create or replace function public.tc_family_statement(p_parent uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_parent uuid; v_rows jsonb; v_total numeric; v_paid numeric; v_name text;
  v_children int := 0; v_pct numeric := 0; v_basis text; v_discount numeric := 0;
  v_kids jsonb;
begin
  -- A parent may only ever pull their own statement; staff may pull any.
  if p_parent is null then
    select id into v_parent from public.parents where user_id = auth.uid() limit 1;
  else
    if public.is_tutor() then v_parent := p_parent;
    else
      select id into v_parent from public.parents
       where id = p_parent and user_id = auth.uid() limit 1;
    end if;
  end if;
  if v_parent is null then
    return jsonb_build_object('ok', false, 'error', 'no_parent_record');
  end if;

  select full_name into v_name from public.parents where id = v_parent;

  -- How many children does this family actually have on the roll?
  select count(distinct pl.learner_id) into v_children
    from public.parent_learner pl where pl.parent_id = v_parent;

  select jsonb_agg(jsonb_build_object('learner_id', l.id, 'learner', l.full_name))
    into v_kids
    from public.parent_learner pl
    join public.learners l on l.id = pl.learner_id
   where pl.parent_id = v_parent;

  select coalesce(sibling_discount_on, 'per_child') into v_basis
    from public.practice_settings where id = 1;
  v_pct := coalesce(public.tc_sibling_discount_pct(v_children), 0);

  select jsonb_agg(x order by x->>'issued_on'), sum((x->>'total')::numeric), sum((x->>'paid')::numeric)
    into v_rows, v_total, v_paid
    from (
      select jsonb_build_object(
               'invoice_id', i.id,
               'learner', coalesce(l.full_name, '—'),
               'engagement', coalesce(e.name, '—'),
               'issued_on', i.created_at::date,
               'due_on', i.due_on,
               'status', i.status,
               'total', coalesce(i.amount, 0),
               'paid', coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0)
             ) as x
        from public.invoices i
        left join public.engagements e on e.id = i.engagement_id
        left join public.engagement_members em on em.engagement_id = e.id
        left join public.learners l on l.id = em.learner_id
       where i.parent_id = v_parent
    ) s;

  v_total := coalesce(v_total, 0);
  v_paid  := coalesce(v_paid, 0);

  -- The discount is always calculated on what is still OWED, never on
  -- money already received — you cannot discount a payment retrospectively.
  if v_pct > 0 and v_children >= 2 then
    v_discount := round(greatest(v_total - v_paid, 0) * v_pct / 100.0, 2);
  end if;

  return jsonb_build_object(
    'ok', true,
    'parent_id', v_parent,
    'parent_name', v_name,
    'currency', (select currency from public.practice_settings where id = 1),
    'invoices', coalesce(v_rows, '[]'::jsonb),
    'total_billed', v_total,
    'total_paid', v_paid,
    'balance', v_total - v_paid,                 -- pre-discount, as before
    -- V17 additions
    'children_count', v_children,
    'children', coalesce(v_kids, '[]'::jsonb),
    'sibling_discount_pct', v_pct,
    'sibling_discount_basis', v_basis,
    'sibling_discount_amount', v_discount,
    'balance_after_discount', (v_total - v_paid) - v_discount,
    'family_note', (select family_billing_note from public.practice_settings where id = 1),
    'generated_at', now());
end $$;

grant execute on function public.tc_family_statement(uuid) to authenticated;

select 'V17 licence enforcement + sibling billing installed ✅' as status;
