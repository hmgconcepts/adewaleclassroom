-- =====================================================================
-- V11.0.2 ENTERPRISE PACK — Fleet Console integration, log retention,
-- CBT scheduling + question bank, login-audit IP.
-- Idempotent: safe to run any number of times.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HMG FLEET CONSOLE COMPATIBILITY LAYER
--    The Fleet Console (hmgfleetconsole.vercel.app) keeps every client
--    project alive and monitored. It speaks three endpoints:
--      POST /rest/v1/rpc/sc_keep_alive         (one-click anti-pause)
--      GET  /rest/v1/sc_keepalive?select=pinged_at  (heartbeat age)
--      POST /rest/v1/rpc/sc_license_status     (subscription verdict)
--    This pack provides all three, writing through to OUR tc_heartbeat
--    so Platform Health and the Fleet Console agree on one truth.
-- ---------------------------------------------------------------------
create table if not exists public.sc_keepalive (
  id        int primary key,
  pinged_at timestamptz,
  src       text
);
alter table public.sc_keepalive enable row level security;

drop policy if exists sc_keepalive_read on public.sc_keepalive;
create policy sc_keepalive_read on public.sc_keepalive
  for select using (true);   -- heartbeat age only; contains no business data

insert into public.sc_keepalive (id, pinged_at, src)
values (1, now(), 'install')
on conflict (id) do nothing;

-- v11.0.2 HOTFIX (42702): the parameter is named src because the Fleet
-- Console and the GitHub workflow POST {"src": ...} and PostgREST matches
-- JSON keys to argument names. But public.sc_keepalive also has a COLUMN
-- named src, and PL/pgSQL's default variable_conflict=error made every
-- call fail with:
--   42702: column reference "src" ... could refer to either a PL/pgSQL
--   variable or a table column
-- Fix: copy the parameter into a non-colliding local (v_src) once, use
-- only v_src inside the queries, and keep #variable_conflict use_variable
-- as a guard so a future edit can never reintroduce the ambiguity.
create or replace function public.sc_keep_alive(src text default 'fleet')
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_src text := left(coalesce(src, 'fleet'), 40);
  v_t   timestamptz;
begin
  -- One write, two ledgers: the fleet-visible row AND our richer heartbeat.
  update public.sc_keepalive
     set pinged_at = now(), src = v_src
   where id = 1
  returning pinged_at into v_t;
  if v_t is null then
    insert into public.sc_keepalive (id, pinged_at, src)
    values (1, now(), v_src)
    on conflict (id) do update set pinged_at = now(), src = excluded.src
    returning pinged_at into v_t;
  end if;
  begin
    update public.tc_heartbeat
       set last_ping = now(), last_source = v_src, ping_count = ping_count + 1
     where id = 1;
  exception when others then null;
  end;
  return v_t;
end $$;

grant execute on function public.sc_keep_alive(text) to anon, authenticated;

-- Subscription verdict in the shape the Fleet Console reads ({state:…}).
-- v11.0.2: tc_license_status() speaks ok/remind/grace/suspended/expired,
-- but the Fleet Console reads active/lifetime/grace/expired/suspended/
-- warning — so the state is translated and the raw details are preserved
-- alongside. (Note the || order: the translated state must come LAST so
-- it wins the duplicate jsonb key.)
create or replace function public.sc_license_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw   jsonb;
  v_state text;
  v_fleet text;
begin
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid
              where n.nspname = 'public' and p.proname = 'tc_license_status') then
    v_raw   := public.tc_license_status();
    v_state := lower(coalesce(v_raw ->> 'state', 'ok'));
    v_fleet := case
      when v_state = 'suspended' then 'suspended'
      when v_state = 'expired'   then 'expired'
      when v_state = 'grace'     then 'grace'
      when v_state = 'remind'    then 'warning'
      when coalesce(v_raw ->> 'model', 'lifetime') in ('lifetime','one_time','perpetual')
                                then 'lifetime'
      else 'active'
    end;
    return v_raw || jsonb_build_object('state', v_fleet, 'fleet_compatible', true);
  end if;
  return jsonb_build_object('state', 'lifetime', 'locked', false, 'fleet_compatible', true);
end $$;

grant execute on function public.sc_license_status() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. LOG RETENTION — purge_old (owner-gated) + login_audit.ip
-- ---------------------------------------------------------------------
alter table if exists public.login_audit add column if not exists ip text;
alter table if exists public.login_audit alter column event set default 'login';

-- v11.0.1 HOTFIX: this block originally read
--   "exception when duplicate_object or null_value_equality"
-- but null_value_equality is NOT a real PostgreSQL condition name, so
-- Postgres refused to compile the DO block and aborted the whole
-- complete-schema.sql run. Replaced with an existence check that cannot
-- raise in the first place, plus a self-explaining safety net.
do $fk$
begin
  if to_regclass('public.login_audit') is not null
     and not exists (
       select 1 from pg_constraint c
        where c.conrelid = to_regclass('public.login_audit')
          and c.conname  = 'login_audit_user_fkey')
  then
    alter table public.login_audit
      add constraint login_audit_user_fkey
      foreign key (user_id) references public.profiles(id) on delete set null;
  end if;
exception when others then
  raise notice 'login_audit foreign key not added: % (not fatal — the audit trail works without it).', sqlerrm;
end $fk$;

create or replace function public.purge_old(p_table text, p_days integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_allowed text[] := array['activity_log','login_audit','notifications','cbt_results',
                            'attendance_checkins','session_notes'];
begin
  if not public.tc_is_manager() then
    raise exception 'Owner role required to purge logs.';
  end if;
  if not exists (select 1 from unnest(v_allowed) a where a = p_table) then
    raise exception 'This table cannot be purged from the console. Allowed: %', array_to_string(v_allowed, ', ');
  end if;
  execute format('delete from public.%I where created_at < now() - (%s || '' days'')::interval',
                 p_table, least(greatest(p_days, 1), 3650));
  get diagnostics v_count = row_count;
  insert into public.activity_log (actor, action, table_name, row_id)
  values (auth.uid(), 'purge', p_table, v_count || ' rows older than ' || p_days || 'd');
  return v_count;
end $$;

revoke all on function public.purge_old(text, integer) from public, anon;
grant execute on function public.purge_old(text, integer) to authenticated;

-- Retention policy store (Storage Manager Efficiency Centre).
create table if not exists public.data_retention_settings (
  id                 integer primary key default 1,
  quota_mb           integer default 500,
  warning_percent    integer default 75,
  critical_percent   integer default 90,
  activity_log_days  integer default 365,
  notification_days  integer default 180,
  checkin_days       integer default 365,
  cbt_result_days    integer default 730,
  updated_at         timestamptz default now()
);
alter table public.data_retention_settings enable row level security;
drop policy if exists retention_admin on public.data_retention_settings;
create policy retention_admin on public.data_retention_settings
  for all to authenticated
  using (public.tc_is_manager()) with check (public.tc_is_manager());
insert into public.data_retention_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 3. CBT SCHEDULING — exam windows (start_at wait-room, close_at auto-close)
-- ---------------------------------------------------------------------
alter table if exists public.cbt_exams add column if not exists start_at timestamptz;
alter table if exists public.cbt_exams add column if not exists close_at timestamptz;

-- ---------------------------------------------------------------------
-- 4. QUESTION BANK — reusable cross-exam question store
-- ---------------------------------------------------------------------
create table if not exists public.tc_question_bank (
  id          uuid primary key default gen_random_uuid(),
  subject     text,
  topic       text,
  kind        text default 'objective',
  question    jsonb not null,
  tags        text[] default '{}',
  used_count  integer default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now()
);
alter table public.tc_question_bank enable row level security;
drop policy if exists qbank_staff on public.tc_question_bank;
create policy qbank_staff on public.tc_question_bank
  for all to authenticated
  using (public.tc_is_manager() or public.is_tutor())
  with check (public.tc_is_manager() or public.is_tutor());

create index if not exists tc_qbank_subject_idx on public.tc_question_bank (subject);
create index if not exists tc_qbank_topic_idx on public.tc_question_bank (topic);

-- ---------------------------------------------------------------------
-- 5. FLEET REPORTING MARKER — Platform Health shows fleet linkage state.
-- ---------------------------------------------------------------------
create table if not exists public.tc_fleet_state (
  id            integer primary key default 1,
  console_url   text default 'https://hmgfleetconsole.vercel.app/',
  registered    boolean default false,
  last_probe    timestamptz,
  updated_at    timestamptz default now()
);
alter table public.tc_fleet_state enable row level security;
drop policy if exists fleet_admin on public.tc_fleet_state;
create policy fleet_admin on public.tc_fleet_state
  for all to authenticated
  using (public.tc_is_manager()) with check (public.tc_is_manager());
insert into public.tc_fleet_state (id) values (1) on conflict (id) do nothing;

select 'V11 enterprise pack installed (fleet-compat, purge_old, retention, CBT schedule, question bank)' as status;

-- ---------------------------------------------------------------------
-- 6. Learner demographics for analytics (gender split chart).
-- ---------------------------------------------------------------------
alter table if exists public.learners add column if not exists gender text;

-- ---------------------------------------------------------------------
-- 7. Settings columns — language, accessibility, signature/stamp, AI key.
-- ---------------------------------------------------------------------
alter table if exists public.practice_settings add column if not exists ui_language text default 'en';
alter table if exists public.practice_settings add column if not exists font_scale integer default 100;
alter table if exists public.practice_settings add column if not exists high_contrast boolean default false;
alter table if exists public.practice_settings add column if not exists principal_name text;
alter table if exists public.practice_settings add column if not exists signature_url text;
alter table if exists public.practice_settings add column if not exists stamp_text text;
alter table if exists public.practice_settings add column if not exists stamp_color text default '#1e3a8a';
alter table if exists public.practice_settings add column if not exists stamp_enabled boolean default true;
alter table if exists public.practice_settings add column if not exists ai_enabled boolean default false;
alter table if exists public.practice_settings add column if not exists ai_model text;
alter table if exists public.practice_settings add column if not exists ai_base_url text;
alter table if exists public.practice_settings add column if not exists ai_api_key text;

-- ---------------------------------------------------------------------
-- 8. tc_installed_packs — Schema Doctor truth source. Inspects the live
--    database (pg_proc / pg_class / columns / privileges / buckets) and
--    reports EVERY pack in database/ as installed or missing. One RPC =
--    exact truth, no client-side guessing. Probe objects verified against
--    each pack file in this repo.
-- ---------------------------------------------------------------------
create or replace function public.tc_installed_packs()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with f(fn) as (select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
       t(tn) as (select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p')),
       packs(name, file, kind, obj, col) as (values
         ('Core platform',          'complete-schema.sql',                     'table',  'profiles',              null),
         ('Tutoring operations',    'v2-tutoring-ops.sql',                     'table',  'engagements',           null),
         ('Classroom & exams',      'v3-classroom-exams.sql',                  'table',  'cbt_exams',             null),
         ('Enterprise parity',      'v4-enterprise-parity.sql',                'table',  'practice_settings',     null),
         ('Ops parity',             'v5-ops-parity.sql',                       'table',  'inquiries',             null),
         ('CBT modes',              'v6-cbt-modes.sql',                        'func',   'tc_cbt_get_exam',       null),
         ('Family access',          'v7-family-access-fix.sql',                'func',   'is_family_of_learner',  null),
         ('Keep-alive & Drive',     'v9-keepalive-and-drive.sql',              'func',   'tc_keep_alive_status',  null),
         ('Quota guard',            'v12-quota-guard.sql',                     'func',   'tc_db_report',          null),
         ('Family polls & billing', 'v15-family-polls-billing.sql',            'func',   'tc_family_statement',   null),
         ('Exam registration',      'v16-exam-registration.sql',               'func',   'tc_candidate_lookup',   null),
         ('Licensing',              'v17-licensing-and-family-billing.sql',    'func',   'tc_license_guard',      null),
         ('Security hardening',     'v18-security-hardening.sql',              'func',   'tc_security_report',    null),
         ('Revenue & security',     'v19-revenue-and-security.sql',            'table',  'payment_plans',         null),
         ('CBT 2FA & polls',        'v20-cbt-2fa-polls.sql',                   'table',  'user_mfa',              null),
         ('CBT results audit',      'v22-cbt-results-audit.sql',               'func',   'tc_cbt_result_audit',   null),
         ('Tutor scoping',          'v24-tutor-scoping.sql',                   'func',   'tc_is_manager',         null),
         ('Desks & group insights', 'v25-desks-lifecycle-free-classes.sql',    'table',  'tc_group_insights',     null),
         ('Tutor marking & selftest','v26-tutor-marking-and-selftest.sql',     'func',   'tc_cbt_marking_queue',  null),
         ('RLS recursion & blog',   'v27-rls-recursion-blog-documents.sql',    'table',  'tc_blog_posts',         null),
         ('Admin & ops enrichment', 'v28-admin-and-ops-enrichment.sql',        'func',   'tc_admin_list_profiles',null),
         ('Social registration',    'v29-social-registration-links.sql',       'table',  'tc_class_links',        null),
         ('Group insights hotfix',  'v30-group-insights-rls-hotfix.sql',       'func',   'tc_family_can_see_learner', null),
         ('CBT review lookup',      'v35-cbt-review-lookup.sql',               'func',   'tc_cbt_recent_result',  null),
         ('Anon RLS execute grants','v36-anon-rls-predicate-grants.sql',       'grant',  'is_family_of_learner',  null),
         ('Schema version truth',   'v37-schema-version-truth.sql',            'func',   'tc_schema_info',        null),
         ('CBT delivery & read-aloud','v38-cbt-delivery-and-readaloud.sql',    'column', 'cbt_exams',             'read_aloud'),
         ('CBT game',               'v41-cbt-game.sql',                        'table',  'tc_game_profiles',      null),
         ('Enterprise hardening',   'v42-enterprise-hardening.sql',            'func',   'tc_anon_executable',    null),
         ('V11 enterprise pack',    'v11-enterprise-pack.sql',                 'func',   'purge_old',             null),
         ('Fleet Console compatibility','v11-enterprise-pack.sql',             'func',   'sc_keep_alive',         null),
         ('Pack registry',          'v11-enterprise-pack.sql',                 'func',   'tc_installed_packs',    null),
         ('Storage offload vault',  'storage-offload.sql',                     'bucket', 'archives',              null),
         ('Drive sync',             'drive-sync.sql',                          'column', 'practice_settings',     'drive_client_id'),
         ('My work board',          'my-work-board.sql',                       'func',   'tc_my_work',            null),
         ('Operations tables',      'operations-tables.sql',                   'table',  'inventory',             null),
         ('Keep-alive standalone',  'keep-alive.sql',                          'func',   'tc_keep_alive',         null)
       )
  select jsonb_agg(jsonb_build_object(
    'pack',  packs.name,
    'file',  packs.file,
    'installed', case packs.kind
      when 'func'   then exists (select 1 from f where f.fn = packs.obj)
      when 'table'  then exists (select 1 from t where t.tn = packs.obj)
      when 'column' then exists (select 1 from information_schema.columns
                                   where table_schema='public' and table_name=packs.obj and column_name=packs.col)
      when 'grant'  then exists (select 1 from information_schema.routine_privileges
                                   where routine_schema='public' and routine_name=packs.obj and grantee='anon')
      when 'bucket' then to_regclass('storage.buckets') is not null
                      and exists (select 1 from storage.buckets where id = packs.obj)
    end
  ) order by packs.name)
  from packs;
$$;

grant execute on function public.tc_installed_packs() to authenticated;
revoke execute on function public.tc_installed_packs() from anon;

-- ---------------------------------------------------------------------
-- 9. Idle sign-out control column (Platform Health security card).
-- ---------------------------------------------------------------------
alter table if exists public.practice_settings add column if not exists idle_timeout_minutes integer default 30;

-- ---------------------------------------------------------------------
-- 10. CBT SCHEDULING GATE — tc_cbt_get_exam now enforces start_at
--     (wait-room until the tutor opens it) and close_at (auto-close).
--     Same verified body as complete-schema + the window guard inserted
--     right after the paper is found, so no client can bypass it.
-- ---------------------------------------------------------------------
create or replace function public.tc_cbt_get_exam(p_code text, p_student_no text default '')
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  exam public.cbt_exams%rowtype;
  learner public.learners%rowtype;
  wanted text := regexp_replace(upper(coalesce(p_student_no,'')), '[^A-Z0-9]', '', 'g');
  roster_count int := 0;
  candidate jsonb := 'null'::jsonb;
  mode text;
begin
  select * into exam from public.cbt_exams
   where regexp_replace(upper(coalesce(code,'')), '[^A-Z0-9]', '', 'g')
       = regexp_replace(upper(coalesce(p_code,'')), '[^A-Z0-9]', '', 'g')
   limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown_code',
      'message', 'Unknown quiz code. Check the code your tutor shared.');
  end if;

  -- V11 scheduling windows (server-side; cannot be bypassed by the client)
  if exam.is_open = false then
    return jsonb_build_object('ok', false, 'error', 'closed', 'title', exam.title,
      'message', 'This paper is currently closed and is not accepting sittings. Your tutor can re-open it.');
  end if;
  if exam.start_at is not null and exam.start_at > now() then
    return jsonb_build_object('ok', false, 'error', 'not_started', 'title', exam.title, 'opens_at', exam.start_at,
      'message', 'This paper has not opened yet. It opens on '
        || to_char(exam.start_at, 'Dy DD Mon YYYY "at" HH24:MI')
        || '. This page is the waiting room — come back then, or ask your tutor for the paper code later.');
  end if;
  if exam.close_at is not null and exam.close_at < now() then
    return jsonb_build_object('ok', false, 'error', 'ended', 'title', exam.title,
      'message', 'This paper closed automatically on '
        || to_char(exam.close_at, 'Dy DD Mon YYYY "at" HH24:MI')
        || ' and no longer accepts sittings.');
  end if;

  mode := lower(coalesce(exam.exam_mode, 'open'));
  if mode = 'registered' then
    if wanted = '' then
      return jsonb_build_object('ok', false, 'error', 'student_id_required',
        'identity_mode', 'registered',
        'title', exam.title, 'quiz_kind', exam.quiz_kind, 'exam_mode', 'registered',
        'message', 'This examination is restricted to registered learners. Enter your student ID (for example TC-0001). Your official name will be loaded automatically — do not type a name to identify yourself.');
    end if;
    select * into learner from public.learners
     where regexp_replace(upper(coalesce(student_no,'')), '[^A-Z0-9]', '', 'g') = wanted
        or lower(email) = lower(trim(p_student_no))
     limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid_student_id',
        'identity_mode', 'registered',
        'message', 'No registered learner matches that student ID. Contact the studio — do not invent a name.');
    end if;
    select count(*) into roster_count from public.cbt_roster where exam_id = exam.id;
    if roster_count > 0 and not exists (
      select 1 from public.cbt_roster r
       where r.exam_id = exam.id
         and (r.learner_id = learner.id
           or regexp_replace(upper(coalesce(r.student_no,'')), '[^A-Z0-9]', '', 'g') = wanted)
    ) then
      return jsonb_build_object('ok', false, 'error', 'not_on_roster',
        'identity_mode', 'registered',
        'message', 'You are registered in the studio but not on the roster for this paper.');
    end if;
    candidate := jsonb_build_object(
      'id', learner.id, 'student_no', learner.student_no,
      'full_name', learner.full_name, 'year_group', learner.year_group, 'email', learner.email);
    return jsonb_build_object('ok', true, 'identity_mode', 'registered', 'candidate', candidate)
      || to_jsonb(exam);
  end if;

  if wanted <> '' then
    select * into learner from public.learners
     where regexp_replace(upper(coalesce(student_no,'')), '[^A-Z0-9]', '', 'g') = wanted
     limit 1;
    if found then
      candidate := jsonb_build_object(
        'id', learner.id, 'student_no', learner.student_no,
        'full_name', learner.full_name, 'year_group', learner.year_group, 'email', learner.email);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'identity_mode', 'open', 'candidate', candidate)
    || to_jsonb(exam);
end $$;

grant execute on function public.tc_cbt_get_exam(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 11. Question-bank usage counter (called when a bank question is added
--     to a paper, so tutors can see which questions are battle-tested).
-- ---------------------------------------------------------------------
create or replace function public.tc_qbank_used(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tc_question_bank set used_count = used_count + 1 where id = p_id;
$$;

grant execute on function public.tc_qbank_used(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 12. Timestamp columns the analytics/retention engines rely on.
--     finance_entries had only entry_on (no created_at) and
--     reading_progress only done_at (no created_at) — the analytics
--     income/expense trend and the retention candidate counters select
--     created_at on both, which would have returned an empty dataset.
-- ---------------------------------------------------------------------
alter table if exists public.finance_entries add column if not exists created_at timestamptz default now();
alter table if exists public.reading_progress add column if not exists created_at timestamptz default now();

-- ---------------------------------------------------------------------
-- Finally: make PostgREST see every object created above. Without this,
-- a function created seconds ago can be present in the database and
-- still invisible to the API (identical error to "function missing").
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';
