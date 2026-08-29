-- =============================================================================
-- Tutoring Connect · V40 — anonymous write + visibility hardening
-- =============================================================================
-- Audited 29 Aug 2026 against the LIVE production project
-- (yqwzbttehegvnvkrmxjz) using the shipped anon key.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- On Supabase, `anon` and `authenticated` receive blanket table privileges on
-- every table created in `public` (ALTER DEFAULT PRIVILEGES). A `grant` block
-- in this schema therefore never *narrows* anything: Row Level Security is the
-- ONLY boundary. And in PostgreSQL a policy written WITHOUT a `to <role>`
-- clause applies to PUBLIC — which includes `anon`.
--
-- Two consequences were measured live, not assumed:
--
--   1. LEAK. `notifications_own_read` (complete-schema.sql ~line 1948) is
--      `for select using (user_id = auth.uid() or user_id is null)` with no
--      role clause. The CBT trigger writes staff notifications with
--      `user_id IS NULL` and `audience='staff'`. For an anonymous caller
--      `auth.uid()` is NULL, so the `user_id is null` half matched and every
--      staff notification was world-readable.
--        measured: GET /rest/v1/notifications?select=*   -> HTTP 206, 18 rows
--                  e.g. "Sunday scored 4/10 (40.0%) — 9 integrity flag(s)"
--      The later `notifications_staff_read` policy did NOT fix this: Postgres
--      ORs permissive policies together, so the broad one still applied.
--
--   2. LEAK + WRITE. `forum_read` / `forum_thread_write` / `forum_post_write`
--      are `using (true)` / `with check (true)` with no role clause, so the
--      group-scoped forum was world-readable AND world-writable. The page's own
--      copy promises "Row Level Security enforces this in the database, not
--      just in the interface" — it did not.
--        measured: GET  /rest/v1/forum_threads            -> HTTP 200, 1 row
--                         (a private engagement thread + its engagement_id)
--                  POST /rest/v1/forum_threads            -> HTTP 201 CREATED
--
--      A 129-table anon-INSERT sweep found the write surface is exactly:
--        applications, cbt_results   <- intended (explicit anon grants exist)
--        forum_posts, forum_threads  <- NOT intended   (fixed here)
--        login_audit                 <- NOT intended   (fixed here)
--        inquiries                   <- intended (contact form)
--
-- WHAT THIS FILE DOES
-- -------------------
--   * makes notification visibility honour the `audience` column the client
--     already implements in Notifications.allowedForMe(), instead of treating
--     every NULL-user_id row as a public broadcast;
--   * scopes the forum to staff + members of the engagement it belongs to;
--   * stops anonymous INSERT on the forum and on login_audit;
--   * adds a RESTRICTIVE anonymous backstop so no future permissive policy can
--     silently re-open this surface;
--   * ships a verification block that must return 6 rows of `true`.
--
-- Idempotent and transactional. Safe to re-run.
-- KEEP THIS AS THE LAST MIGRATION: any future catalogue-wide grant/revoke loop
-- must be re-checked against it.
--
-- Deploy: paste this whole file into the Supabase SQL Editor and run it, or
--         run database/complete-schema.sql (this file is appended there too).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Audience helpers
--    SECURITY DEFINER + resolved purely from auth.uid(), so an anonymous caller
--    (auth.uid() IS NULL) gets FALSE from every branch. Executing them cannot
--    leak a row; they only ever answer "is this row for the caller?".
-- -----------------------------------------------------------------------------

create or replace function public.tc_role_of_caller()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(p.role, '')) from public.profiles p where p.id = auth.uid()
$$;

-- Does this notification row belong to the caller?
-- Mirrors assets/js/notifications.js -> Notifications.allowedForMe(n) exactly,
-- so the database and the bell can never disagree about who sees what.
create or replace function public.tc_notification_visible(
  p_user_id    uuid,
  p_audience   text,
  p_recipient  uuid,
  p_created_by uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid   := auth.uid();
  v_role text  := lower(coalesce(public.tc_role_of_caller(), ''));
  v_aud  text  := lower(coalesce(nullif(trim(p_audience), ''), 'all'));
begin
  if v_uid is null then return false; end if;                    -- anonymous: never

  -- owner-level roles see everything (App.isAdminRole)
  if v_role in ('super_admin','superadmin','admin','administrator',
                'owner','director','lead_tutor') then
    return true;
  end if;

  -- addressed to me personally
  if p_recipient is not null and p_recipient = v_uid then return true; end if;
  if p_user_id   is not null and p_user_id   = v_uid then return true; end if;

  -- studio-wide broadcast
  if v_aud in ('all','everyone','any') then return true; end if;

  -- private = author or named recipient only
  if v_aud = 'private' then
    return (p_created_by is not null and p_created_by = v_uid);
  end if;

  -- audience 'staff' also answers to 'tutor' / 'teacher'
  if v_aud in ('staff','teachers','tutors')
     and v_role in ('tutor','staff','teacher','lead_tutor') then
    return true;
  end if;

  -- plural audiences map onto singular roles
  if v_aud = 'parents'  and v_role in ('parent','parents','guardian') then return true; end if;
  if v_aud = 'families' and v_role in ('parent','parents','guardian') then return true; end if;
  if v_aud in ('students','learners')
     and v_role in ('student','learner','students','learners') then return true; end if;

  -- exact role match
  return v_aud = v_role;
end $$;

-- Is the caller a parent of / a learner in any family, for plural audiences?
create or replace function public.tc_caller_has_family_role(p_role text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  if p_role = 'parent' then
    return exists (select 1 from public.parents p where p.user_id = auth.uid());
  end if;
  if p_role in ('student','learner') then
    return exists (select 1 from public.learners l where l.user_id = auth.uid());
  end if;
  return false;
end $$;

-- Can the caller take part in this engagement's forum?
create or replace function public.tc_can_use_forum(p_engagement uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and ( public.is_tutor()
        or (p_engagement is not null and public.is_family_of_engagement(p_engagement)) )
$$;

grant execute on function public.tc_role_of_caller()                    to anon, authenticated;
grant execute on function public.tc_notification_visible(uuid,text,uuid,uuid) to anon, authenticated;
grant execute on function public.tc_caller_has_family_role(text)        to anon, authenticated;
grant execute on function public.tc_can_use_forum(uuid)                 to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. NOTIFICATIONS — visibility now follows `audience`, and only for signed-in
--    callers. Replaces the role-less `notifications_own_read` and subsumes
--    `notifications_staff_read`.
-- -----------------------------------------------------------------------------

drop policy if exists notifications_own_read   on public.notifications;

drop policy if exists notifications_visible on public.notifications;
create policy notifications_visible on public.notifications
  for select to authenticated
  using (
    public.tc_notification_visible(user_id, audience, recipient_id, created_by)
    or public.tc_notification_visible(
         user_id,
         case when audience is null and kind = 'cbt_result' then 'staff' else audience end,
         recipient_id, created_by)
  );

-- Only the person a notification is addressed to may mark it read.
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid() or recipient_id = auth.uid()
         or public.tc_notification_visible(user_id, audience, recipient_id, created_by))
  with check (user_id = auth.uid() or recipient_id = auth.uid()
         or public.tc_notification_visible(user_id, audience, recipient_id, created_by));

-- -----------------------------------------------------------------------------
-- 3. FORUM — group-scoped, signed-in only. No more anonymous read or write.
-- -----------------------------------------------------------------------------

drop policy if exists forum_read          on public.forum_threads;
drop policy if exists forum_thread_write  on public.forum_threads;
drop policy if exists forum_post_read     on public.forum_posts;
drop policy if exists forum_post_write    on public.forum_posts;

drop policy if exists forum_thread_read on public.forum_threads;
create policy forum_thread_read on public.forum_threads
  for select to authenticated
  using (public.tc_can_use_forum(engagement_id));

drop policy if exists forum_thread_insert on public.forum_threads;
create policy forum_thread_insert on public.forum_threads
  for insert to authenticated
  with check (public.tc_can_use_forum(engagement_id));

drop policy if exists forum_thread_delete on public.forum_threads;
create policy forum_thread_delete on public.forum_threads
  for delete to authenticated
  using (public.is_tutor());

drop policy if exists forum_post_read on public.forum_posts;
create policy forum_post_read on public.forum_posts
  for select to authenticated
  using (exists (
    select 1 from public.forum_threads t
    where t.id = forum_posts.thread_id
      and public.tc_can_use_forum(t.engagement_id)
  ));

drop policy if exists forum_post_insert on public.forum_posts;
create policy forum_post_insert on public.forum_posts
  for insert to authenticated
  with check (exists (
    select 1 from public.forum_threads t
    where t.id = forum_posts.thread_id
      and public.tc_can_use_forum(t.engagement_id)
  ));

-- NOTE: forum_posts has no author_id column (only author_name / author_role),
-- so post deletion is a staff action. Thread authors are likewise identified by
-- name, not by uuid, so the same applies to threads.
drop policy if exists forum_post_delete on public.forum_posts;
create policy forum_post_delete on public.forum_posts
  for delete to authenticated
  using (public.is_tutor());

-- -----------------------------------------------------------------------------
-- 4. LOGIN AUDIT — signed-in only. Both client-side writers already require a
--    signed-in profile (security-guard.js returns early when !window.TC_PROFILE;
--    change-password.html returns early when there is no email), and both wrap
--    the insert in try/catch, so tightening this breaks nothing.
-- -----------------------------------------------------------------------------

drop policy if exists login_audit_self_insert on public.login_audit;
create policy login_audit_self_insert on public.login_audit
  for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- -----------------------------------------------------------------------------
-- 5. Anonymous backstop.
--    RESTRICTIVE policies are ANDed with the permissive ones, so this closes
--    the whole anonymous surface regardless of what any future migration adds.
--    Deliberately narrow: it does not touch `anon`'s intended paths, which are
--    INSERTs into applications / inquiries / cbt_results / exam_registrations
--    and the anon RPC allow-list.
-- -----------------------------------------------------------------------------

drop policy if exists tc_anon_read_blocked on public.notifications;
create policy tc_anon_read_blocked on public.notifications
  as restrictive for select to anon using (false);

drop policy if exists tc_anon_write_blocked on public.notifications;
create policy tc_anon_write_blocked on public.notifications
  as restrictive for all to anon using (false) with check (false);

drop policy if exists tc_anon_read_blocked on public.forum_threads;
create policy tc_anon_read_blocked on public.forum_threads
  as restrictive for select to anon using (false);

drop policy if exists tc_anon_write_blocked on public.forum_threads;
create policy tc_anon_write_blocked on public.forum_threads
  as restrictive for all to anon using (false) with check (false);

drop policy if exists tc_anon_read_blocked on public.forum_posts;
create policy tc_anon_read_blocked on public.forum_posts
  as restrictive for select to anon using (false);

drop policy if exists tc_anon_write_blocked on public.forum_posts;
create policy tc_anon_write_blocked on public.forum_posts
  as restrictive for all to anon using (false) with check (false);

drop policy if exists tc_anon_write_blocked on public.login_audit;
create policy tc_anon_write_blocked on public.login_audit
  as restrictive for all to anon using (false) with check (false);

commit;

-- =============================================================================
-- VERIFICATION — run this after the migration. Every row must read true.
-- =============================================================================
-- with p as (
--   select tablename, policyname, permissive, roles, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('notifications','forum_threads','forum_posts','login_audit')
-- )
-- select
--   bool_and(not (tablename='notifications' and policyname='notifications_own_read'))            as old_broad_policy_gone,
--   bool_and(not (tablename='forum_threads' and policyname='forum_thread_write'))                as old_forum_write_gone,
--   bool_and(not (tablename='forum_posts'   and policyname='forum_post_write'))                  as old_forum_post_write_gone,
--   bool_and(not (tablename='login_audit'   and policyname='login_audit_self_insert'
--                 and roles::text = '{public}'))                                                 as login_audit_scoped,
--   bool_or(tablename='notifications' and policyname='tc_anon_read_blocked'
--           and permissive='RESTRICTIVE')                                                        as notif_anon_backstop,
--   bool_or(tablename='forum_threads' and policyname='tc_anon_write_blocked'
--           and permissive='RESTRICTIVE')                                                        as forum_anon_backstop
-- from p;
--
-- Then confirm from the browser console while signed OUT:
--   await (await fetch('<url>/rest/v1/notifications?select=*',
--     {headers:{apikey:'<anon key>'}})).json()      -> must be [] or 401
--   await (await fetch('<url>/rest/v1/forum_threads?select=*',
--     {headers:{apikey:'<anon key>'}})).json()      -> must be [] or 401
--
-- =============================================================================
-- CLEANUP — remove the rows the 29 Aug 2026 audit probe wrote to the live
-- project. Run once, as a privileged role (service_role / SQL Editor).
-- =============================================================================
-- delete from public.forum_threads where title = '__SECURITY_PROBE_DELETE_ME__';
-- delete from public.login_audit   where event is null and email is null and user_id is null;
-- delete from public.cbt_results   where candidate_name is null and exam_id is null;

notify pgrst, 'reload schema';

select 'Tutoring Connect V40 — anonymous write + visibility hardening installed ✅' as status;
