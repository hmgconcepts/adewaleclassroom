-- ═══════════════════════════════════════════════════════════════════════
-- V49 — FAMILY LIBRARY ACCESS + HONEST REFS + NOTIFICATION CLEARING
-- (round 13)
--
-- Field reports this migration fixes:
--
--   ITEMS 6–9 — "unlinked" in the Class/Engagement columns of E-resources,
--   Mini LMS, Digital library and Resource library; and (for LMS and
--   Resource library) resources never appearing on the student portal.
--   Two separate root causes:
--     a) LMS lessons and Resource library rows have NO family read policy
--        at all — a student's query returns nothing, so assigned students
--        never see them (E-resources and Digital library already had
--        student policies, which is why those two DID appear).
--     b) The lookup that turns an engagement_id into a class name fails
--        for some staff accounts: is_tutor() requires profiles.status in
--        ('approved','active'), and staff rows created before that guard
--        (or with a NULL status) silently fail EVERY engagement read —
--        the CRUD then labels every linked row "Unlinked" even though it
--        is linked. NULL status is now treated as approved (legacy rows
--        only; anything else still needs approval).
--   Parents also gain visibility of the class-scoped shelves their
--   children see (GOSA parity: parents study with their children).
--
--   ITEM 10 — notifications could never be cleared: nobody had DELETE.
--   The addressed user may now delete their own notification rows.
--
--   ITEM 11 — reading links: reading_items and reading_progress were
--   staff-only, so a student opening a reading assignment saw no links
--   at all (and could never tick one done). Both are now family-readable
--   for their own assignments, and a learner can tick their own progress.
--
-- Idempotent: create-or-replace / drop-if-exists throughout.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. is_tutor(): a NULL status on a staff row means "created before the
--    approval workflow existed" — treat as approved. Denied statuses
--    ('suspended', 'pending', …) still block exactly as before.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.is_tutor()
returns boolean language plpgsql stable security definer as $$
begin
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','owner','director','lead_tutor','super_admin','tutor','staff')
      and coalesce(p.status, 'approved') in ('approved','active')
  );
end $$;

-- UPGRADE-ORDER GUARD (round-9 field-fix class): the policies below read
-- the engagement_id columns of the shelf tables, and the helper calls
-- is_parent_of(). On a legacy database running THIS file standalone
-- (migrations chain only), some of those columns/functions may not exist
-- yet. Guarantee them here; no-ops where present. The helper is plpgsql
-- on purpose: SQL-language bodies are validated at CREATE time and would
-- fail before is_parent_of() lands in that chain.
create or replace function public.is_parent_of(p_learner uuid)
returns boolean language plpgsql stable security definer as $$
begin
  return exists (
    select 1 from public.parent_learner pl
    join public.parents par on par.id = pl.parent_id
    where pl.learner_id = p_learner and par.user_id = auth.uid()
  );
end $$;

alter table public.eresources      add column if not exists engagement_id uuid;
alter table public.library_items   add column if not exists engagement_id uuid;
alter table public.lms_lessons     add column if not exists engagement_id uuid;
alter table public.resources       add column if not exists engagement_id uuid;
alter table public.reading_assignments add column if not exists engagement_id uuid;

-- ─────────────────────────────────────────────────────────────────────
-- 2. One family-read shape for every class-scoped shelf. The learner OR
--    either parent of the learner sees the row; unscoped rows (the
--    studio-wide shelf) are visible to every signed-in member.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tc_family_reads_engagement(p_engagement uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return p_engagement is null
      or exists (
        select 1
          from public.engagement_members em
          join public.learners l on l.id = em.learner_id
         where em.engagement_id = p_engagement
           and coalesce(em.status, 'active') = 'active'
           and (l.user_id = auth.uid() or public.is_parent_of(l.id))
      );
end $$;

-- E-resources / notes (item 6): add PARENTS to the existing student read.
drop policy if exists eresources_read on public.eresources;
create policy eresources_read on public.eresources
  for select to authenticated
  using (public.is_admin() or public.is_tutor() or public.tc_family_reads_engagement(engagement_id));

-- Digital library (item 8): same.
drop policy if exists library_items_read on public.library_items;
create policy library_items_read on public.library_items
  for select to authenticated
  using (public.is_admin() or public.is_tutor() or public.tc_family_reads_engagement(engagement_id));

-- Mini LMS (item 7): families see PUBLISHED lessons for their own
-- engagements (or the shared shelf). Drafts stay staff-only — a lesson
-- nobody has finished writing must not reach a student.
drop policy if exists lms_lessons_family_read on public.lms_lessons;
create policy lms_lessons_family_read on public.lms_lessons
  for select to authenticated
  using (
    public.is_admin() or public.is_tutor()
    or (coalesce(status, 'draft') = 'published' and public.tc_family_reads_engagement(engagement_id))
  );

-- Resource library (item 9): same shape as E-resources.
drop policy if exists resources_family_read on public.resources;
create policy resources_family_read on public.resources
  for select to authenticated
  using (public.is_admin() or public.is_tutor() or public.tc_family_reads_engagement(engagement_id));

-- ─────────────────────────────────────────────────────────────────────
-- 3. Reading assignments (item 11): the LINKS are reading_items — they
--    were staff-only, which is why students "clicked and nothing
--    happened" (there was nothing to click). Families now read the items
--    of their own assignments, and a learner can tick their own progress.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists reading_items_family_read on public.reading_items;
create policy reading_items_family_read on public.reading_items
  for select to authenticated
  using (
    public.is_admin() or public.is_tutor()
    or exists (
      select 1
        from public.reading_assignments ra
       where ra.id = reading_items.assignment_id
         and public.tc_family_reads_engagement(ra.engagement_id)
    )
  );

drop policy if exists reading_progress_family_read on public.reading_progress;
create policy reading_progress_family_read on public.reading_progress
  for select to authenticated
  using (
    public.is_admin() or public.is_tutor()
    or exists (
      select 1 from public.learners l
       where l.id = reading_progress.learner_id
         and (l.user_id = auth.uid() or public.is_parent_of(l.id))
    )
  );

drop policy if exists reading_progress_own_write on public.reading_progress;
create policy reading_progress_own_write on public.reading_progress
  for insert to authenticated
  with check (
    exists (select 1 from public.learners l where l.id = learner_id and l.user_id = auth.uid())
  );
drop policy if exists reading_progress_own_update on public.reading_progress;
create policy reading_progress_own_update on public.reading_progress
  for update to authenticated
  using (
    public.is_admin() or public.is_tutor()
    or exists (select 1 from public.learners l where l.id = learner_id and l.user_id = auth.uid())
  )
  with check (
    public.is_admin() or public.is_tutor()
    or exists (select 1 from public.learners l where l.id = learner_id and l.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────
-- 4. Notifications (item 10): notifications could never be cleared.
--    Semantics: a row that was addressed to YOU (recipient_id / user_id)
--    or authored BY you (created_by) is yours — you may DELETE it. A
--    shared broadcast row (audience all) belongs to everyone, so
--    deleting it would rip it out of other people's bells; for those,
--    clearing means the notif_clear() RPC appends your uid to cleared_by
--    and every fetch filters cleared rows per user (see fetchRecent in
--    notifications.js). The old own-insert policy keyed on user_id only,
--    which the app never sets — inserts would have been rejected; the
--    policy now accepts the columns the app actually writes.
-- ─────────────────────────────────────────────────────────────────────
alter table public.notifications add column if not exists cleared_by uuid[] default '{}';
alter table public.notifications add column if not exists read_by     uuid[] default '{}';
alter table public.notifications add column if not exists recipient_id uuid;
alter table public.notifications add column if not exists created_by   uuid;

drop policy if exists notifications_own_insert on public.notifications;
create policy notifications_own_insert on public.notifications
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or recipient_id = auth.uid()
    or created_by = auth.uid()
  );

drop policy if exists notifications_own_delete on public.notifications;
create policy notifications_own_delete on public.notifications
  for delete to authenticated
  using (
    user_id = auth.uid()
    or recipient_id = auth.uid()
    or created_by = auth.uid()
  );

-- notif_clear(p_ids): clear one, several, or ALL of my notifications.
--   • rows that are mine alone → deleted outright;
--   • shared broadcast rows   → hidden for me only (cleared_by append).
-- p_ids null → clear everything currently visible to me.
-- SECURITY DEFINER so the cleared_by update needs no blanket UPDATE policy.
create or replace function public.notif_clear(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_deleted integer := 0;
  v_hidden  integer := 0;
begin
  if v_me is null then return 0; end if;
  delete from public.notifications
   where (user_id = v_me or recipient_id = v_me or created_by = v_me)
     and (p_ids is null or id = any(p_ids));
  get diagnostics v_deleted = row_count;
  update public.notifications
     set cleared_by = array_append(coalesce(cleared_by, '{}'), v_me)
   where not (v_me = any(coalesce(cleared_by, '{}')))
     and (p_ids is null or id = any(p_ids))
     and user_id  is distinct from v_me
     and recipient_id is distinct from v_me
     and created_by is distinct from v_me;
  get diagnostics v_hidden = row_count;
  return v_deleted + v_hidden;
end $$;
grant execute on function public.notif_clear(uuid[]) to authenticated;
revoke all on function public.notif_clear(uuid[]) from public, anon;

-- ─────────────────────────────────────────────────────────────────────
-- 5. My Work board v2 (items 7 and 9, portal side): tc_my_work() fed
--    the learner dashboard but returned NO shelf sections, so even with
--    the family read policies above the work board "Class library" card
--    never filled. It now returns library / eresources / resources /
--    lms for the learner active engagements plus the studio-wide public
--    shelf (engagement_id null), published LMS lessons only.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tc_my_work(p_learner_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_learner_id uuid := p_learner_id;
  v_me public.learners%rowtype;
  v_eng_ids uuid[];
  v_out jsonb;
begin
  if v_learner_id is null then
    select l.* into v_me from public.learners l where l.user_id = auth.uid() limit 1;
  else
    if not public.is_family_of_learner(v_learner_id) and not public.tc_is_manager() then
      return jsonb_build_object('ok', false, 'reason', 'not_your_child');
    end if;
    select l.* into v_me from public.learners l where l.id = v_learner_id limit 1;
  end if;
  if v_me.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_learner_record');
  end if;

  select coalesce(array_agg(em.engagement_id), '{}') into v_eng_ids
    from public.engagement_members em
   where em.learner_id = v_me.id
     and coalesce(em.status, 'active') = 'active';

  select jsonb_build_object(
    'ok', true,
    'learner', jsonb_build_object('id', v_me.id, 'name', v_me.full_name, 'year', v_me.year_group),
    'engagements', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', e.id, 'name', e.name, 'subject', e.subject, 'kind', e.kind) order by e.name), '[]'::jsonb)
                      from public.engagements e
                     where e.id = any(v_eng_ids) and coalesce(e.status,'active') = 'active'),
    'homework', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', a.id, 'title', a.title, 'due', a.due_on, 'status', a.status,
                    'score', a.score, 'max', a.max_score,
                    'group', a.learner_id is null,
                    'engagement', (select e.name from public.engagements e where e.id = a.engagement_id)
                  ) order by a.due_on nulls last, a.created_at desc), '[]'::jsonb)
                  from public.assignments a
                 where (a.engagement_id = any(v_eng_ids) or a.learner_id = v_me.id)
                   and (a.learner_id is null or a.learner_id = v_me.id)),
    'reading', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', r.id, 'title', r.title, 'due', r.due_on, 'status', r.status,
                    'engagement', (select e.name from public.engagements e where e.id = r.engagement_id)
                  ) order by r.due_on nulls last, r.created_at desc), '[]'::jsonb)
                  from public.reading_assignments r
                 where r.engagement_id = any(v_eng_ids)),
    'exams', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', x.id, 'code', x.code, 'title', x.title, 'minutes', x.duration_min,
                    'kind', x.quiz_kind, 'subject', x.subject
                  ) order by x.created_at desc), '[]'::jsonb)
                  from public.cbt_exams x
                 where x.engagement_id = any(v_eng_ids)
                   and (lower(coalesce(x.status, 'draft')) in ('published','live','open')
                        or coalesce(x.is_open, false))),
    'next_class', (select jsonb_build_object(
                      'starts', s.starts_at,
                      'engagement', (select e.name from public.engagements e where e.id = s.engagement_id),
                      'url', s.meeting_url)
                     from public.sessions s
                    where s.engagement_id = any(v_eng_ids)
                      and s.starts_at >= now()
                      and coalesce(s.status, 'scheduled') = 'scheduled'
                    order by s.starts_at limit 1),
    'library', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', i.id, 'title', i.title, 'url', i.url, 'kind', i.kind,
                    'subject', i.subject, 'source', 'library',
                    'engagement', (select e.name from public.engagements e where e.id = i.engagement_id)
                  ) order by i.title), '[]'::jsonb)
                  from public.library_items i
                 where i.engagement_id = any(v_eng_ids) or i.engagement_id is null),
    'eresources', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', i.id, 'title', i.title, 'url', i.url, 'kind', i.kind,
                    'subject', i.subject, 'source', 'eresource',
                    'engagement', (select e.name from public.engagements e where e.id = i.engagement_id)
                  ) order by i.title), '[]'::jsonb)
                  from public.eresources i
                 where i.engagement_id = any(v_eng_ids) or i.engagement_id is null),
    'resources', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', i.id, 'title', i.title, 'url', i.url, 'kind', i.kind,
                    'source', 'resource',
                    'engagement', (select e.name from public.engagements e where e.id = i.engagement_id)
                  ) order by i.title), '[]'::jsonb)
                  from public.resources i
                 where i.engagement_id = any(v_eng_ids) or i.engagement_id is null),
    'lms', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', m.id, 'title', m.title, 'url', m.url, 'order', m.order_no,
                    'status', m.status,
                    'engagement', (select e.name from public.engagements e where e.id = m.engagement_id)
                  ) order by m.order_no nulls last, m.created_at desc), '[]'::jsonb)
                  from public.lms_lessons m
                 where m.engagement_id = any(v_eng_ids)
                   and coalesce(m.status, 'draft') = 'published')
  ) into v_out;
  return v_out;
end $$;

grant execute on function public.tc_my_work(uuid) to authenticated;
revoke all on function public.tc_my_work(uuid) from public, anon;

grant execute on function public.tc_family_reads_engagement(uuid) to authenticated;


-- PostgREST: make the new policies and function bodies visible immediately.
notify pgrst, 'reload schema';

select 'V49 family library access + honest refs + notification clearing installed ✅' as status;
