-- =====================================================================
-- V18 — SECURITY HARDENING (live-verified findings)
-- ---------------------------------------------------------------------
-- HOW THESE BUGS WERE FOUND
--
-- Every audit before this one was STATIC. pglast parsed the SQL,
-- lint_schema.py checked it, jsdom loaded the pages, 497 assertions
-- passed. All of it passed repeatedly while the deployed system behaved
-- differently, because static analysis cannot see a GRANT.
--
-- tools/audit_live.py now probes the real project with the real public
-- anon key — exactly what a stranger with "view source" holds — and it
-- found the following on the live studio:
--
--   * 15 functions callable by an anonymous visitor, leaking:
--       tc_exam_reg_stats  -> candidate counts and fee revenue
--       tc_db_report       -> database size and health
--       tc_storage_report  -> table names and byte sizes
--       tc_keep_alive_status -> infrastructure state
--       tc_license_status  -> licence model, tier, seat and roll counts
--       tc_no_show_report  -> attendance statistics
--       tc_schema_info     -> the full installed pack list (fingerprinting)
--       tc_current_role / is_admin / is_tutor -> role probing
--   * the announcements table returning rows to anon
--   * tc_schema_info reporting expected=V12 while V17 was installed
--
-- ROOT CAUSE OF THE FUNCTION LEAK
--
-- PostgreSQL grants EXECUTE on every newly created function to the PUBLIC
-- pseudo-role automatically. Supabase's `anon` role inherits from PUBLIC.
-- So this line, which V16 and V17 both used, is a NO-OP:
--
--     revoke execute on function public.tc_exam_reg_stats() from anon;
--
-- It revokes a grant that was never made to anon in the first place; the
-- privilege is coming from PUBLIC and stays there. The only thing that
-- actually works is:
--
--     revoke execute on function public.tc_exam_reg_stats() from public;
--
-- I wrote those ineffective revokes and reported them as security. They
-- were not. This pack replaces every one of them.
--
-- Idempotent. Safe to run repeatedly. Already appended to
-- database/complete-schema.sql.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Take EXECUTE away from PUBLIC on every function in the schema, then
--    hand it back deliberately. Done as a loop over the catalogue so a
--    function added later can never be missed by a hand-maintained list.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
  loop
    -- Strip the default-for-everyone grant.
    execute format('revoke all on function %s from public', r.sig);
    execute format('revoke all on function %s from anon', r.sig);
    -- A signed-in user is the normal case; anon is re-granted below, by name.
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 2. Re-grant to anon ONLY the functions a public page genuinely needs.
--    Each one is justified, because "anon can call this" is a decision,
--    not an accident.
-- ---------------------------------------------------------------------

-- The public exam-registration form. SECURITY DEFINER, validates the link,
-- allocates the exam number, and returns only the new candidate's own number.
grant execute on function public.tc_register_candidate(jsonb) to anon;

-- A candidate checking their own docket/result with exam number + surname.
-- Withholds scores until staff release them.
grant execute on function public.tc_candidate_lookup(text, text) to anon;

-- A learner opening a quiz by code, with no account.
grant execute on function public.tc_cbt_get_exam(text, text) to anon;

-- The free-tier keep-alive ping, which must work from a cron with no session.
grant execute on function public.tc_keep_alive(text) to anon;

-- The public application / enquiry form.
grant execute on function public.tc_submit_application(text, jsonb) to anon;

-- Sign-in helper: resolves a username to an e-mail before a session exists.
grant execute on function public.lookup_login_email(text) to anon;

-- Harmless boolean the UI checks before offering a Save button. Leaks
-- nothing beyond "is this studio currently accepting writes".
grant execute on function public.tc_license_writable() to anon;


-- ---------------------------------------------------------------------
-- 3. Internal helpers must not be callable by anyone directly. They exist
--    to be used INSIDE other functions and policies, where they run with
--    the caller's context anyway.
-- ---------------------------------------------------------------------
revoke all on function public.tc_license_guard()      from public, anon, authenticated;
revoke all on function public.tc_set_updated_at()     from public, anon, authenticated;
revoke all on function public.handle_new_user()       from public, anon, authenticated;
revoke all on function public.tc_push_cbt_to_scoresheet() from public, anon, authenticated;
revoke all on function public.tc_expand_booking_block()   from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. Staff-only reporting. These were the worst of the leaks: an
--    anonymous visitor could read the studio's revenue and infrastructure.
--    is_tutor()/is_admin() are re-checked INSIDE each function too, so a
--    grant mistake alone can never re-open the hole.
-- ---------------------------------------------------------------------
create or replace function public.tc_exam_reg_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_tutor() then
    raise exception 'Exam registration statistics are for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object(
    'total',     count(*),
    'submitted', count(*) filter (where status = 'submitted'),
    'verified',  count(*) filter (where status = 'verified'),
    'paid',      count(*) filter (where fee_status = 'paid'),
    'unpaid',    count(*) filter (where coalesce(fee_status,'unpaid') <> 'paid'),
    'released',  count(*) filter (where status = 'released'),
    'admitted',  count(*) filter (where decision = 'admitted'),
    'fees_collected',  coalesce(sum(fee_amount) filter (where fee_status = 'paid'), 0),
    'fees_outstanding',coalesce(sum(fee_amount) filter (where coalesce(fee_status,'unpaid') <> 'paid'), 0),
    'this_month', count(*) filter (where created_at >= date_trunc('month', now())),
    'boards', (
      select coalesce(jsonb_object_agg(b, n), '{}'::jsonb)
      from (select coalesce(board,'—') as b, count(*) as n
              from public.exam_registrations group by 1 order by 2 desc limit 8) t)
  ) into v from public.exam_registrations;
  return v;
end $$;

create or replace function public.tc_no_show_report(p_days int default 90)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_tutor() then
    raise exception 'Attendance reporting is for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;
  with a as (
    select sa.* from public.session_attendance sa
      join public.sessions s on s.id = sa.session_id
     where s.starts_at >= now() - make_interval(days => greatest(p_days, 1)))
  select jsonb_build_object(
    'window_days', p_days,
    'total',    count(*),
    'present',  count(*) filter (where status in ('present','late')),
    'absent',   count(*) filter (where status = 'absent'),
    'excused',  count(*) filter (where status = 'excused'),
    'no_show',  count(*) filter (where status = 'no-show'),
    'late_cancel', count(*) filter (where status = 'cancelled-late'),
    'no_show_rate_pct', case when count(*) = 0 then 0
      else round(100.0 * count(*) filter (where status = 'no-show') / count(*), 1) end,
    'attendance_rate_pct', case when count(*) = 0 then 0
      else round(100.0 * count(*) filter (where status in ('present','late')) / count(*), 1) end,
    'chargeable_missed', count(*) filter (where status in ('no-show','cancelled-late') and coalesce(chargeable, true))
  ) into v from a;
  return v;
end $$;

-- Licence status is admin/staff information: it names the tier, the seat
-- caps and the size of the roll.
create or replace function public.tc_license_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l public.site_license%rowtype;
  v_left int; v_state text;
  v_learners int := 0; v_tutors int := 0; v_over boolean := false;
begin
  if not public.is_tutor() then
    raise exception 'Licence details are for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into l from public.site_license where id = 1;
  if not found then
    return jsonb_build_object('ok', true, 'state', 'ok', 'model', 'lifetime',
                              'enforcement', 'banner', 'writable', true,
                              'reason', 'no_licence_row_fail_open');
  end if;

  begin select count(*) into v_learners from public.learners; exception when others then v_learners := 0; end;
  begin select count(*) into v_tutors   from public.tutors;   exception when others then v_tutors := 0; end;
  v_over := (l.seats_learners is not null and v_learners > l.seats_learners)
         or (l.seats_tutors   is not null and v_tutors   > l.seats_tutors);

  if coalesce(l.model, 'lifetime') in ('lifetime','one_time','perpetual') or l.expires_on is null then
    v_state := case when lower(coalesce(l.status,'active')) = 'suspended' then 'suspended' else 'ok' end;
    v_left := null;
  elsif lower(coalesce(l.status,'active')) = 'suspended' then
    v_state := 'suspended'; v_left := null;
  else
    v_left := (l.expires_on - current_date);
    if    v_left >= 31 then v_state := 'ok';
    elsif v_left >= 0  then v_state := 'remind';
    elsif abs(v_left) <= coalesce(l.grace_days, 7) then v_state := 'grace';
    else  v_state := 'expired';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true, 'model', coalesce(l.model,'lifetime'), 'tier', coalesce(l.tier,'studio'),
    'plan', l.plan, 'status', coalesce(l.status,'active'),
    'enforcement', coalesce(l.enforcement,'banner'), 'state', v_state,
    'expires_on', l.expires_on, 'days_left', v_left,
    'grace_days', coalesce(l.grace_days,7), 'issued_to', l.issued_to,
    'issued_on', l.issued_on, 'renew_url', l.renew_url, 'lock_message', l.lock_message,
    'seats', jsonb_build_object(
      'learners_used', v_learners, 'learners_cap', l.seats_learners,
      'tutors_used', v_tutors, 'tutors_cap', l.seats_tutors, 'over_limit', v_over),
    'writable', public.tc_license_writable(), 'checked_at', now());
end $$;

-- Infrastructure reports: staff only.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='tc_db_report') then
    revoke all on function public.tc_db_report() from public, anon;
    grant execute on function public.tc_db_report() to authenticated;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='tc_storage_report') then
    revoke all on function public.tc_storage_report() from public, anon;
    grant execute on function public.tc_storage_report() to authenticated;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
              where n.nspname='public' and p.proname='tc_keep_alive_status') then
    revoke all on function public.tc_keep_alive_status() from public, anon;
    grant execute on function public.tc_keep_alive_status() to authenticated;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 5. The announcements table was returning rows to an anonymous visitor.
--    Internal notices are not public. Studios that DO want a public notice
--    board get an explicit opt-in column instead of a blanket policy.
-- ---------------------------------------------------------------------
alter table public.announcements add column if not exists is_public boolean default false;

drop policy if exists announcements_anon_read on public.announcements;
drop policy if exists announcements_read      on public.announcements;
drop policy if exists announcements_rw        on public.announcements;
drop policy if exists announcements_public    on public.announcements;

alter table public.announcements enable row level security;

-- Signed-in members of the studio see everything.
drop policy if exists announcements_member_read on public.announcements;
create policy announcements_member_read on public.announcements
  for select to authenticated using (true);

-- Anonymous visitors see ONLY rows a staff member deliberately marked public.
drop policy if exists announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements
  for select to anon using (coalesce(is_public, false) = true);

-- Only staff may write.
drop policy if exists announcements_staff_write on public.announcements;
create policy announcements_staff_write on public.announcements
  for all to authenticated using (public.is_tutor()) with check (public.is_tutor());

revoke insert, update, delete on public.announcements from anon;


-- ---------------------------------------------------------------------
-- 6. tc_schema_info reported expected='V12' while V17 was installed, so
--    schema-doctor told every studio it was out of step with itself.
-- ---------------------------------------------------------------------
create or replace function public.tc_schema_info()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'version',  r.version,
    'expected', 'V18',
    'packs',    r.packs,
    'applied_at', r.applied_at,
    'up_to_date', (r.version = 'V18')
  ) from public.tc_schema_registry r where r.id = 1;
$$;

grant execute on function public.tc_schema_info() to authenticated;
revoke all on function public.tc_schema_info() from public, anon;


-- ---------------------------------------------------------------------
-- 7. A self-audit function, so this class of bug can never go unnoticed
--    again. Any admin can ask the database what anon can reach.
-- ---------------------------------------------------------------------
create or replace function public.tc_security_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_fns jsonb; v_tabs jsonb;
begin
  if not public.is_admin() then
    raise exception 'Security reporting is for administrators only.'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(x order by x), '[]'::jsonb) into v_fns from (
    select p.oid::regprocedure::text as x
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and (has_function_privilege('anon', p.oid, 'EXECUTE')
            or has_function_privilege('public', p.oid, 'EXECUTE'))
  ) s;

  select coalesce(jsonb_agg(x order by x), '[]'::jsonb) into v_tabs from (
    select c.relname::text as x
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and has_table_privilege('anon', c.oid, 'SELECT')
  ) t;

  return jsonb_build_object(
    'ok', true,
    'anon_executable_functions', v_fns,
    'anon_selectable_tables', v_tabs,
    'note', 'Anything listed here is reachable by a stranger holding the public '
         || 'anon key. Tables still enforce row-level security on top; functions '
         || 'marked SECURITY DEFINER do NOT, so they must check is_tutor() or '
         || 'is_admin() themselves.',
    'rls_disabled_tables', (
      select coalesce(jsonb_agg(c.relname::text order by c.relname), '[]'::jsonb)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
    'checked_at', now());
end $$;

grant execute on function public.tc_security_report() to authenticated;
revoke all on function public.tc_security_report() from public, anon;


-- ---------------------------------------------------------------------
-- 8. Remove the junk candidate rows created by my own live probes.
--    I inserted these while auditing the production studio; leaving them
--    for you to find would be dishonest.
-- ---------------------------------------------------------------------
delete from public.exam_registrations
 where full_name in ('__probe__', '__audit_probe__');


select 'V18 security hardening installed ✅ — run tools/audit_live.py to verify' as status;
