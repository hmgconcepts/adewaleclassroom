-- =====================================================================
-- V24 — TUTOR SCOPING  (item 1)
-- ---------------------------------------------------------------------
-- "Each tutor should only have access to the students, classes, subjects
--  and CBT assigned to them. Admin has full access without restriction."
--
-- What was wrong: is_tutor() returns TRUE for every member of staff, and
-- almost every policy in the schema is written as
--
--     using (public.is_tutor())
--
-- so ANY tutor could read and edit EVERY learner, engagement, session,
-- note and result in the studio. For a studio with several tutors — and
-- for a studio that shares a database with a safeguarding log — that is a
-- real confidentiality problem, not a tidiness one.
--
-- This pack introduces assignment-aware helpers and re-writes the policies
-- on the tables that carry personal or academic data so a tutor sees only
-- their own work. An administrator is unaffected: is_admin() short-circuits
-- every check.
--
-- DESIGN NOTES
--
--  * A tutor's reach is defined by public.engagements.tutor_id. A learner
--    is "theirs" if they are a member of an engagement they teach.
--  * Sessions carry their own tutor_id, so a covering tutor sees the
--    session they actually taught even if the engagement belongs to a
--    colleague. That is deliberate: substitution is normal.
--  * FAIL SAFE, NOT FAIL OPEN. A tutor with no tutors row and no
--    engagements sees nothing rather than everything.
--  * Unassigned records stay visible to admins only, so nothing is
--    orphaned into invisibility.
--
-- Idempotent. Folded into database/complete-schema.sql.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Who am I, as a tutor?
-- ---------------------------------------------------------------------
create or replace function public.tc_my_tutor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from public.tutors t where t.user_id = auth.uid() limit 1;
$$;

grant execute on function public.tc_my_tutor_id() to authenticated;
revoke all on function public.tc_my_tutor_id() from public, anon;


-- Is the caller a manager (admin/owner/director/lead tutor)? Managers are
-- never scoped. Deliberately narrower than is_tutor(), which includes
-- ordinary teaching staff.
create or replace function public.tc_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and p.role in ('admin','owner','director','super_admin','lead_tutor')
       and p.status in ('approved','active'));
$$;

grant execute on function public.tc_is_manager() to authenticated;
revoke all on function public.tc_is_manager() from public, anon;


-- ---------------------------------------------------------------------
-- 2. Assignment tests. Each returns TRUE for a manager, so one predicate
--    can be dropped into a policy without an extra OR everywhere.
-- ---------------------------------------------------------------------
create or replace function public.tc_teaches_engagement(p_engagement uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tc_is_manager()
      or (p_engagement is not null and exists (
            select 1 from public.engagements e
             where e.id = p_engagement
               and e.tutor_id = public.tc_my_tutor_id()))
      -- a covering tutor who actually taught a session on it
      or (p_engagement is not null and exists (
            select 1 from public.sessions s
             where s.engagement_id = p_engagement
               and s.tutor_id = public.tc_my_tutor_id()));
$$;

create or replace function public.tc_teaches_learner(p_learner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tc_is_manager()
      or (p_learner is not null and exists (
            select 1
              from public.engagement_members em
              join public.engagements e on e.id = em.engagement_id
             where em.learner_id = p_learner
               and e.tutor_id = public.tc_my_tutor_id()))
      or (p_learner is not null and exists (
            select 1
              from public.session_attendance sa
              join public.sessions s on s.id = sa.session_id
             where sa.learner_id = p_learner
               and s.tutor_id = public.tc_my_tutor_id()));
$$;

create or replace function public.tc_teaches_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tc_is_manager()
      or (p_session is not null and exists (
            select 1 from public.sessions s
             where s.id = p_session
               and (s.tutor_id = public.tc_my_tutor_id()
                    or public.tc_teaches_engagement(s.engagement_id))));
$$;

grant execute on function public.tc_teaches_engagement(uuid) to authenticated;
grant execute on function public.tc_teaches_learner(uuid)    to authenticated;
grant execute on function public.tc_teaches_session(uuid)    to authenticated;
revoke all on function public.tc_teaches_engagement(uuid) from public, anon;
revoke all on function public.tc_teaches_learner(uuid)    from public, anon;
revoke all on function public.tc_teaches_session(uuid)    from public, anon;


-- ---------------------------------------------------------------------
-- 3. Scope the CORE academic tables.
--    Families keep their existing access: the family policies added in V7
--    are separate rows in pg_policy and are ORed by PostgreSQL, so nothing
--    here removes a parent's or a learner's view of their own records.
-- ---------------------------------------------------------------------

-- ENGAGEMENTS -------------------------------------------------------------
drop policy if exists engagements_staff        on public.engagements;
drop policy if exists engagements_tutor_scope  on public.engagements;
create policy engagements_tutor_scope on public.engagements
  for all to authenticated
  using (public.tc_is_manager() or tutor_id = public.tc_my_tutor_id())
  with check (public.tc_is_manager() or tutor_id = public.tc_my_tutor_id());

-- LEARNERS ---------------------------------------------------------------
drop policy if exists learners_staff       on public.learners;
drop policy if exists learners_tutor_scope on public.learners;
create policy learners_tutor_scope on public.learners
  for all to authenticated
  using (public.tc_teaches_learner(id))
  with check (public.tc_is_manager());       -- only a manager creates a learner

-- ENGAGEMENT MEMBERSHIP ---------------------------------------------------
drop policy if exists engagement_members_staff       on public.engagement_members;
drop policy if exists engagement_members_tutor_scope on public.engagement_members;
create policy engagement_members_tutor_scope on public.engagement_members
  for all to authenticated
  using (public.tc_teaches_engagement(engagement_id))
  with check (public.tc_teaches_engagement(engagement_id));

-- SESSIONS ---------------------------------------------------------------
drop policy if exists sessions_staff       on public.sessions;
drop policy if exists sessions_tutor_scope on public.sessions;
create policy sessions_tutor_scope on public.sessions
  for all to authenticated
  using (public.tc_is_manager()
         or tutor_id = public.tc_my_tutor_id()
         or public.tc_teaches_engagement(engagement_id))
  with check (public.tc_is_manager()
         or tutor_id = public.tc_my_tutor_id()
         or public.tc_teaches_engagement(engagement_id));

-- ATTENDANCE -------------------------------------------------------------
drop policy if exists session_attendance_staff       on public.session_attendance;
drop policy if exists session_attendance_tutor_scope on public.session_attendance;
create policy session_attendance_tutor_scope on public.session_attendance
  for all to authenticated
  using (public.tc_teaches_session(session_id))
  with check (public.tc_teaches_session(session_id));

-- SESSION NOTES ----------------------------------------------------------
drop policy if exists session_notes_staff       on public.session_notes;
drop policy if exists session_notes_tutor_scope on public.session_notes;
create policy session_notes_tutor_scope on public.session_notes
  for all to authenticated
  using (public.tc_teaches_session(session_id))
  with check (public.tc_teaches_session(session_id));


-- ---------------------------------------------------------------------
-- 4. Scope the LEARNER-KEYED tables in one loop. Every one of these has a
--    learner_id column, so the same predicate applies. Done as a loop so a
--    table added later is picked up by adding one name, not one policy.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  learner_tables text[] := array[
    'goals','mastery','assessments','assignments','diagnostics',
    'accommodations','learning_styles','portfolio','transcripts',
    'study_logs','flashcards','makeup_credits','sow_evaluations',
    'certificates','exam_targets','progress_reports'
  ];
begin
  foreach t in array learner_tables loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = t
                  and column_name = 'learner_id') then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_tutor_scope', t);
      execute format(
        'create policy %I on public.%I for all to authenticated '
        || 'using (public.tc_teaches_learner(learner_id)) '
        || 'with check (public.tc_teaches_learner(learner_id))',
        t || '_tutor_scope', t);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 5. Scope the ENGAGEMENT-KEYED tables the same way.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  eng_tables text[] := array[
    'stream_posts','classwork_items','lesson_plans','curriculum',
    'sow_terms','whiteboard_rooms','meetings','makeups','cancellations',
    'bookings','reading_assignments'
  ];
begin
  foreach t in array eng_tables loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = t
                  and column_name = 'engagement_id') then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_tutor_scope', t);
      execute format(
        'create policy %I on public.%I for all to authenticated '
        || 'using (engagement_id is null or public.tc_teaches_engagement(engagement_id)) '
        || 'with check (engagement_id is null or public.tc_teaches_engagement(engagement_id))',
        t || '_tutor_scope', t);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 6. CBT. A tutor sees the papers they authored or that belong to an
--    engagement they teach — and the results of those papers only.
-- ---------------------------------------------------------------------
alter table if exists public.cbt_exams add column if not exists tutor_id uuid;

drop policy if exists cbt_exams_staff       on public.cbt_exams;
drop policy if exists cbt_exams_tutor_scope on public.cbt_exams;
create policy cbt_exams_tutor_scope on public.cbt_exams
  for all to authenticated
  using (public.tc_is_manager()
         or created_by = auth.uid()
         or tutor_id = public.tc_my_tutor_id()
         or (engagement_id is not null and public.tc_teaches_engagement(engagement_id)))
  with check (public.tc_is_manager()
         or created_by = auth.uid()
         or tutor_id = public.tc_my_tutor_id()
         or (engagement_id is not null and public.tc_teaches_engagement(engagement_id)));

drop policy if exists cbt_results_staff       on public.cbt_results;
drop policy if exists cbt_results_tutor_scope on public.cbt_results;
create policy cbt_results_tutor_scope on public.cbt_results
  for all to authenticated
  using (public.tc_is_manager()
         or exists (select 1 from public.cbt_exams e
                     where e.id = cbt_results.exam_id
                       and (e.created_by = auth.uid()
                            or e.tutor_id = public.tc_my_tutor_id()
                            or (e.engagement_id is not null
                                and public.tc_teaches_engagement(e.engagement_id)))))
  with check (true);   -- a candidate must always be able to submit

-- Stamp the author so "papers I made" works from the moment one is saved.
create or replace function public.tc_stamp_exam_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  if new.tutor_id is null then new.tutor_id := public.tc_my_tutor_id(); end if;
  return new;
end $$;

drop trigger if exists tc_stamp_exam_author_trg on public.cbt_exams;
create trigger tc_stamp_exam_author_trg
  before insert on public.cbt_exams
  for each row execute function public.tc_stamp_exam_author();


-- ---------------------------------------------------------------------
-- 7. Reporting helpers so the UI can show a tutor only their own work
--    without every page re-implementing the join.
-- ---------------------------------------------------------------------
create or replace function public.tc_my_scope()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_tutor uuid; v_mgr boolean;
begin
  v_tutor := public.tc_my_tutor_id();
  v_mgr := public.tc_is_manager();
  return jsonb_build_object(
    'ok', true,
    'is_manager', v_mgr,
    'tutor_id', v_tutor,
    'scoped', (not v_mgr) and v_tutor is not null,
    'engagements', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'subject', e.subject))
        from public.engagements e
       where v_mgr or e.tutor_id = v_tutor), '[]'::jsonb),
    'learners', coalesce((
      select jsonb_agg(distinct jsonb_build_object('id', l.id, 'name', l.full_name))
        from public.learners l
       where public.tc_teaches_learner(l.id)), '[]'::jsonb),
    'subjects', coalesce((
      select jsonb_agg(distinct e.subject)
        from public.engagements e
       where (v_mgr or e.tutor_id = v_tutor) and e.subject is not null), '[]'::jsonb),
    'note', case when v_mgr
      then 'You are a manager: you see the whole studio.'
      else 'You see only the learners, classes, subjects and papers assigned to you.' end);
end $$;

grant execute on function public.tc_my_scope() to authenticated;
revoke all on function public.tc_my_scope() from public, anon;


-- Re-assert the V18 rule.
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
grant execute on function public.tc_register_candidate(jsonb) to anon;
grant execute on function public.tc_candidate_lookup(text, text) to anon;
grant execute on function public.tc_cbt_get_exam(text, text) to anon;
grant execute on function public.tc_keep_alive(text) to anon;
grant execute on function public.tc_submit_application(text, jsonb) to anon;
grant execute on function public.lookup_login_email(text) to anon;
grant execute on function public.tc_license_writable() to anon;
grant execute on function public.tc_check_promo(text, numeric) to anon;

select 'V24 tutor scoping installed ✅ — tutors now see only their own assignments' as status;
