-- ═══════════════════════════════════════════════════════════════════════
-- V53 — CREDENTIAL-TRUTH RPCs + BACKUP STAMP + TUTOR ISOLATION +
--        STAFF MONITOR (round 17)
--
-- Field reports this migration fixes:
--
--   ITEM 1+2 — "Restore TURN Key from Cloud: nothing saved yet" although
--   the key WAS saved on device A, and "the cloud copy failed: unknown".
--   The deck's REST upsert (`POST /user_settings?on_conflict=…` with
--   Prefer: resolution=merge-duplicates) is fragile: any mismatch between
--   what the live database actually has and what the request assumes —
--   a differently-shaped user_settings table, a missing unique
--   constraint, a renamed column, an unexpected PostgREST version —
--   comes back as a bare 4xx whose BODY the deck never read, so the
--   push failed with "unknown" and the account stayed empty on every
--   device. The write now goes through a SECURITY-DEFINER RPC that
--   upserts server-side, inside the database, where the primary key
--   (user_id, key) is guaranteed: tc_set_user_setting. Reads go through
--   tc_get_user_settings. No PostgREST upsert semantics, no merge
--   headers, no client-side column list — one call, one result.
--
--   ITEM 3 — "Last backup: never" persisted because the client-side
--   UPDATE of practice_settings can be silently reduced to 0 rows by
--   row-level security (an UPDATE that passes no rows is NOT an error).
--   tc_stamp_backup() records the studio-wide timestamp + archive path
--   as a security-definer RPC for any owner/admin, so the stamp cannot
--   be lost to policy drift again.
--
--   ITEM 4 — tutors saw EVERY library item / e-resource / resource /
--   LMS lesson (staff-wide read policies). A tutor now sees only:
--     · rows they created themselves (tutor_id = their tutor id),
--     · rows scoped to engagements they teach, and
--     · the studio's own shared shelf (no engagement, no tutor).
--   And the admin gains the monitoring surface: tc_tutor_monitor()
--   aggregates EVERYTHING a tutor has done — engagements, students,
--   subjects, classes taken, bookings (completed / ongoing / missed),
--   topics covered, CBTs created, assignments, payroll history — and
--   tc_parent_monitor() does the same for a parent (children, their
--   classes and tutors, invoices and payments).
--
-- Idempotent: create-or-replace / drop-policy-if-exists throughout;
-- safe to run twice and on any V47+ database (complete-schema.sql
-- carries this section for new installs).
-- ═══════════════════════════════════════════════════════════════════════


-- UPGRADE-ORDER GUARD (the round-9 field-fix class): this migration's
-- policies use tc_teaches_engagement()/tc_my_tutor_id() and the
-- library_items/eresources tutor_id columns. All of these live in earlier
-- packs (v24 tutor scoping, v43 per-class library), but a legacy database
-- running THIS file standalone on the v44+ migration chain has none of
-- them yet. create-or-replace with the canonical bodies / add-column-
-- if-not-exists is a no-op where they already exist.

alter table if exists public.sessions
  add column if not exists tutor_id uuid references public.tutors(id);

create or replace function public.tc_my_tutor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from public.tutors t where t.user_id = auth.uid() limit 1;
$$;

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
      or (p_engagement is not null and exists (
            select 1 from public.sessions s
             where s.engagement_id = p_engagement
               and s.tutor_id = public.tc_my_tutor_id()));
$$;

alter table if exists public.library_items
  add column if not exists tutor_id uuid references public.tutors(id) on delete set null;
alter table if exists public.eresources
  add column if not exists tutor_id uuid references public.tutors(id) on delete set null;

grant execute on function public.tc_my_tutor_id() to authenticated;
revoke all on function public.tc_my_tutor_id() from public, anon;
grant execute on function public.tc_is_manager() to authenticated;
revoke all on function public.tc_is_manager() from public, anon;
grant execute on function public.tc_teaches_engagement(uuid) to authenticated;
revoke all on function public.tc_teaches_engagement(uuid) from public, anon;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. CREDENTIAL TRUTH — per-account settings written and read by RPC.
--    The deck calls these with the portal session token; the database
--    does the upsert. This removes the entire class of silent REST
--    upsert failures (constraint shape, column drift, Prefer header
--    semantics) that left accounts empty while devices believed they
--    had saved.
-- ----------------------------------------------------------------------------
create or replace function public.tc_set_user_setting(p_key text, p_value jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.user_settings (user_id, key, value, updated_at)
  values (auth.uid(), coalesce(p_key, ''), coalesce(p_value, '{}'::jsonb), now())
  on conflict (user_id, key)
  do update set value = excluded.value, updated_at = now();
  return true;
end $$;

create or replace function public.tc_get_user_settings()
returns table (key text, value jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.key, s.value, s.updated_at
  from public.user_settings s
  where s.user_id = auth.uid()
  order by s.key
$$;

revoke all on function public.tc_set_user_setting(text, jsonb) from public, anon;
revoke all on function public.tc_get_user_settings() from public, anon;
grant execute on function public.tc_set_user_setting(text, jsonb) to authenticated;
grant execute on function public.tc_get_user_settings() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. BACKUP STAMP — the studio-wide "last backup" truth, written by RPC.
--    An RLS-rejected table UPDATE is a silent no-op; an RPC either
--    stamps the row or raises. Every backup path (local download,
--    DataTools, Google Drive) calls this with the archive's location.
-- ----------------------------------------------------------------------------
create or replace function public.tc_stamp_backup(p_path text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'only owners and administrators record studio backups';
  end if;
  update public.practice_settings
     set last_backup_at = now(),
         backup_path = coalesce(nullif(btrim(coalesce(p_path, '')), ''), practice_settings.backup_path)
   where id = 1;
  if not found then
    insert into public.practice_settings (id, name, last_backup_at, backup_path)
    values (1, 'Studio', now(), nullif(btrim(coalesce(p_path, '')), ''))
    on conflict (id) do update
      set last_backup_at = now(),
          backup_path = coalesce(nullif(btrim(coalesce(p_path, '')), ''), public.practice_settings.backup_path);
  end if;
  return (select p.last_backup_at from public.practice_settings p where p.id = 1);
end $$;

revoke all on function public.tc_stamp_backup(text) from public, anon;
grant execute on function public.tc_stamp_backup(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. TUTOR CONTENT ISOLATION (item 4). A tutor's read of the content
--    shelves narrows to their own rows, their engagements' rows and the
--    studio-shared shelf. Admins keep full sight. Family read paths are
--    unchanged.
-- ----------------------------------------------------------------------------
drop policy if exists library_items_read on public.library_items;
create policy library_items_read on public.library_items
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_tutor() and (
          library_items.tutor_id = public.tc_my_tutor_id()
          or (library_items.engagement_id is not null and public.tc_teaches_engagement(library_items.engagement_id))
          or (library_items.engagement_id is null and library_items.tutor_id is null)
        ))
    or public.tc_family_reads_engagement(library_items.engagement_id)
  );

drop policy if exists eresources_read on public.eresources;
create policy eresources_read on public.eresources
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_tutor() and (
          eresources.tutor_id = public.tc_my_tutor_id()
          or (eresources.engagement_id is not null and public.tc_teaches_engagement(eresources.engagement_id))
          or (eresources.engagement_id is null and eresources.tutor_id is null)
        ))
    or public.tc_family_reads_engagement(eresources.engagement_id)
  );

drop policy if exists resources_family_read on public.resources;
create policy resources_family_read on public.resources
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_tutor() and (
          (resources.engagement_id is not null and public.tc_teaches_engagement(resources.engagement_id))
          or resources.engagement_id is null
        ))
    or public.tc_family_reads_engagement(resources.engagement_id)
  );

drop policy if exists lms_lessons_family_read on public.lms_lessons;
create policy lms_lessons_family_read on public.lms_lessons
  for select to authenticated
  using (
    public.is_admin()
    or (public.is_tutor() and (
          (lms_lessons.engagement_id is not null and public.tc_teaches_engagement(lms_lessons.engagement_id))
          or lms_lessons.engagement_id is null
        ))
    or (coalesce(lms_lessons.status, 'draft') = 'published'
        and public.tc_family_reads_engagement(lms_lessons.engagement_id))
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. THE TUTOR MONITOR (item 4). One call, everything the admin needs to
--    audit one tutor: profile, engagements, students, subjects, classes
--    taken, bookings completed/ongoing/missed, topics covered, CBTs
--    created, assignments set, library items authored, payroll history
--    and the upcoming schedule. Manager-only: a tutor cannot monitor
--    themselves or anyone else through this door.
-- ----------------------------------------------------------------------------
create or replace function public.tc_tutor_monitor(p_tutor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t    public.tutors%rowtype;
  uid  uuid;
  engs uuid[];
begin
  if not public.tc_is_manager() then
    return jsonb_build_object('ok', false, 'reason', 'admin only — the tutor monitor is for owners and administrators');
  end if;

  select * into t from public.tutors where id = p_tutor_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no tutor carries that id');
  end if;
  uid := t.user_id;
  select coalesce(array(select e.id from public.engagements e where e.tutor_id = p_tutor_id), '{}')
    into engs;

  return jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'id', t.id, 'full_name', t.full_name, 'email', t.email, 'phone', t.phone,
      'timezone', t.timezone, 'specialisms', t.specialisms,
      'hourly_cost', t.hourly_cost, 'status', t.status,
      'portal_email', (select p.email from public.profiles p where p.id = uid),
      'portal_role',  (select p.role  from public.profiles p where p.id = uid)
    ),
    'engagements', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', e.id, 'name', e.name, 'kind', e.kind, 'subject', e.subject,
               'status', e.status, 'hourly_rate', e.hourly_rate,
               'hours_prepaid', e.hours_prepaid, 'hours_used', e.hours_used
             ) order by e.name), '[]'::jsonb)
      from public.engagements e where e.tutor_id = p_tutor_id
    ),
    'students', (
      select coalesce(jsonb_agg(distinct jsonb_build_object(
               'id', l.id, 'full_name', l.full_name, 'student_no', l.student_no
             )), '[]'::jsonb)
      from public.engagement_members em
      join public.learners l on l.id = em.learner_id
      where em.engagement_id = any(engs)
    ),
    'subjects', (
      select coalesce(jsonb_agg(distinct e.subject), '[]'::jsonb)
      from public.engagements e
      where e.tutor_id = p_tutor_id and e.subject is not null
    ),
    'sessions', jsonb_build_object(
      'total', (select count(*) from public.sessions s where s.tutor_id = p_tutor_id),
      'completed', (select count(*) from public.sessions s
                    where s.tutor_id = p_tutor_id
                      and coalesce(s.status, '') ilike 'complete%'),
      'upcoming', (select count(*) from public.sessions s
                   where s.tutor_id = p_tutor_id and s.starts_at >= now()),
      'hours', (select coalesce(sum(s.hours), 0) from public.sessions s where s.tutor_id = p_tutor_id),
      'recent', (select coalesce(jsonb_agg(x order by x.starts_at desc), '[]'::jsonb) from (
                   select s.id, s.starts_at, s.ends_at, s.status, s.mode,
                          (select e.name from public.engagements e where e.id = s.engagement_id) as engagement
                   from public.sessions s
                   where s.tutor_id = p_tutor_id
                   order by s.starts_at desc limit 12
                 ) x)
    ),
    'bookings', jsonb_build_object(
      'completed', (select count(*) from public.booking_classes bc
                    join public.booking_blocks bb on bb.id = bc.block_id
                    where bb.engagement_id = any(engs) and bc.status = 'done'),
      'ongoing', (select count(*) from public.booking_classes bc
                  join public.booking_blocks bb on bb.id = bc.block_id
                  where bb.engagement_id = any(engs)
                    and bc.status = 'scheduled' and bc.scheduled_at >= now()),
      'missed', (select count(*) from public.booking_classes bc
                 join public.booking_blocks bb on bb.id = bc.block_id
                 where bb.engagement_id = any(engs) and bc.status = 'missed'),
      'cancelled', (select count(*) from public.booking_classes bc
                    join public.booking_blocks bb on bb.id = bc.block_id
                    where bb.engagement_id = any(engs) and bc.status = 'cancelled'),
      'computed_earnings', (select coalesce(sum(bb.computed_amount), 0) from public.booking_blocks bb
                            where bb.engagement_id = any(engs) and bb.status = 'active'),
      'recent', (select coalesce(jsonb_agg(x order by x.scheduled_at desc), '[]'::jsonb) from (
                   select bc.scheduled_at, bc.duration_minutes, bc.status,
                          bc.topics_covered, bc.completed_at,
                          (select e.name from public.engagements e where e.id = bb.engagement_id) as engagement
                   from public.booking_classes bc
                   join public.booking_blocks bb on bb.id = bc.block_id
                   where bb.engagement_id = any(engs)
                   order by bc.scheduled_at desc limit 12
                 ) x)
    ),
    'topics_covered', (
      select coalesce(jsonb_agg(distinct bc.topics_covered), '[]'::jsonb)
      from public.booking_classes bc
      join public.booking_blocks bb on bb.id = bc.block_id
      where bb.engagement_id = any(engs)
        and coalesce(btrim(bc.topics_covered), '') <> ''
    ),
    'sow_taught', (
      select coalesce(jsonb_agg(distinct st.topic), '[]'::jsonb)
      from public.sow_topics st
      join public.sow_terms s on s.id = st.term_id
      where s.engagement_id = any(engs) and st.status = 'taught'
    ),
    'cbts', jsonb_build_object(
      'count', (select count(*) from public.cbt_exams c
                where c.tutor_id = p_tutor_id or c.created_by = uid),
      'recent', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
                   select c.id, c.title, c.status, c.created_at, c.code
                   from public.cbt_exams c
                   where c.tutor_id = p_tutor_id or c.created_by = uid
                   order by c.created_at desc limit 12
                 ) x)
    ),
    'assignments_set', (
      select count(*) from public.assignments a where a.engagement_id = any(engs)
    ),
    'library_items_authored', (
      select count(*) from public.library_items li where li.tutor_id = p_tutor_id
    ),
    'payroll_history', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'period', pr.period, 'hours', pr.hours, 'rate', pr.rate,
               'gross', pr.gross, 'status', pr.status, 'created_at', pr.created_at
             ) order by pr.created_at desc), '[]'::jsonb)
      from public.payroll pr
      where lower(pr.tutor_name) = lower(t.full_name)
    )
  );
end $$;

revoke all on function public.tc_tutor_monitor(uuid) from public, anon;
grant execute on function public.tc_tutor_monitor(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. THE PARENT MONITOR (item 4). The admin's complete view of one
--    parent: profile, children, each child's classes and tutors, the
--    invoice + payment history, and the family's upcoming sessions.
--    Manager-only.
-- ----------------------------------------------------------------------------
create or replace function public.tc_parent_monitor(p_parent_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.parents%rowtype;
  kids uuid[];
begin
  if not public.tc_is_manager() then
    return jsonb_build_object('ok', false, 'reason', 'admin only — the parent monitor is for owners and administrators');
  end if;

  select * into p from public.parents where id = p_parent_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no parent carries that id');
  end if;
  select coalesce(array(select pl.learner_id from public.parent_learner pl where pl.parent_id = p_parent_id), '{}')
    into kids;

  return jsonb_build_object(
    'ok', true,
    'profile', jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'email', p.email, 'phone', p.phone,
      'billing_name', p.billing_name, 'address', p.address, 'status', p.status,
      'timezone', p.timezone,
      'portal_email', (select pr.email from public.profiles pr where pr.id = p.user_id),
      'portal_role',  (select pr.role  from public.profiles pr where pr.id = p.user_id)
    ),
    'children', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', l.id, 'full_name', l.full_name, 'student_no', l.student_no,
               'engagements', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'name', e.name, 'subject', e.subject, 'kind', e.kind,
                          'tutor', (select t2.full_name from public.tutors t2 where t2.id = e.tutor_id),
                          'status', e.status
                        ) order by e.name), '[]'::jsonb)
                 from public.engagement_members em
                 join public.engagements e on e.id = em.engagement_id
                 where em.learner_id = l.id
               )
             ) order by l.full_name), '[]'::jsonb)
      from public.learners l where l.id = any(kids)
    ),
    'invoices', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', i.id, 'amount', i.amount, 'currency', i.currency,
               'due_on', i.due_on, 'status', i.status, 'created_at', i.created_at,
               'paid', (select coalesce(sum(pay.amount), 0) from public.payments pay where pay.invoice_id = i.id)
             ) order by i.created_at desc), '[]'::jsonb)
      from public.invoices i where i.parent_id = p_parent_id
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'amount', pay.amount, 'method', pay.method, 'reference', pay.reference,
               'paid_on', pay.paid_on,
               'invoice_amount', (select i.amount from public.invoices i where i.id = pay.invoice_id)
             ) order by pay.paid_on desc), '[]'::jsonb)
      from public.payments pay
      join public.invoices i on i.id = pay.invoice_id
      where i.parent_id = p_parent_id
    ),
    'upcoming_sessions', (
      select coalesce(jsonb_agg(x order by x.starts_at), '[]'::jsonb) from (
        select s.starts_at, s.mode,
               (select e.name from public.engagements e where e.id = s.engagement_id) as engagement,
               (select l2.full_name from public.learners l2 where l2.id = sa.learner_id) as learner
        from public.sessions s
        join public.session_attendance sa on sa.session_id = s.id
        where s.engagement_id in (
              select em.engagement_id from public.engagement_members em
              where em.learner_id = any(kids))
          and s.starts_at >= now()
        order by s.starts_at limit 10
      ) x
    )
  );
end $$;

revoke all on function public.tc_parent_monitor(uuid) from public, anon;
grant execute on function public.tc_parent_monitor(uuid) to authenticated;

notify pgrst, 'reload schema';

select 'V53 credential truth + backup stamp + tutor isolation + staff monitor installed ✅' as status;
