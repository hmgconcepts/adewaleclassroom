-- ===========================================================================
-- TUTORING CONNECT — V28
-- ---------------------------------------------------------------------------
-- 1.  Roles & Status Manager RPCs (admin changes a person's role/status with
--     an audit trail) — matches School Connect / GOSA "Role & Status Manager".
-- 2.  Settings additions: learner-ID numbering, enforced 2FA, geofence.
-- 3.  Column enrichment for the ops registers (substitutions, rooms, badges,
--     rubrics, subjects, products, scholarships, compliance, gallery,
--     messages, complaints, sessions, attendance, assignments, reviews,
--     events, payments, announcements, parent meetings, trials, waitlist,
--     inquiries, helpdesk, library, LMS, e-resources, resources, stream,
--     classwork, exam links + registrations).
-- 4.  RLS for pages that had NONE (products, scholarships, gallery, events,
--     reviews) — family-read / staff-write / public-published.
-- 5.  V28 self-test (tc_v28_check) folded into tc_schema_ok().
-- ---------------------------------------------------------------------------
-- Idempotent: every statement is guarded (create or replace, add column if
-- not exists, drop policy if exists).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. ROLES & STATUS MANAGER
-- ---------------------------------------------------------------------------
-- The manager lists everyone who has an account, with their role and status,
-- and changes either with a confirm + audit row. Only a manager may call it;
-- the functions are SECURITY DEFINER so they can write profiles, and they
-- check tc_is_manager() themselves before touching anything.
-- ---------------------------------------------------------------------------
create or replace function public.tc_admin_list_profiles()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.tc_is_manager() then
    return jsonb_build_object('ok', false, 'reason', 'not_manager');
  end if;
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) into v
    from (
      select jsonb_build_object(
               'id', p.id, 'email', p.email, 'full_name', p.full_name,
               'role', p.role, 'status', p.status, 'created_at', p.created_at,
               'linked_learner', (select count(*) from public.learners l where l.user_id = p.id),
               'linked_parent',  (select count(*) from public.parents  pa where pa.user_id = p.id),
               'linked_tutor',   (select count(*) from public.tutors   t where t.user_id = p.id)
             ) as x
        from public.profiles p
    ) s;
  return jsonb_build_object('ok', true, 'users', v);
end $$;

revoke all on function public.tc_admin_list_profiles() from public, anon;
grant execute on function public.tc_admin_list_profiles() to authenticated;

-- Change a person's role and/or status, with an audit row. The actor is
-- recorded; nobody may change their own role (a manager demoting themselves
-- would orphan the studio — do it in SQL deliberately if ever needed).
create or replace function public.tc_admin_set_role_status(
  p_user_id uuid, p_role text default null, p_status text default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles%rowtype;
  v_old_role text; v_old_status text;
begin
  if not public.tc_is_manager() then
    return jsonb_build_object('ok', false, 'reason', 'not_manager');
  end if;
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;
  if p_user_id = auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'cannot_change_self');
  end if;
  if p_role is not null and p_role not in
     ('admin','owner','director','lead_tutor','tutor','staff','parent','student','learner') then
    return jsonb_build_object('ok', false, 'reason', 'bad_role');
  end if;
  if p_status is not null and p_status not in
     ('pending','approved','active','suspended','disabled','archived') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;

  select * into v_row from public.profiles where id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  v_old_role := v_row.role; v_old_status := v_row.status;

  update public.profiles
     set role = coalesce(p_role, role),
         status = coalesce(p_status, status)
   where id = p_user_id;

  insert into public.activity_log (actor, action, table_name, row_id)
  values (auth.uid(),
          'role_status_change',
          'profiles',
          p_user_id::text || '|' || v_old_role || '->' || coalesce(p_role, v_old_role)
            || '|' || v_old_status || '->' || coalesce(p_status, v_old_status)
            || coalesce('|' || p_note, ''));

  return jsonb_build_object('ok', true, 'user', p_user_id,
                            'role', coalesce(p_role, v_old_role),
                            'status', coalesce(p_status, v_old_status));
end $$;

revoke all on function public.tc_admin_set_role_status(uuid, text, text, text) from public, anon;
grant execute on function public.tc_admin_set_role_status(uuid, text, text, text) to authenticated;

select 'V28 roles & status manager installed' as status;

-- ---------------------------------------------------------------------------
-- 2. SETTINGS ADDITIONS  (report item 1 — Settings parity with School Connect)
-- ---------------------------------------------------------------------------
do $$
declare c text;
begin
  foreach c in array array[
    'learner_id_prefix text',
    'learner_id_format text',
    'enforce_2fa boolean',
    'enforce_geo boolean',
    'geo_label text'
  ] loop
    execute format('alter table if exists public.practice_settings add column if not exists %s', c);
  end loop;
end $$;

-- Student numbers now read the studio prefix from settings (fallback 'TC').
create or replace function public.tc_generate_student_no()
returns trigger language plpgsql as $$
declare n int; prefix text;
begin
  if new.student_no is null or new.student_no = '' then
    select coalesce(max(nullif(regexp_replace(student_no, '\D', '', 'g'), '')::int), 0) + 1
      into n from public.learners;
    select coalesce(learner_id_prefix, 'TC') into prefix
      from public.practice_settings where id = 1;
    if prefix = '' then prefix := 'TC'; end if;
    new.student_no := prefix || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_student_no on public.learners;
create trigger trg_student_no before insert on public.learners
for each row execute function public.tc_generate_student_no();

select 'V28 settings additions installed' as status;

-- ---------------------------------------------------------------------------
-- 3. COLUMN ENRICHMENT — ops registers (report items 2–20)
-- ---------------------------------------------------------------------------
do $$
declare
  t text; c text;
begin
  -- table -> column list. Every column is added with IF NOT EXISTS.
  foreach t, c in array[
    ('substitutions','cover_tutor_name text'),
    ('substitutions','from_session_id uuid'),
    ('substitutions','status text'),
    ('substitutions','note text'),
    ('substitutions','created_by uuid'),
    ('rooms','kind text'),
    ('rooms','url text'),
    ('rooms','capacity int'),
    ('rooms','notes text'),
    ('rooms','available boolean'),
    ('badges','icon text'),
    ('badges','description text'),
    ('badges','kind text'),
    ('badges','awarded_on date'),
    ('rubrics','criteria text'),
    ('rubrics','scale text'),
    ('rubrics','owner text'),
    ('rubrics','status text'),
    ('subjects','exam_board text'),
    ('subjects','level text'),
    ('subjects','icon text'),
    ('subjects','colour text'),
    ('products','author text'),
    ('products','subject text'),
    ('products','price numeric'),
    ('products','currency text'),
    ('products','url text'),
    ('products','kind text'),
    ('products','available boolean'),
    ('scholarships','percent numeric'),
    ('scholarships','applies_to text'),
    ('scholarships','active boolean'),
    ('scholarships','notes text'),
    ('compliance_tasks','owner text'),
    ('compliance_tasks','notes text'),
    ('compliance_tasks','remind_on date'),
    ('gallery','url text'),
    ('gallery','kind text'),
    ('gallery','caption text'),
    ('gallery','featured boolean'),
    ('gallery','taken_on date'),
    ('messages','subject text'),
    ('messages','body text'),
    ('messages','to_role text'),
    ('messages','read boolean'),
    ('messages','thread_id uuid'),
    ('complaints','body text'),
    ('complaints','priority text'),
    ('complaints','assignee text'),
    ('complaints','status text'),
    ('complaints','resolution text'),
    ('sessions','ends_at timestamptz'),
    ('sessions','tutor_id uuid'),
    ('sessions','meeting_url text'),
    ('sessions','whiteboard_url text'),
    ('sessions','status text'),
    ('sessions','outcome text'),
    ('sessions','hours numeric'),
    ('sessions','notes text'),
    ('session_attendance','note text'),
    ('session_attendance','marked_by uuid'),
    ('session_attendance','marked_at timestamptz'),
    ('assignments','subject text'),
    ('assignments','due_on date'),
    ('assignments','instructions text'),
    ('assignments','status text'),
    ('reviews','body text'),
    ('reviews','rating int'),
    ('reviews','published boolean'),
    ('reviews','reviewer_role text'),
    ('events','starts_at timestamptz'),
    ('events','venue text'),
    ('events','notes text'),
    ('events','kind text'),
    ('events','audience text'),
    ('events','link text'),
    ('payments','learner_id uuid'),
    ('payments','engagement_id uuid'),
    ('payments','method text'),
    ('payments','reference text'),
    ('payments','paid_on date'),
    ('payments','status text'),
    ('payments','note text'),
    ('payments','currency text'),
    ('announcements','audience text'),
    ('announcements','pinned boolean'),
    ('announcements','link text'),
    ('parent_meetings','learner_id uuid'),
    ('parent_meetings','scheduled_at timestamptz'),
    ('parent_meetings','notes text'),
    ('parent_meetings','status text'),
    ('parent_meetings','meeting_url text'),
    ('trials','subject text'),
    ('trials','scheduled_at timestamptz'),
    ('trials','notes text'),
    ('trials','status text'),
    ('trials','converted boolean'),
    ('waitlist','subject text'),
    ('waitlist','notes text'),
    ('waitlist','offered_on date'),
    ('waitlist','converted boolean'),
    ('inquiries','email text'),
    ('inquiries','phone text'),
    ('inquiries','learner_name text'),
    ('inquiries','kind text'),
    ('inquiries','source text'),
    ('inquiries','notes text'),
    ('inquiries','owner text'),
    ('inquiries','contacted_on date'),
    ('helpdesk_tickets','priority text'),
    ('helpdesk_tickets','assignee text'),
    ('helpdesk_tickets','resolved_on date'),
    ('helpdesk_tickets','resolution text'),
    ('library_items','url text'),
    ('library_items','author text'),
    ('library_items','kind text'),
    ('library_items','subject text'),
    ('lms_lessons','url text'),
    ('lms_lessons','order_no int'),
    ('lms_lessons','status text'),
    ('lms_lessons','duration_min int'),
    ('eresources','url text'),
    ('eresources','notes text'),
    ('eresources','kind text'),
    ('resources','url text'),
    ('resources','kind text'),
    ('stream_posts','body text'),
    ('stream_posts','kind text'),
    ('stream_posts','author_id uuid'),
    ('stream_posts','link text'),
    ('stream_posts','status text'),
    ('classwork_items','title text'),
    ('classwork_items','kind text'),
    ('classwork_items','body text'),
    ('classwork_items','due_on date'),
    ('classwork_items','status text'),
    ('exam_reg_links','board text'),
    ('exam_reg_links','series text'),
    ('exam_reg_links','intro text'),
    ('exam_reg_links','max_uses int'),
    ('exam_reg_links','uses int'),
    ('exam_registrations','full_name text'),
    ('exam_registrations','email text'),
    ('exam_registrations','phone text'),
    ('exam_registrations','board text'),
    ('exam_registrations','series text'),
    ('exam_registrations','photo_url text')
  ] loop
    execute format('alter table if exists public.%I add column if not exists %s', t, c);
  end loop;
end $$;

select 'V28 ops-register columns installed' as status;

-- ---------------------------------------------------------------------------
-- 4. RLS FOR PAGES THAT HAD NONE
-- ---------------------------------------------------------------------------
-- products (Books & Materials), scholarships, gallery, events and reviews
-- previously had NO row-level security at all — any anon visitor with the URL
-- could read the whole table, and any signed-in person could write it. Now:
--   staff write, families + the public read (published content only for
--   reviews), everyone else denied.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['products','scholarships','gallery','events'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_staff', t);
      execute format('create policy %I on public.%I for all to authenticated ' ||
        'using (public.tc_is_manager() or public.tc_my_tutor_id() is not null) ' ||
        'with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null)',
        t || '_staff', t);
      execute format('drop policy if exists %I on public.%I', t || '_read', t);
      execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
        t || '_read', t);
    end if;
  end loop;

  -- Reviews: the public sees only published ones; staff manage all.
  if to_regclass('public.reviews') is not null then
    alter table public.reviews enable row level security;
    drop policy if exists reviews_staff on public.reviews;
    create policy reviews_staff on public.reviews
      for all to authenticated
      using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
      with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
    drop policy if exists reviews_public on public.reviews;
    create policy reviews_public on public.reviews
      for select to anon, authenticated using (published = true);
  end if;
end $$;

select 'V28 RLS on public registers installed' as status;

-- ---------------------------------------------------------------------------
-- 5. V28 SELF-TEST
-- ---------------------------------------------------------------------------
create or replace function public.tc_v28_check()
returns table (kind text, name text, present boolean, needed_for text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare t record;
begin
  for t in
    select * from (values
      ('tc_admin_list_profiles','roles & status — list users'),
      ('tc_admin_set_role_status','roles & status — change role/status'),
      ('tc_generate_student_no','learner-ID numbering trigger')
    ) as v(n, why)
  loop
    kind := 'function'; name := t.n; needed_for := t.why;
    present := exists (select 1 from pg_proc p
                        join pg_namespace ns on ns.oid = p.pronamespace
                       where ns.nspname = 'public' and p.proname = t.n);
    return next;
  end loop;

  for t in
    select * from (values
      ('practice_settings','learner_id_prefix','settings — learner-ID numbering'),
      ('practice_settings','enforce_2fa','settings — 2FA enforcement'),
      ('practice_settings','enforce_geo','settings — geofence'),
      ('rooms','capacity','rooms & locations'),
      ('substitutions','cover_tutor_name','cover tutors'),
      ('sessions','meeting_url','meeting links'),
      ('sessions','outcome','complete a class'),
      ('session_attendance','note','attendance register'),
      ('assignments','due_on','homework'),
      ('products','price','books & materials'),
      ('scholarships','active','scholarships & discounts'),
      ('payments','method','payments'),
      ('exam_reg_links','max_uses','exam registration links'),
      ('exam_registrations','full_name','exam registration')
    ) as v(tbl, col, why)
  loop
    kind := 'column'; name := t.tbl || '.' || t.col; needed_for := t.why;
    present := exists (select 1 from information_schema.columns c
                        where c.table_schema = 'public' and c.table_name = t.tbl
                          and c.column_name = t.col);
    return next;
  end loop;

  for t in
    select * from (values
      ('products','RLS enabled'),
      ('scholarships','RLS enabled'),
      ('gallery','RLS enabled'),
      ('events','RLS enabled'),
      ('reviews','RLS enabled')
    ) as v(n, why)
  loop
    kind := 'rls'; name := t.n; needed_for := t.why;
    present := exists (select 1 from pg_tables
                        where schemaname = 'public' and tablename = t.n
                          and rowsecurity = true);
    return next;
  end loop;
end $$;

revoke all on function public.tc_v28_check() from public;
grant execute on function public.tc_v28_check() to authenticated;

-- tc_schema_ok() now checks V26 + V27 + V28 together.
create or replace function public.tc_schema_ok()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when count(*) filter (where not present) = 0
      then 'Schema complete \u2705 — ' || count(*)::text || ' objects checked, none missing.'
    else 'Schema INCOMPLETE \u274c — missing: ' ||
         string_agg(kind || ' ' || name, ', ') filter (where not present)
  end
  from (
    select * from public.tc_schema_selftest()
    union all
    select * from public.tc_v27_check()
    union all
    select * from public.tc_v28_check()
  ) t;
$$;

revoke all on function public.tc_schema_ok() from public;
grant execute on function public.tc_schema_ok() to authenticated;

select 'V28 installed and self-test extended' as status;
