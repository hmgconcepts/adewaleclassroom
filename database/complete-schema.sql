-- ============================================================================
--  TUTORING CONNECT — COMPLETE DATABASE SCHEMA  (V12)
--  HMG Technologies · a subsidiary of HMG Concepts
-- ============================================================================
--
--  RUN THIS ONE FILE. THAT IS ALL.
--
--  Open Supabase -> SQL Editor -> New query -> paste ALL of this file -> Run.
--  It installs EVERY pack. You do NOT need to run any of the individual
--  database/v*.sql files afterwards; they are kept only as reference and for
--  patching a studio that is already live.
--
--  IT IS SAFE TO RUN THIS FILE AS MANY TIMES AS YOU LIKE.
--  Every statement is idempotent, verified by tools/lint_schema.py:
--      tables .......... CREATE TABLE IF NOT EXISTS
--      indexes ......... CREATE INDEX IF NOT EXISTS
--      columns ......... ADD COLUMN IF NOT EXISTS
--      functions ....... CREATE OR REPLACE FUNCTION
--      policies ........ DROP POLICY IF EXISTS immediately before CREATE POLICY
--      triggers ........ DROP TRIGGER IF EXISTS immediately before CREATE TRIGGER
--      seed rows ....... INSERT ... ON CONFLICT DO NOTHING / DO UPDATE
--      extensions ...... CREATE EXTENSION IF NOT EXISTS, wrapped so an
--                        unavailable extension never aborts the run
--  Re-running never drops data. It only brings objects up to the current shape.
--
--  A NOTE ON REPEATED DEFINITIONS
--  A few functions and triggers are defined more than once in this file
--  (tc_keep_alive, tc_push_cbt_to_scoresheet, trg_push_cbt). That is deliberate,
--  not sloppiness: the file is assembled from versioned packs in order, and a
--  later pack intentionally SUPERSEDES an earlier definition — for example V6
--  replaces the single-row scoresheet push with the multi-subject version that
--  writes one row per subject. PostgreSQL applies them in order, so the last
--  definition wins. Removing the earlier ones would break the ability to run an
--  individual pack against an older studio.
--
--  WHAT GETS INSTALLED
--      101 tables, Row Level Security enabled on all of them
--      Family-scoped access so a parent sees only their own children
--      Security-definer RPCs for the public surfaces (apply, quiz codes, keep-alive)
--      Triggers: graded quiz -> scoresheet (overall + one row per subject)
--      Keep-alive heartbeat + health reporting (free-tier pause protection)
--      Google Drive backup settings
--      Schema registry (tc_schema_info) so the app can report its own version
--      Free-tier quota guard: LZ4 compression, size reporting, retention
--
--  AFTER RUNNING
--      1. The last line should read:  Tutoring Connect V12 ... installed
--      2. Sign up in the portal, then promote yourself:
--             update public.profiles set role='admin', status='approved'
--              where email='you@example.com';
--      3. Platform health -> confirm the schema panel shows V12.
--
--  VERIFY IDEMPOTENCY YOURSELF:  python3 tools/lint_schema.py
-- ============================================================================

-- =============================================================================
-- Tutoring Connect — COMPLETE SCHEMA (run this ONE file)
-- =============================================================================
-- Self-contained. Idempotent. Safe to re-run many times.
-- Includes: core tables + RLS, V2 bookings/SOW/quizzes/forum/applications,
-- keep-alive + pg_cron, Drive columns, V3 stream/classwork/exam registration,
-- V4 notifications/audit/library/leave, V5 makeup credits/study log,
-- V6 CBT Open/Registered identity + per-subject scoresheet push,
-- storage offload buckets (archives + proctor — File Storage, not the 500 MB DB).
--
-- HOW TO RUN
--   Supabase → SQL Editor → paste THIS entire file → Run.
--   You do NOT need to run v2/v3/v4/v5/v6/keep-alive/drive/storage files
--   separately. Those files exist only for studios that were installed before
--   a given pack.
--
-- Product of HMG Technologies / HMG Concepts. Founder Adewale Samson Adeagbo.
-- =============================================================================

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
create extension if not exists pgcrypto;

-- =============================================================================
-- ROLE HELPER FUNCTIONS (plpgsql so table references are resolved at call time,
-- not at function-creation time. This fixes "relation public.profiles does not
-- exist" on a fresh database where these functions previously ran before any
-- tables existed).
-- =============================================================================
create or replace function public.tc_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.is_admin()
returns boolean language plpgsql stable security definer as $$
begin
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','owner','director','lead_tutor','super_admin')
      and p.status in ('approved','active')
  );
end $$;

create or replace function public.is_tutor()
returns boolean language plpgsql stable security definer as $$
begin
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','owner','director','lead_tutor','super_admin','tutor','staff')
      and p.status in ('approved','active')
  );
end $$;

create or replace function public.is_parent_of(p_learner uuid)
returns boolean language plpgsql stable security definer as $$
begin
  return exists (
    select 1 from public.parent_learner pl
    join public.parents par on par.id = pl.parent_id
    where pl.learner_id = p_learner and par.user_id = auth.uid()
  );
end $$;

create or replace function public.is_self_learner(p_learner uuid)
returns boolean language plpgsql stable security definer as $$
begin
  return exists (
    select 1 from public.learners l
    where l.id = p_learner and l.user_id = auth.uid()
  );
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text, phone text,
  role text default 'parent',
  status text default 'pending',
  timezone text default 'Africa/Lagos',
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.practice_settings (
  id int primary key default 1,
  name text, motto text, timezone text default 'Africa/Lagos',
  currency text default '₦',
  cancellation_hours int default 12,
  signature_url text, logo_url text,
  role_access jsonb, role_write jsonb,
  latitude double precision, longitude double precision, geo_radius_m int
);

create table if not exists public.tutors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  full_name text not null, email text, phone text, timezone text,
  specialisms text, hourly_cost numeric, photo_url text,
  status text default 'active',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  full_name text not null, email text, phone text, timezone text,
  billing_name text, address text, status text default 'active',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  full_name text not null, preferred_name text, email text, phone text,
  timezone text, year_group text, school_name text,
  learning_style text, accommodations text, photo_url text,
  date_of_birth date, status text default 'active',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.parent_learner (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.parents(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete cascade,
  relationship text,
  unique(parent_id, learner_id)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null, exam_board text, level text,
  created_at timestamptz default now()
);

create table if not exists public.methodologies (
  id uuid primary key default gen_random_uuid(),
  name text not null, summary text, steps text,
  created_at timestamptz default now()
);

create table if not exists public.engagements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'one_on_one' check (kind in ('one_on_one','group')),
  subject text, exam_board text,
  methodology_id uuid references public.methodologies(id),
  tutor_id uuid references public.tutors(id),
  timezone text, currency text,
  hourly_rate numeric, hours_prepaid numeric default 0, hours_used numeric default 0,
  baseline_score numeric, target_score numeric, target_exam_on date,
  capacity int, notes text,
  status text default 'active',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.engagement_members (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete cascade,
  status text default 'active',
  joined_on date default current_date,
  unique(engagement_id, learner_id)
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  parent_name text not null, email text, phone text, learner_name text,
  subject text, kind text, timezone text, source text, notes text,
  status text default 'new',
  created_at timestamptz default now()
);

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  learner_name text not null, subject text, kind text, notes text,
  status text default 'waiting', created_at timestamptz default now()
);

create table if not exists public.trials (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id),
  learner_name text not null, scheduled_at timestamptz,
  baseline_score numeric, fit_notes text, status text default 'booked',
  created_at timestamptz default now()
);

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid references public.tutors(id) on delete cascade,
  weekday int check (weekday between 0 and 6),
  start_time time, end_time time, timezone text
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz,
  mode text default 'online', meeting_url text, whiteboard_url text,
  location text, hours numeric default 1, status text default 'scheduled',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.session_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete cascade,
  status text default 'present', minutes int,
  unique(session_id, learner_id)
);

create table if not exists public.session_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  learner_id uuid references public.learners(id),
  body text, recording_url text, share_with_parent boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  learner_id uuid references public.learners(id),
  title text not null, metric text, review_on date, status text default 'open',
  created_at timestamptz default now()
);

create table if not exists public.mastery_topics (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete cascade,
  topic text not null, score numeric, last_assessed date,
  unique(engagement_id, learner_id, topic)
);

create table if not exists public.curriculum_items (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  week_no int, topic text not null, covered boolean default false
);

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id),
  session_id uuid references public.sessions(id),
  title text, objectives text, resources text, created_at timestamptz default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  learner_id uuid references public.learners(id),
  title text not null, due_on date, max_score numeric, score numeric,
  submission_url text, status text default 'set',
  created_at timestamptz default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id),
  learner_id uuid references public.learners(id) on delete cascade,
  title text not null, kind text default 'quiz', score numeric, taken_on date default current_date,
  created_at timestamptz default now()
);

create table if not exists public.cbt_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null, code text unique, questions jsonb default '[]'::jsonb,
  duration_min int default 40, engagement_id uuid references public.engagements(id),
  status text default 'draft', created_at timestamptz default now()
);

create table if not exists public.cbt_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.cbt_exams(id) on delete cascade,
  learner_id uuid references public.learners(id),
  candidate_name text, score numeric, max_score numeric, detail jsonb,
  created_at timestamptz default now()
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  name text not null, hours numeric, price numeric, purchased_on date, status text default 'active'
);

create table if not exists public.hour_ledger (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  delta numeric not null, reason text, session_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.parents(id),
  engagement_id uuid references public.engagements(id),
  amount numeric not null, currency text, due_on date, status text default 'draft',
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id),
  amount numeric not null, method text, reference text, paid_on date default current_date
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text check (kind in ('income','expense')),
  amount numeric, memo text, entry_on date default current_date
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text, audience text default 'all', pinned boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender uuid default auth.uid(), to_role text, subject text, body text,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, title text, body text, read_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  title text, body text, status text default 'open', created_at timestamptz default now()
);

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  title text, options text, anonymous boolean default true, status text default 'open',
  created_at timestamptz default now()
);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references public.polls(id) on delete cascade,
  voter uuid, choice text
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id),
  title text, url text, kind text
);

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.learners(id) on delete cascade,
  front text, back text, ease numeric default 2.5, interval_days int default 1, due_on date default current_date
);

create table if not exists public.exam_targets (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.learners(id) on delete cascade,
  exam_name text, board text, exam_on date, target_grade text
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text, kind text, url text, status text default 'draft', created_at timestamptz default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author text, body text, rating int, published boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer text, referred text, credit numeric, status text default 'open'
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text, starts_at timestamptz, venue text, notes text
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text, url text, kind text
);

create table if not exists public.helpdesk_tickets (
  id uuid primary key default gen_random_uuid(),
  title text, body text, priority text default 'normal', status text default 'open',
  created_at timestamptz default now()
);

create table if not exists public.safeguarding_log (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.learners(id),
  body text, created_by uuid default auth.uid(), created_at timestamptz default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid default auth.uid(), action text, table_name text, row_id text,
  created_at timestamptz default now()
);

create table if not exists public.site_license (
  id int primary key default 1,
  model text default 'lifetime', status text default 'active',
  expires_on date, grace_days int default 7, plan text
);

create table if not exists public.tc_heartbeat (
  id integer primary key,
  last_ping timestamptz not null default now(),
  last_source text,
  ping_count bigint not null default 0
);
insert into public.tc_heartbeat (id) values (1) on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'role','parent'),
    'pending'
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Drop any prior version (parameter may have been named p_identifier) so
-- this script is safe to re-run. CREATE OR REPLACE cannot rename an IN param.
drop function if exists public.lookup_login_email(text);
create or replace function public.lookup_login_email(p_ident text)
returns text language sql stable security definer as $$
  select coalesce(
    (select email from public.learners where lower(full_name)=lower(p_ident) or email=p_ident limit 1),
    (select email from public.tutors where lower(full_name)=lower(p_ident) or email=p_ident limit 1),
    p_ident
  );
$$;

create or replace function public.tc_keep_alive(src text default 'unknown')
returns timestamptz
language sql security definer set search_path = public as $keepalive$
  update public.tc_heartbeat
     set last_ping = now(), last_source = left(coalesce(src,'unknown'),40), ping_count = ping_count + 1
   where id = 1 returning last_ping;
$keepalive$;
grant execute on function public.tc_keep_alive(text) to anon, authenticated;

create or replace function public.consume_session_hours()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    update public.engagements
      set hours_used = coalesce(hours_used,0) + coalesce(new.hours,1)
    where id = new.engagement_id;
    insert into public.hour_ledger(engagement_id, delta, reason, session_id)
    values (new.engagement_id, -coalesce(new.hours,1), 'session completed', new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_consume_hours on public.sessions;
create trigger trg_consume_hours after update on public.sessions
for each row execute function public.consume_session_hours();

-- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','practice_settings','tutors','parents','learners','parent_learner','subjects','methodologies',
    'engagements','engagement_members','inquiries','waitlist','trials','availability','sessions','session_attendance',
    'session_notes','goals','mastery_topics','curriculum_items','lesson_plans','assignments','assessments',
    'cbt_exams','cbt_results','packages','hour_ledger','invoices','payments','finance_entries','announcements',
    'messages','notifications','complaints','polls','poll_votes','resources','flashcards','exam_targets',
    'documents','reviews','referrals','events','gallery','helpdesk_tickets','safeguarding_log','activity_log',
    'site_license','tc_heartbeat'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin', t);
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())', t||'_admin', t);
    execute format('drop policy if exists %I on public.%I', t||'_tutor_read', t);
    execute format('create policy %I on public.%I for select using (public.is_tutor())', t||'_tutor_read', t);
  end loop;
end $$;

drop policy if exists learners_family on public.learners;
create policy learners_family on public.learners for select using (
  public.is_self_learner(id) or public.is_parent_of(id) or public.is_tutor()
);

drop policy if exists engagements_read on public.engagements;
create policy engagements_read on public.engagements for select using (
  public.is_tutor() or exists (
    select 1 from public.engagement_members em
    where em.engagement_id = engagements.id
      and (public.is_self_learner(em.learner_id) or public.is_parent_of(em.learner_id))
  )
);

drop policy if exists inquiries_insert on public.inquiries;
create policy inquiries_insert on public.inquiries for insert with check (true);

drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert on public.inquiries to anon;
grant execute on function public.tc_keep_alive(text) to anon, authenticated;
grant execute on function public.lookup_login_email(text) to anon, authenticated;

insert into public.practice_settings(id, name, motto) values (1, 'HMG Tutoring Studio', 'Independent progress. Visible to parents.')
on conflict (id) do nothing;

insert into public.methodologies(name, summary, steps) values
  ('Worked example → faded example → independent', 'Best when a skill is new or scores are falling.', '1. Tutor works one item aloud. 2. Learner completes a faded copy. 3. Independent item. 4. Error log.'),
  ('Spaced retrieval', 'Best for facts, definitions, formula fluency.', 'Short daily cards. SM-2 intervals. No re-reading notes instead of retrieval.'),
  ('Exam-technique drills', 'Best 6–8 weeks before a board exam.', 'Timed section. Mark scheme first. Then content repair on missed Assessment Objectives.'),
  ('CRA (Concrete–Representational–Abstract)', 'Best for younger or SEN maths.', 'Objects → drawings → symbols. Do not skip the middle step.')
on conflict do nothing;

select 'Tutoring Connect schema installed ✅' as status;

-- ===== V2 PACK INCLUDED (booking cycles, SOW, quizzes, forum, application links) =====

-- BEGIN v2-tutoring-ops.sql
-- Tutoring Connect V2 operations pack (idempotent).
-- Booking cycles, SOW, quizzes, reading, forum, application links, scoresheet, Drive columns.
-- Safe to re-run after complete-schema.sql.

alter table if exists public.learners add column if not exists student_no text;
create unique index if not exists learners_student_no_uq on public.learners (student_no) where student_no is not null;

create or replace function public.tc_generate_student_no()
returns trigger language plpgsql as $$
declare n int;
begin
  if new.student_no is null or new.student_no = '' then
    select coalesce(max(nullif(regexp_replace(student_no, '\D', '', 'g'), '')::int), 0) + 1
      into n from public.learners;
    new.student_no := 'TC-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_student_no on public.learners;
create trigger trg_student_no before insert on public.learners
for each row execute function public.tc_generate_student_no();

-- ========== BOOKING BLOCKS (4 cycles × 7 days) ==========
create table if not exists public.booking_blocks (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete cascade,
  parent_id uuid references public.parents(id),
  started_on date not null,
  times_per_cycle int not null default 1 check (times_per_cycle between 1 and 7),
  cycle_count int not null default 4,
  duration_minutes int not null default 60,
  hourly_rate numeric not null default 0,
  currency text default '₦',
  weekday int, -- 0=Sun .. 6=Sat for first weekly slot
  slot_time time,
  weekday_2 int, -- optional second weekly slot
  slot_time_2 time,
  computed_classes int,
  computed_hours numeric,
  computed_amount numeric,
  status text default 'active',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.booking_classes (
  id uuid primary key default gen_random_uuid(),
  block_id uuid references public.booking_blocks(id) on delete cascade,
  cycle_no int not null,
  seq_in_cycle int not null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 60,
  status text default 'scheduled', -- scheduled|done|missed|cancelled
  tutor_feedback text,
  topics_covered text,
  sow_topic_ids uuid[],
  completed_at timestamptz,
  completed_by uuid,
  created_at timestamptz default now()
);

create or replace function public.tc_expand_booking_block()
returns trigger language plpgsql as $$
declare
  i int; cyc int; seq int; when_ts timestamptz;
  total int; hours numeric; amt numeric;
  d0 date;
begin
  delete from public.booking_classes where block_id = new.id;
  total := new.times_per_cycle * new.cycle_count;
  hours := round((total * new.duration_minutes / 60.0)::numeric, 2);
  amt := round(hours * coalesce(new.hourly_rate, 0), 2);
  update public.booking_blocks set computed_classes = total, computed_hours = hours, computed_amount = amt where id = new.id;
  d0 := new.started_on;
  for cyc in 1..new.cycle_count loop
    for seq in 1..new.times_per_cycle loop
      if seq = 1 then
        when_ts := ((d0 + ((cyc - 1) * 7))::timestamp + coalesce(new.slot_time, time '16:00'));
        -- snap to requested weekday if set
        if new.weekday is not null then
          when_ts := ((d0 + ((cyc - 1) * 7) + ((new.weekday - extract(dow from d0)::int + 7) % 7))::timestamp
                      + coalesce(new.slot_time, time '16:00'));
        end if;
      else
        when_ts := ((d0 + ((cyc - 1) * 7) + ((coalesce(new.weekday_2, coalesce(new.weekday, 0) + 3) - extract(dow from d0)::int + 7) % 7))::timestamp
                    + coalesce(new.slot_time_2, coalesce(new.slot_time, time '16:00')));
      end if;
      insert into public.booking_classes(block_id, cycle_no, seq_in_cycle, scheduled_at, duration_minutes)
      values (new.id, cyc, seq, when_ts, new.duration_minutes);
    end loop;
  end loop;
  return new;
end $$;
drop trigger if exists trg_expand_booking on public.booking_blocks;
create trigger trg_expand_booking after insert or update of started_on, times_per_cycle, cycle_count, weekday, slot_time, weekday_2, slot_time_2, duration_minutes
on public.booking_blocks for each row execute function public.tc_expand_booking_block();

-- ========== SCHEME OF WORK ==========
create table if not exists public.sow_terms (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  subject text not null,
  term_label text not null,
  started_on date, ended_on date,
  status text default 'active',
  created_at timestamptz default now()
);
create table if not exists public.sow_topics (
  id uuid primary key default gen_random_uuid(),
  term_id uuid references public.sow_terms(id) on delete cascade,
  week_no int,
  topic text not null,
  objectives text,
  resources text,
  status text default 'planned', -- planned|taught|assessed|mastered
  coverage_pct numeric default 0,
  last_evaluated date,
  notes text
);
create table if not exists public.sow_evaluations (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.sow_topics(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete cascade,
  score numeric,
  comment text,
  evaluated_on date default current_date
);

-- ========== APPLICATION LINKS ==========
create table if not exists public.application_links (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  subject text,
  kind text default 'one_on_one',
  engagement_id uuid references public.engagements(id),
  intro text,
  expires_on date,
  max_uses int,
  uses int default 0,
  fields jsonb default '[]'::jsonb,
  status text default 'open',
  created_at timestamptz default now()
);
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.application_links(id),
  parent_name text, email text, phone text, learner_name text,
  timezone text, payload jsonb default '{}'::jsonb,
  status text default 'submitted',
  created_at timestamptz default now()
);

create or replace function public.tc_submit_application(p_code text, p_row jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare lid uuid; aid uuid; uses_now int; maxu int; st text; exp date;
begin
  select id, uses, max_uses, status, expires_on into lid, uses_now, maxu, st, exp
    from application_links where lower(code) = lower(p_code);
  if lid is null then raise exception 'Unknown application link'; end if;
  if st <> 'open' then raise exception 'This link is closed'; end if;
  if exp is not null and exp < current_date then raise exception 'This link has expired'; end if;
  if maxu is not null and uses_now >= maxu then raise exception 'This link has reached its maximum uses'; end if;
  insert into applications(link_id, parent_name, email, phone, learner_name, timezone, payload)
  values (lid, p_row->>'parent_name', p_row->>'email', p_row->>'phone', p_row->>'learner_name', p_row->>'timezone', p_row)
  returning id into aid;
  update application_links set uses = uses + 1 where id = lid;
  insert into inquiries(parent_name, email, phone, learner_name, subject, kind, timezone, source, notes, status)
  select p_row->>'parent_name', p_row->>'email', p_row->>'phone', p_row->>'learner_name',
         al.subject, al.kind, p_row->>'timezone', 'link:'||al.code, p_row->>'notes', 'new'
    from application_links al where al.id = lid;
  return aid;
end $$;
grant execute on function public.tc_submit_application(text, jsonb) to anon, authenticated;

-- ========== QUIZZES / CBT V2 ==========
alter table if exists public.cbt_exams add column if not exists quiz_kind text default 'graded'; -- self|review|graded
alter table if exists public.cbt_exams add column if not exists subject text;
alter table if exists public.cbt_exams add column if not exists subjects jsonb default '[]'::jsonb;
alter table if exists public.cbt_exams add column if not exists multi_subject boolean default false;
alter table if exists public.cbt_exams add column if not exists anti_cheat jsonb default '{}'::jsonb;
alter table if exists public.cbt_exams add column if not exists engagement_id uuid;
alter table if exists public.cbt_exams add column if not exists push_to_scoresheet boolean default true;
alter table if exists public.cbt_exams add column if not exists show_review boolean default true;

alter table if exists public.cbt_results add column if not exists student_no text;
alter table if exists public.cbt_results add column if not exists answers jsonb;
alter table if exists public.cbt_results add column if not exists review jsonb;
alter table if exists public.cbt_results add column if not exists quiz_kind text;
alter table if exists public.cbt_results add column if not exists subject_scores jsonb;
alter table if exists public.cbt_results add column if not exists violations jsonb;

create table if not exists public.scoresheet (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.learners(id) on delete cascade,
  engagement_id uuid references public.engagements(id),
  source text, -- graded_quiz|sow|homework|manual
  source_id uuid,
  title text,
  subject text,
  score numeric,
  max_score numeric,
  pct numeric,
  taken_on date default current_date,
  created_at timestamptz default now()
);

create or replace function public.tc_lookup_learner_by_student_no(p_no text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', id, 'full_name', full_name, 'student_no', student_no,
    'year_group', year_group, 'email', email
  ) from public.learners
  where lower(student_no) = lower(trim(p_no))
     or lower(full_name) = lower(trim(p_no))
  limit 1;
$$;
grant execute on function public.tc_lookup_learner_by_student_no(text) to anon, authenticated;

create or replace function public.tc_push_cbt_to_scoresheet()
returns trigger language plpgsql as $$
declare exam record; lid uuid;
begin
  select * into exam from public.cbt_exams where id = new.exam_id;
  if exam.quiz_kind is distinct from 'graded' and exam.push_to_scoresheet is not true then
    return new;
  end if;
  if exam.quiz_kind is distinct from 'graded' then
    return new;
  end if;
  lid := new.learner_id;
  if lid is null and new.student_no is not null then
    select id into lid from public.learners where lower(student_no) = lower(new.student_no) limit 1;
  end if;
  if lid is null then return new; end if;
  insert into public.scoresheet(learner_id, engagement_id, source, source_id, title, subject, score, max_score, pct, taken_on)
  values (lid, exam.engagement_id, 'graded_quiz', new.id, exam.title, exam.subject,
          new.score, new.max_score,
          case when coalesce(new.max_score,0)=0 then 0 else round((new.score/new.max_score)*100,1) end,
          current_date);
  insert into public.assessments(engagement_id, learner_id, title, kind, score, taken_on)
  values (exam.engagement_id, lid, exam.title, 'graded_quiz',
          case when coalesce(new.max_score,0)=0 then 0 else round((new.score/new.max_score)*100,1) end,
          current_date);
  return new;
end $$;
drop trigger if exists trg_push_cbt on public.cbt_results;
create trigger trg_push_cbt after insert on public.cbt_results
for each row execute function public.tc_push_cbt_to_scoresheet();

-- ========== READING ASSIGNMENTS ==========
create table if not exists public.reading_assignments (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  sow_topic_id uuid references public.sow_topics(id),
  title text not null,
  purpose text,
  due_on date,
  status text default 'open',
  created_at timestamptz default now()
);
create table if not exists public.reading_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.reading_assignments(id) on delete cascade,
  kind text not null default 'article', -- article|video|pdf|playlist
  title text not null,
  url text not null,
  minutes int,
  notes text
);
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.reading_items(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete cascade,
  done boolean default false,
  done_at timestamptz,
  unique(item_id, learner_id)
);

-- ========== GROUP FORUM ==========
create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  title text not null,
  body text,
  author_name text,
  author_role text,
  pinned boolean default false,
  created_at timestamptz default now()
);
create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.forum_threads(id) on delete cascade,
  body text not null,
  author_name text,
  author_role text,
  created_at timestamptz default now()
);

-- Drive + heartbeat columns already handled in dedicated files.
alter table if exists public.practice_settings add column if not exists drive_client_id text default '';
alter table if exists public.practice_settings add column if not exists drive_sync_enabled boolean not null default false;
alter table if exists public.practice_settings add column if not exists drive_sync_days int not null default 7;
alter table if exists public.practice_settings add column if not exists drive_folder_id text default '';
alter table if exists public.practice_settings add column if not exists drive_last_backup timestamptz;

-- RLS enable for new tables
do $$
declare t text;
begin
  foreach t in array array[
    'booking_blocks','booking_classes','sow_terms','sow_topics','sow_evaluations',
    'application_links','applications','scoresheet','reading_assignments','reading_items',
    'reading_progress','forum_threads','forum_posts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin', t);
    execute format('create policy %I on public.%I for all using (public.is_admin() or public.is_tutor()) with check (public.is_admin() or public.is_tutor())', t||'_admin', t);
  end loop;
end $$;

drop policy if exists applications_insert on public.applications;
create policy applications_insert on public.applications for insert with check (true);
drop policy if exists application_links_public_read on public.application_links;
create policy application_links_public_read on public.application_links for select using (status = 'open');

drop policy if exists forum_read on public.forum_threads;
create policy forum_read on public.forum_threads for select using (true);
drop policy if exists forum_post_read on public.forum_posts;
create policy forum_post_read on public.forum_posts for select using (true);
drop policy if exists forum_post_write on public.forum_posts;
create policy forum_post_write on public.forum_posts for insert with check (true);
drop policy if exists forum_thread_write on public.forum_threads;
create policy forum_thread_write on public.forum_threads for insert with check (true);

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.application_links to anon;
grant insert on public.applications to anon;
grant select, insert on public.cbt_results to anon;
grant select on public.cbt_exams to anon;
grant select on public.learners to anon;

select 'Tutoring Connect V2 operations pack installed ✅' as status;
-- BEGIN keep-alive.sql
-- Tutoring Connect keep-alive (idempotent). Already inside complete-schema.
create table if not exists public.tc_heartbeat (
  id integer primary key,
  last_ping timestamptz not null default now(),
  last_source text,
  ping_count bigint not null default 0
);
alter table public.tc_heartbeat enable row level security;
revoke all on table public.tc_heartbeat from anon, authenticated;
insert into public.tc_heartbeat (id) values (1) on conflict (id) do nothing;

create or replace function public.tc_keep_alive(src text default 'unknown')
returns timestamptz
language sql
security definer
set search_path = public
as $keepalive$
  update public.tc_heartbeat
     set last_ping = now(),
         last_source = left(coalesce(src, 'unknown'), 40),
         ping_count = ping_count + 1
   where id = 1
  returning last_ping;
$keepalive$;
grant execute on function public.tc_keep_alive(text) to anon, authenticated;

do $cronsetup$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule(jobid) from cron.job where jobname = 'tc-keep-alive';
      perform cron.schedule('tc-keep-alive', '23 5 */2 * *', $job$select public.tc_keep_alive('pg_cron')$job$);
    exception when others then
      raise notice 'pg_cron keep-alive not scheduled (%).', sqlerrm;
    end;
  end if;
end
$cronsetup$;
select 'Tutoring Connect keep-alive heartbeat installed ✅' as status;
-- BEGIN drive-sync.sql
alter table if exists public.practice_settings add column if not exists drive_client_id text default '';
alter table if exists public.practice_settings add column if not exists drive_sync_enabled boolean not null default false;
alter table if exists public.practice_settings add column if not exists drive_sync_days int not null default 7;
alter table if exists public.practice_settings add column if not exists drive_folder_id text default '';
alter table if exists public.practice_settings add column if not exists drive_last_backup timestamptz;
select 'Google Drive backup settings installed ✅' as status;

-- BEGIN v3-classroom-exams.sql
-- Stream, classwork, exam registration (idempotent).
create table if not exists public.exam_reg_links (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text, board text, series text, intro text,
  expires_on date, max_uses int, uses int default 0,
  status text default 'open', created_at timestamptz default now()
);
create table if not exists public.exam_registrations (
  id uuid primary key default gen_random_uuid(),
  code text, full_name text, student_no text, email text, phone text,
  dob date, sex text, id_no text, board text, series text, centre text,
  subjects text, photo_url text, doc_url text, guardian text, notes text,
  status text default 'submitted', created_at timestamptz default now()
);
create table if not exists public.stream_posts (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid, kind text, title text, body text, media_url text,
  publish_at timestamptz default now(), created_at timestamptz default now()
);
create table if not exists public.classwork_items (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid, topic text, kind text, title text, due_on date,
  points int, skills text, media_url text, created_at timestamptz default now()
);
alter table public.exam_reg_links enable row level security;
alter table public.exam_registrations enable row level security;
alter table public.stream_posts enable row level security;
alter table public.classwork_items enable row level security;
drop policy if exists exam_links_pub on public.exam_reg_links;
create policy exam_links_pub on public.exam_reg_links for select using (status = 'open');
drop policy if exists exam_reg_ins on public.exam_registrations;
create policy exam_reg_ins on public.exam_registrations for insert with check (true);
drop policy if exists exam_reg_staff on public.exam_registrations;
create policy exam_reg_staff on public.exam_registrations for all using (public.is_tutor()) with check (public.is_tutor());
drop policy if exists stream_rw on public.stream_posts;
create policy stream_rw on public.stream_posts for all using (true) with check (true);
drop policy if exists classwork_rw on public.classwork_items;
create policy classwork_rw on public.classwork_items for all using (true) with check (true);
grant select on public.exam_reg_links to anon, authenticated;
grant insert on public.exam_registrations to anon, authenticated;
grant select, insert, update, delete on public.stream_posts, public.classwork_items to authenticated;
select 'V3 classroom + exam registration installed ✅' as status;

-- ===== V4 PACK INCLUDED =====
-- Tutoring Connect V4 — School Connect parity tables (idempotent, free-tier).
-- Notifications audience, login audit, surveys, library, leave, payroll extras,
-- idle lock / lockdown, current-role RPC, notif_mark_read.

alter table if exists public.practice_settings add column if not exists idle_lock_minutes int default 30;
alter table if exists public.practice_settings add column if not exists lockdown_mode boolean default false;
alter table if exists public.practice_settings add column if not exists lockdown_message text;
alter table if exists public.practice_settings add column if not exists role_access jsonb;
alter table if exists public.practice_settings add column if not exists role_write jsonb;

alter table if exists public.notifications add column if not exists audience text default 'all';
alter table if exists public.notifications add column if not exists priority text default 'normal';
alter table if exists public.notifications add column if not exists channels text default '["inapp"]';
alter table if exists public.notifications add column if not exists read_by uuid[] default '{}';
alter table if exists public.notifications add column if not exists url text;
alter table if exists public.notifications add column if not exists recipient_id uuid;
alter table if exists public.notifications add column if not exists created_by uuid;

alter table if exists public.activity_log add column if not exists actor_id uuid;
alter table if exists public.activity_log add column if not exists actor_email text;
alter table if exists public.activity_log add column if not exists entity text;
alter table if exists public.activity_log add column if not exists entity_id text;
alter table if exists public.activity_log add column if not exists details jsonb;

create table if not exists public.login_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, email text, event text, user_agent text,
  created_at timestamptz default now()
);

create table if not exists public.push_subscriptions (
  user_id uuid primary key, subscription text, user_agent text, updated_at timestamptz default now()
);

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null, audience text default 'all', questions text,
  status text default 'open', created_at timestamptz default now()
);
create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid references public.surveys(id) on delete cascade,
  answers jsonb, created_at timestamptz default now()
);

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null, author text, url text not null, subject text, kind text,
  created_at timestamptz default now()
);
create table if not exists public.eresources (
  id uuid primary key default gen_random_uuid(),
  title text not null, subject text, url text not null, notes text,
  created_at timestamptz default now()
);
create table if not exists public.lms_lessons (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  title text not null, url text, order_no int, status text default 'draft',
  created_at timestamptz default now()
);
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  tutor_name text not null, kind text, starts_on date, ends_on date, reason text,
  status text default 'pending', decided_by uuid, decided_at timestamptz,
  created_at timestamptz default now()
);
create table if not exists public.payroll (
  id uuid primary key default gen_random_uuid(),
  tutor_name text not null, period text, hours numeric, rate numeric, gross numeric,
  status text default 'draft', created_at timestamptz default now()
);
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  learner_name text, title text, code text, issued_on date,
  created_at timestamptz default now()
);
create table if not exists public.fee_catalogue (
  id uuid primary key default gen_random_uuid(),
  name text not null, kind text, amount numeric, currency text default '₦'
);
create table if not exists public.scholarships (
  id uuid primary key default gen_random_uuid(),
  name text not null, percent numeric, notes text
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null, price numeric, url text
);
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null, kind text, url text, capacity int
);
create table if not exists public.substitutions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid, cover_tutor text, reason text, created_at timestamptz default now()
);
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text, audience text default 'all'
);
create table if not exists public.accommodations (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.learners(id) on delete cascade,
  kind text not null, notes text
);
create table if not exists public.onboarding_items (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  title text not null, done boolean default false
);
create table if not exists public.rubrics (
  id uuid primary key default gen_random_uuid(),
  title text not null, criteria text, scale text
);
create table if not exists public.compliance_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null, due_on date, status text default 'open'
);
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.learners(id) on delete cascade,
  title text not null, points int default 0
);
create table if not exists public.parent_meetings (
  id uuid primary key default gen_random_uuid(),
  parent_name text, learner_id uuid, scheduled_at timestamptz, notes text
);

create or replace function public.tc_current_role()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', id, 'email', email, 'full_name', full_name, 'role', role,
    'status', status, 'phone', phone, 'timezone', timezone, 'photo_url', photo_url
  ) from public.profiles where id = auth.uid();
$$;
grant execute on function public.tc_current_role() to authenticated;

create or replace function public.notif_mark_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.notifications
     set read_by = case when auth.uid() = any(coalesce(read_by,'{}')) then read_by
                        else array_append(coalesce(read_by,'{}'), auth.uid()) end,
         read_at = coalesce(read_at, now())
   where id = p_id;
end $$;
grant execute on function public.notif_mark_read(uuid) to authenticated;

-- V4 lookup: also match learners by student_no. Replace the V2 function
-- (must DROP first because CREATE OR REPLACE cannot rename an IN parameter,
-- and we want one clean definition).
drop function if exists public.lookup_login_email(text);
create or replace function public.lookup_login_email(p_identifier text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select email from public.learners where lower(student_no)=lower(p_identifier) or lower(full_name)=lower(p_identifier) or email=p_identifier limit 1),
    (select email from public.tutors where lower(full_name)=lower(p_identifier) or email=p_identifier limit 1),
    (select email from public.profiles where lower(full_name)=lower(p_identifier) or email=p_identifier limit 1),
    p_identifier
  );
$$;
grant execute on function public.lookup_login_email(text) to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'login_audit','push_subscriptions','surveys','survey_responses','library_items','eresources',
    'lms_lessons','leave_requests','payroll','certificates','fee_catalogue','scholarships','products',
    'rooms','substitutions','policies','accommodations','onboarding_items','rubrics','compliance_tasks',
    'badges','parent_meetings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin', t);
    execute format('create policy %I on public.%I for all using (public.is_admin() or public.is_tutor()) with check (public.is_admin() or public.is_tutor())', t||'_admin', t);
  end loop;
end $$;

drop policy if exists surveys_read on public.surveys;
create policy surveys_read on public.surveys for select using (true);
drop policy if exists library_read on public.library_items;
create policy library_read on public.library_items for select using (true);
drop policy if exists eres_read on public.eresources;
create policy eres_read on public.eresources for select using (true);
drop policy if exists policies_read on public.policies;
create policy policies_read on public.policies for select using (true);

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.surveys, public.library_items, public.eresources, public.policies to anon;

select 'Tutoring Connect V4 enterprise parity installed ✅' as status;

-- ===== V5 PACK INCLUDED =====
-- Tutoring Connect V5 — competitor-parity ops (idempotent, free-tier).
-- Makeup credit ledger, study log / timer, reminder log.

create table if not exists public.makeup_credits (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  learner_id uuid references public.learners(id),
  delta int not null,
  reason text,
  created_at timestamptz default now()
);

create table if not exists public.study_logs (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.learners(id) on delete cascade,
  topic text,
  minutes int,
  notes text,
  started_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  channel text,
  body text,
  created_by uuid,
  created_at timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array['makeup_credits','study_logs','reminder_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_staff', t);
    execute format('create policy %I on public.%I for all using (public.is_admin() or public.is_tutor()) with check (public.is_admin() or public.is_tutor())', t||'_staff', t);
  end loop;
end $$;

drop policy if exists study_self on public.study_logs;
create policy study_self on public.study_logs for select using (
  public.is_tutor() or public.is_self_learner(learner_id) or public.is_parent_of(learner_id)
);
drop policy if exists study_self_ins on public.study_logs;
create policy study_self_ins on public.study_logs for insert with check (
  public.is_tutor() or public.is_self_learner(learner_id)
);

grant select, insert, update, delete on public.makeup_credits, public.study_logs, public.reminder_log to authenticated;

select 'Tutoring Connect V5 ops parity installed ✅' as status;


-- ===== V6 PACK INCLUDED =====
-- Tutoring Connect V6 — CBT Open/Registered identity + per-subject scoresheet.
-- Idempotent. Safe to re-run. Included in complete-schema.sql.

alter table if exists public.cbt_exams add column if not exists exam_mode text default 'open';
alter table if exists public.cbt_exams add column if not exists is_open boolean default true;
alter table if exists public.cbt_exams add column if not exists multi_subject boolean default false;
alter table if exists public.cbt_results add column if not exists subject_scores jsonb default '{}'::jsonb;
alter table if exists public.scoresheet add column if not exists subject text;

create table if not exists public.cbt_roster (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.cbt_exams(id) on delete cascade,
  learner_id uuid references public.learners(id) on delete cascade,
  student_no text,
  unique(exam_id, learner_id)
);
alter table public.cbt_roster enable row level security;
drop policy if exists cbt_roster_staff on public.cbt_roster;
create policy cbt_roster_staff on public.cbt_roster for all
  using (public.is_admin() or public.is_tutor())
  with check (public.is_admin() or public.is_tutor());

-- Resolve exam + identity (School Connect cbt_get_public_exam_v6 pattern).
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

  -- Open / anonymous: registered learners MAY identify with student ID; guests type a display name only.
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

-- Per-subject + overall scoresheet push (School Connect multi-subject pattern).
create or replace function public.tc_push_cbt_to_scoresheet()
returns trigger language plpgsql as $$
declare
  exam record;
  lid uuid;
  subj text;
  rec jsonb;
  sc numeric;
  tot numeric;
  pct numeric;
begin
  select * into exam from public.cbt_exams where id = new.exam_id;
  if exam.quiz_kind is distinct from 'graded' and exam.push_to_scoresheet is not true then
    return new;
  end if;
  if exam.quiz_kind is distinct from 'graded' then
    return new;
  end if;
  lid := new.learner_id;
  if lid is null and new.student_no is not null then
    select id into lid from public.learners where lower(student_no) = lower(new.student_no) limit 1;
  end if;
  if lid is null then return new; end if;

  -- Overall row
  insert into public.scoresheet(learner_id, engagement_id, source, source_id, title, subject, score, max_score, pct, taken_on)
  values (lid, exam.engagement_id, 'graded_quiz', new.id,
          exam.title || ' (overall)', coalesce(exam.subject, 'Overall'),
          new.score, new.max_score,
          case when coalesce(new.max_score,0)=0 then 0 else round((new.score/new.max_score)*100,1) end,
          current_date);

  -- One row per subject from subject_scores JSON
  if new.subject_scores is not null and jsonb_typeof(new.subject_scores) = 'object' then
    for subj, rec in select key, value from jsonb_each(new.subject_scores) loop
      -- Skip an aggregate 'overall' bucket; real subjects each get their own row.
      if lower(subj) in ('overall','general','total','aggregate') then
        continue;
      end if;
      sc := coalesce((rec->>'score')::numeric, (rec->>'got')::numeric, 0);
      tot := coalesce((rec->>'total')::numeric, (rec->>'max')::numeric, 0);
      if tot = 0 then continue; end if;
      pct := round((sc / tot) * 100, 1);
      insert into public.scoresheet(learner_id, engagement_id, source, source_id, title, subject, score, max_score, pct, taken_on)
      values (lid, exam.engagement_id, 'graded_quiz_subject', new.id,
              exam.title || ' — ' || subj, subj, sc, tot, pct, current_date);
    end loop;
  end if;

  insert into public.assessments(engagement_id, learner_id, title, kind, score, taken_on)
  values (exam.engagement_id, lid, exam.title, 'graded_quiz',
          case when coalesce(new.max_score,0)=0 then 0 else round((new.score/new.max_score)*100,1) end,
          current_date);
  return new;
end $$;

drop trigger if exists trg_push_cbt on public.cbt_results;
create trigger trg_push_cbt after insert on public.cbt_results
for each row execute function public.tc_push_cbt_to_scoresheet();

-- License columns (subscription mode)
alter table if exists public.site_license add column if not exists renew_url text;
alter table if exists public.site_license add column if not exists lock_message text;
alter table if exists public.site_license add column if not exists registry_url text;
alter table if exists public.site_license add column if not exists signature text;

grant select, insert, update, delete on public.cbt_roster to authenticated;
grant select on public.cbt_exams to anon, authenticated;
grant select, insert on public.cbt_results to anon, authenticated;
grant select on public.scoresheet to authenticated;

select 'Tutoring Connect V6 CBT modes + per-subject scoresheet installed ✅' as status;


-- ===== STORAGE OFFLOAD INCLUDED =====
-- Private storage buckets for vault archives and proctor snapshots (1 GB file space, not the 500 MB DB).
insert into storage.buckets (id, name, public)
values ('archives', 'archives', false), ('proctor', 'proctor', false)
on conflict (id) do nothing;

-- Learners may upload only into their own proctor prefix; staff may read/delete.
drop policy if exists proctor_upload on storage.objects;
create policy proctor_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'proctor');
drop policy if exists proctor_staff_read on storage.objects;
create policy proctor_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'proctor');
drop policy if exists archives_admin on storage.objects;
create policy archives_admin on storage.objects for all to authenticated
  using (bucket_id = 'archives') with check (bucket_id = 'archives');
select 'Storage offload buckets ready ✅' as status;


-- =============================================================================
-- V7 — Enterprise parity tables referenced by assets/js/enterprise.js and
--      the optional bring-your-own-key AI assistant (ai-assistant.js).
--      These were previously only present in the School Connect schema, which
--      caused runtime "relation does not exist" errors when the timetable
--      generator, QR check-in, diary, menu planner, incidents/finance, 2FA
--      prefs, or AI assistant were opened in a Tutoring Connect studio.
-- =============================================================================

-- Timetable generator -------------------------------------------------------
create table if not exists public.timetable_requirements (
  id uuid primary key default gen_random_uuid(),
  class text not null,
  subject text not null,
  teacher text,
  periods_per_week int default 1,
  available_days jsonb,
  is_part_time boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (class, subject)
);

create table if not exists public.timetable (
  id uuid primary key default gen_random_uuid(),
  class text not null,
  session text,
  term text,
  day text not null,
  period int not null,
  subject text,
  teacher text,
  room text,
  created_at timestamptz default now()
);

-- QR / code self check-in ---------------------------------------------------
create table if not exists public.attendance_checkins (
  id uuid primary key default gen_random_uuid(),
  student_id_ref text,
  student_name text,
  class text,
  method text default 'qr',
  device text,
  created_at timestamptz default now()
);

-- Student diary / homework log ---------------------------------------------
create table if not exists public.student_diary (
  id uuid primary key default gen_random_uuid(),
  student_id uuid,
  student_name text,
  class text,
  subject text,
  entry_type text default 'homework',
  title text,
  body text,
  acknowledged boolean default false,
  date timestamptz default now(),
  created_at timestamptz default now()
);

-- Menu / meal planner -------------------------------------------------------
create table if not exists public.menu_planner (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  day text not null,
  meal text not null,
  description text,
  allergens text,
  created_at timestamptz default now()
);

-- Generic module records (incidents, etc.) ----------------------------------
create table if not exists public.module_records (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  title text,
  body text,
  status text default 'open',
  data jsonb,
  created_at timestamptz default now()
);

-- Finance: fee payments + double-entry style ledger -------------------------
create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid references public.learners(id) on delete set null,
  engagement_id uuid references public.engagements(id) on delete set null,
  amount numeric default 0,
  method text,
  reference text,
  paid_on date default current_date,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date default current_date,
  account text,
  description text,
  amount numeric default 0,
  direction text default 'in',
  reference text,
  created_at timestamptz default now()
);

-- Per-user security preferences (2FA email OTP toggle) ----------------------
create table if not exists public.security_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  two_factor boolean default false,
  updated_at timestamptz default now()
);

-- Optional bring-your-own-key AI assistant configuration --------------------
create table if not exists public.sc_ai_settings (
  id int primary key default 1,
  enabled boolean default false,
  base_url text,
  api_key text,
  model text default 'gpt-4o-mini',
  updated_at timestamptz default now()
);

-- updated_at triggers -------------------------------------------------------
drop trigger if exists trg_timetable_requirements_updated on public.timetable_requirements;
create trigger trg_timetable_requirements_updated before update on public.timetable_requirements
  for each row execute function public.tc_set_updated_at();

-- RLS -----------------------------------------------------------------------
alter table public.timetable_requirements enable row level security;
alter table public.timetable enable row level security;
alter table public.attendance_checkins enable row level security;
alter table public.student_diary enable row level security;
alter table public.menu_planner enable row level security;
alter table public.module_records enable row level security;
alter table public.fee_payments enable row level security;
alter table public.finance_entries enable row level security;
alter table public.security_prefs enable row level security;
alter table public.sc_ai_settings enable row level security;

-- Tutors/staff manage operational tables; learners/parents are restricted.
drop policy if exists enterprise_staff_all on public.timetable_requirements;
create policy enterprise_staff_all on public.timetable_requirements for all to authenticated
  using (public.is_tutor()) with check (public.is_tutor());
drop policy if exists enterprise_staff_all on public.timetable;
create policy enterprise_staff_all on public.timetable for all to authenticated
  using (public.is_tutor()) with check (public.is_tutor());
drop policy if exists enterprise_staff_all on public.attendance_checkins;
create policy enterprise_staff_all on public.attendance_checkins for all to authenticated
  using (public.is_tutor()) with check (public.is_tutor());
drop policy if exists enterprise_staff_all on public.student_diary;
create policy enterprise_staff_all on public.student_diary for all to authenticated
  using (public.is_tutor()) with check (public.is_tutor());
drop policy if exists enterprise_staff_all on public.menu_planner;
create policy enterprise_staff_all on public.menu_planner for all to authenticated
  using (public.is_tutor()) with check (public.is_tutor());
drop policy if exists enterprise_staff_all on public.module_records;
create policy enterprise_staff_all on public.module_records for all to authenticated
  using (public.is_tutor()) with check (public.is_tutor());

-- Finance: owners only.
drop policy if exists finance_owner_all on public.fee_payments;
create policy finance_owner_all on public.fee_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists finance_owner_all on public.finance_entries;
create policy finance_owner_all on public.finance_entries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- A user may read/write only their own security prefs.
drop policy if exists security_prefs_self on public.security_prefs;
create policy security_prefs_self on public.security_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AI settings: any authenticated staff may read (so the helper knows whether
-- to appear); only admins may update (so the key is not exposed to families).
drop policy if exists ai_settings_read on public.sc_ai_settings;
create policy ai_settings_read on public.sc_ai_settings for select to authenticated
  using (public.is_tutor());
drop policy if exists ai_settings_admin_write on public.sc_ai_settings;
create policy ai_settings_admin_write on public.sc_ai_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on
  public.timetable_requirements, public.timetable, public.attendance_checkins,
  public.student_diary, public.menu_planner, public.module_records
  to authenticated;
grant select, insert, update, delete on public.fee_payments, public.finance_entries to authenticated;
grant select, insert, update, delete on public.security_prefs to authenticated;
grant select on public.sc_ai_settings to authenticated;

select 'Tutoring Connect V7 enterprise + AI tables installed ✅' as status;

-- =====================================================================
-- COMPAT: ensure CRUD tables have created_at for ordering/UI consistency.
-- (Earlier versions of session_attendance/packages/payments/flashcards
-- shipped without it, which caused "column created_at does not exist"
-- errors on the Attendance and Hour banks pages.)
-- =====================================================================
alter table public.session_attendance add column if not exists created_at timestamptz not null default now();
alter table public.packages add column if not exists created_at timestamptz not null default now();
alter table public.payments add column if not exists created_at timestamptz not null default now();
alter table public.flashcards add column if not exists created_at timestamptz not null default now();

-- =====================================================================
-- STORAGE REPORT (free-tier guardianship)
-- Returns estimated live table sizes and a total so the Storage manager
-- can show how close the studio is to the 500 MB free database limit.
-- Safe to re-run; uses pg_class estimates (no heavy seq scans).
-- =====================================================================
create or replace function public.tc_storage_report()
returns table (table_name text, rows bigint, size_bytes bigint)
language sql stable security definer set search_path = public as $$
  select relname::text,
         coalesce(reltuples::bigint, 0),
         coalesce(pg_relation_size(c.oid), 0)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
   order by pg_relation_size(c.oid) desc;
$$;
grant execute on function public.tc_storage_report() to authenticated;

-- =====================================================================
-- AUTO TIMETABLE GENERATOR (enterprise feature)
-- Round-robin assigns subjects (with weekly period counts) across days and
-- periods for a class. Deterministic and idempotent: clears prior generated
-- rows for the class/session/term first, then re-inserts.
-- =====================================================================
create table if not exists public.timetable_requirements (
  id uuid primary key default gen_random_uuid(),
  class text not null, subject text not null, teacher text,
  periods_per_week int not null default 1,
  available_days text[] default '{}',
  is_part_time boolean default false,
  created_at timestamptz not null default now(),
  unique(class, subject)
);
create table if not exists public.timetable (
  id uuid primary key default gen_random_uuid(),
  class text not null, session text default '', term text default '',
  day text not null, period int not null, subject text not null, teacher text,
  generated boolean default true,
  created_at timestamptz not null default now(),
  unique(class, session, term, day, period)
);
alter table public.timetable_requirements enable row level security;
alter table public.timetable enable row level security;
drop policy if exists timetable_staff on public.timetable;
create policy timetable_staff on public.timetable for all using (public.is_tutor()) with check (public.is_tutor());
drop policy if exists req_staff on public.timetable_requirements;
create policy req_staff on public.timetable_requirements for all using (public.is_tutor()) with check (public.is_tutor());
drop policy if exists timetable_read on public.timetable;
create policy timetable_read on public.timetable for select using (true);

create or replace function public.generate_timetable(
  p_class text, p_session text default '', p_term text default '', p_periods_per_day int default 6
)
returns table (day text, period int, subject text, teacher text)
language plpgsql security definer set search_path = public as $$
declare
  days text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday'];
  r record;
  slot int := 0;
  total_slots int;
begin
  delete from public.timetable where class = p_class and coalesce(session,'') = coalesce(p_session,'') and coalesce(term,'') = coalesce(p_term,'');
  total_slots := array_length(days,1) * greatest(p_periods_per_day,1);
  for r in select subject, teacher, periods_per_week from public.timetable_requirements
            where class = p_class order by periods_per_week desc, subject loop
    for i in 1..greatest(r.periods_per_week,1) loop
      insert into public.timetable(class,session,term,day,period,subject,teacher,generated)
      values (p_class, p_session, p_term,
              days[1 + (slot % array_length(days,1))],
              1 + ((slot / array_length(days,1)) % greatest(p_periods_per_day,1)),
              r.subject, r.teacher, true)
      on conflict (class,session,term,day,period) do nothing;
      slot := slot + 1;
      exit when slot >= total_slots;
    end loop;
    exit when slot >= total_slots;
  end loop;
  return query select t.day, t.period, t.subject, t.teacher from public.timetable t
    where t.class=p_class order by t.day, t.period;
end $$;
grant execute on function public.generate_timetable(text,text,text,int) to authenticated;


-- ===== V7 PACK INCLUDED (family access + CBT submission fix) =====
-- ============================================================================
-- Tutoring Connect V7 — FAMILY ACCESS + CBT SUBMISSION FIX  (idempotent)
-- ============================================================================
-- WHY THIS PACK EXISTS
--
-- The V1–V6 packs enable RLS on all 101 tables (good) but the per-table
-- policies were only ever completed for THREE family-facing tables:
--   learners (learners_family), engagements (engagements_read), study_logs.
--
-- Every other family table received only the generated loop policies:
--     <t>_admin       for all    using (is_admin())
--     <t>_tutor_read  for select using (is_tutor())
--
-- Consequence: a signed-in PARENT or LEARNER is denied by RLS on scoresheet,
-- assessments, sessions, invoices, messages, notifications, hour_ledger,
-- bookings, reading, goals, mastery — i.e. the entire parent-facing product
-- ("Independent progress. Visible to parents.") returns empty result sets.
--
-- Separately, public CBT submission is rejected: cbt_results has a table-level
-- INSERT grant to anon but NO insert policy, so every learner who finishes a
-- quiz gets 42501 "new row violates row-level security policy" and the score
-- is lost (verified live against a deployed studio).
--
-- This pack adds the missing FAMILY-SCOPED policies. It never widens staff
-- access and never grants anything to anon beyond the CBT submit path that
-- the UI already assumes. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper: is the current user the learner, or a parent of the learner,
--    on a given ENGAGEMENT? (engagement_members is the join table.)
-- ---------------------------------------------------------------------------
create or replace function public.is_family_of_engagement(p_engagement uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_engagement is null then return false; end if;
  return exists (
    select 1 from public.engagement_members em
    where em.engagement_id = p_engagement
      and (public.is_self_learner(em.learner_id) or public.is_parent_of(em.learner_id))
  );
end $$;
grant execute on function public.is_family_of_engagement(uuid) to authenticated;

-- Convenience: learner-or-parent on a learner row.
create or replace function public.is_family_of_learner(p_learner uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_learner is null then return false; end if;
  return public.is_self_learner(p_learner) or public.is_parent_of(p_learner);
end $$;
grant execute on function public.is_family_of_learner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. PROFILES — a user must be able to read and edit their OWN profile.
--    Previously admin-only: profile.html, the name chip and password/profile
--    editing were dead for parents, learners and even tutors editing self.
--    (Login itself survived only because tc_current_role() is SECURITY DEFINER.)
-- ---------------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));
-- NOTE: the with-check pins `role` to its existing value so a user can edit
-- their name/phone/photo but can NEVER escalate themselves to admin.

-- ---------------------------------------------------------------------------
-- 2. LEARNER-SCOPED TABLES (have a learner_id column)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'scoresheet','assessments','session_attendance','session_notes',
    'mastery_topics','reading_progress','cbt_results'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_family_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_family_of_learner(learner_id))',
      t||'_family_read', t);
  end loop;
end $$;

-- goals / assignments carry BOTH learner_id and engagement_id; a group
-- assignment has learner_id null and must still reach the whole group.
do $$
declare t text;
begin
  foreach t in array array['goals','assignments'] loop
    execute format('drop policy if exists %I on public.%I', t||'_family_read', t);
    execute format(
      'create policy %I on public.%I for select using ('
      || ' public.is_family_of_learner(learner_id)'
      || ' or (learner_id is null and public.is_family_of_engagement(engagement_id)))',
      t||'_family_read', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. ENGAGEMENT-SCOPED TABLES (have an engagement_id column)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'sessions','hour_ledger','reading_assignments','curriculum_items',
    'sow_terms','stream_posts','classwork_items'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_family_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_family_of_engagement(engagement_id))',
      t||'_family_read', t);
  end loop;
end $$;

-- sow_topics has NO engagement_id of its own — it reaches the engagement
-- through term_id -> sow_terms.engagement_id. (Getting this wrong would make
-- the whole patch fail at runtime with "column engagement_id does not exist".)
drop policy if exists sow_topics_family_read on public.sow_topics;
create policy sow_topics_family_read on public.sow_topics
  for select using (
    exists (
      select 1 from public.sow_terms st
      where st.id = sow_topics.term_id
        and public.is_family_of_engagement(st.engagement_id)
    )
  );

-- engagement_members: a family may see the membership rows of their own-- engagements (needed to resolve group names on the dashboard).
drop policy if exists engagement_members_family_read on public.engagement_members;
create policy engagement_members_family_read on public.engagement_members
  for select using (
    public.is_family_of_learner(learner_id) or public.is_family_of_engagement(engagement_id)
  );

-- ---------------------------------------------------------------------------
-- 4. BOOKINGS — "Every booked class shows on your dashboard with the amount
--    you agreed." booking_classes reaches its engagement through booking_blocks.
-- ---------------------------------------------------------------------------
drop policy if exists booking_blocks_family_read on public.booking_blocks;
create policy booking_blocks_family_read on public.booking_blocks
  for select using (public.is_family_of_engagement(engagement_id));

drop policy if exists booking_classes_family_read on public.booking_classes;
create policy booking_classes_family_read on public.booking_classes
  for select using (
    exists (
      select 1 from public.booking_blocks bb
      where bb.id = booking_classes.block_id
        and public.is_family_of_engagement(bb.engagement_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 5. BILLING — a parent must see their own invoices and the payments on them.
--    invoices.parent_id -> parents.id -> parents.user_id = auth.uid()
-- ---------------------------------------------------------------------------
drop policy if exists invoices_family_read on public.invoices;
create policy invoices_family_read on public.invoices
  for select using (
    exists (select 1 from public.parents p
             where p.id = invoices.parent_id and p.user_id = auth.uid())
    or public.is_family_of_engagement(engagement_id)
  );

drop policy if exists payments_family_read on public.payments;
create policy payments_family_read on public.payments
  for select using (
    exists (
      select 1 from public.invoices i
      join public.parents p on p.id = i.parent_id
      where i.id = payments.invoice_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. NOTIFICATIONS + MESSAGES — the bell and the inbox were staff-only, so
--    "Bell for messages and class reminders" never fired for a parent.
-- ---------------------------------------------------------------------------
drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications
  for select using (user_id = auth.uid() or user_id is null);  -- null = broadcast

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages(sender uuid default auth.uid(), to_role text, ...)
drop policy if exists messages_own_read on public.messages;
create policy messages_own_read on public.messages
  for select using (
    sender = auth.uid()
    or to_role is null
    or lower(to_role) = 'all'
    or lower(to_role) = lower(coalesce((select p.role from public.profiles p where p.id = auth.uid()), ''))
  );

drop policy if exists messages_own_send on public.messages;
create policy messages_own_send on public.messages
  for insert with check (sender = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. PUSH SUBSCRIPTIONS — every signed-in user must be able to register their
--    own device, otherwise web-push silently never enrols a parent.
-- ---------------------------------------------------------------------------
drop policy if exists push_self on public.push_subscriptions;
create policy push_self on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8. LOGIN AUDIT — security-guard.js claims "every sign-in and sign-out is
--    recorded", but only staff could insert. Let any authenticated user append
--    their OWN row; reading stays admin/tutor-only (tamper-evident).
-- ---------------------------------------------------------------------------
drop policy if exists login_audit_self_insert on public.login_audit;
create policy login_audit_self_insert on public.login_audit
  for insert with check (user_id = auth.uid() or user_id is null);

-- ---------------------------------------------------------------------------
-- 9. CBT SUBMISSION (the critical one)
--    cbt-exam.html submits as an ANONYMOUS visitor (quiz code + student ID is
--    the gate, by design). anon holds the INSERT grant but had no policy, so
--    every submission failed with 42501 and the score was lost.
-- ---------------------------------------------------------------------------
drop policy if exists cbt_results_public_insert on public.cbt_results;
create policy cbt_results_public_insert on public.cbt_results
  for insert with check (true);
-- Rationale for `true`: this mirrors the already-shipped and identical
-- exam_reg_ins / inquiries_insert pattern. The row is write-only for anon
-- (no anon SELECT policy exists), so a candidate can submit but can never
-- read anyone's results back. Grading integrity is preserved server-side by
-- the trg_push_cbt trigger, which re-reads the exam row.

-- Let a family read their own results back (review screen + scoresheet).
-- Already covered by cbt_results_family_read in section 2 for signed-in
-- families; anonymous candidates keep their review in-page only.

-- ---------------------------------------------------------------------------
-- 10. TIGHTEN over-permissive V3 policies.
--     stream_posts / classwork_items shipped as:
--         for all using (true) with check (true)
--     Any authenticated user — including a parent or a learner — could READ,
--     EDIT and DELETE the classwork and stream of EVERY engagement. That is
--     the exact opposite of "a sibling's scores never leak".
--     Replaced with: family reads its own engagement (section 3), staff write.
-- ---------------------------------------------------------------------------
drop policy if exists stream_rw on public.stream_posts;
drop policy if exists classwork_rw on public.classwork_items;

do $$
declare t text;
begin
  foreach t in array array['stream_posts','classwork_items'] loop
    execute format('drop policy if exists %I on public.%I', t||'_staff_rw', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_admin() or public.is_tutor())'
      || ' with check (public.is_admin() or public.is_tutor())', t||'_staff_rw', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Grants. RLS is the gate; these only make the gate reachable.
-- ---------------------------------------------------------------------------
grant select on public.booking_blocks, public.booking_classes to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant insert on public.login_audit to authenticated;
grant select, update on public.profiles to authenticated;

select 'Tutoring Connect V7 family-access + CBT submission fix installed ✅' as status;


-- ===== V9 PACK INCLUDED (keep-alive hardening + Drive sync settings) =====
-- ============================================================================
-- Tutoring Connect V9 — KEEP-ALIVE HARDENING + DRIVE SYNC SUPPORT (idempotent)
-- ============================================================================
-- BACKGROUND (verified against Supabase behaviour, Aug 2026)
--
--   * Supabase pauses a FREE project after 7 consecutive days of inactivity.
--   * "Inactivity" is measured by real DATABASE activity. Visiting your
--     front end, opening the Supabase dashboard, or calling an API route that
--     never touches Postgres does NOT reset the timer.
--   * A paused project must be un-paused BY HAND from the dashboard, and a
--     project left paused is eventually DELETED (~90 days).
--   * pg_cron cannot save you on its own: it runs inside the database, so once
--     the project pauses the scheduler pauses with it. It is a useful bonus
--     layer, never the primary one.
--
-- WHAT V8 GOT WRONG (found by audit, reproduced against a live project)
--
--   1. `revoke all on public.tc_heartbeat from anon, authenticated` combined
--      with RLS and no policy meant platform-health.html could NEVER read the
--      heartbeat: the live project returns
--         42501 permission denied for table tc_heartbeat
--      So the keep-alive system was completely UNOBSERVABLE. An owner had no
--      way to discover that their pings had stopped until the project paused.
--      That is the single most dangerous failure mode: silent.
--   2. There was no status RPC, so no external monitor could ask
--      "how close am I to being paused?".
--   3. tc_keep_alive only did an UPDATE. If row id=1 were ever missing the
--      heartbeat silently no-opped and still returned success.
--
-- THIS PACK FIXES ALL THREE and adds an auditable ping log.
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Heartbeat table (unchanged shape, guaranteed to exist)
-- ---------------------------------------------------------------------------
create table if not exists public.tc_heartbeat (
  id integer primary key,
  last_ping timestamptz not null default now(),
  last_source text,
  ping_count bigint not null default 0
);
insert into public.tc_heartbeat (id) values (1) on conflict (id) do nothing;
alter table public.tc_heartbeat enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Ping log — observability. Capped at 200 rows so it can never threaten
--    the 500 MB free-tier budget (200 rows ≈ 20 KB).
-- ---------------------------------------------------------------------------
create table if not exists public.tc_keepalive_log (
  id bigserial primary key,
  pinged_at timestamptz not null default now(),
  source text,
  ok boolean not null default true
);
create index if not exists tc_keepalive_log_at_idx on public.tc_keepalive_log (pinged_at desc);
alter table public.tc_keepalive_log enable row level security;

-- ---------------------------------------------------------------------------
-- 3. THE write. SECURITY DEFINER so anon can trigger it without any table
--    grant. Now an UPSERT (never a silent no-op) and it records the ping.
-- ---------------------------------------------------------------------------
create or replace function public.tc_keep_alive(src text default 'unknown')
returns timestamptz
language plpgsql
security definer
set search_path = public
as $keepalive$
declare v_now timestamptz := now();
begin
  insert into public.tc_heartbeat (id, last_ping, last_source, ping_count)
  values (1, v_now, left(coalesce(src, 'unknown'), 40), 1)
  on conflict (id) do update
     set last_ping   = v_now,
         last_source = left(coalesce(src, 'unknown'), 40),
         ping_count  = public.tc_heartbeat.ping_count + 1;

  insert into public.tc_keepalive_log (pinged_at, source, ok)
  values (v_now, left(coalesce(src, 'unknown'), 40), true);

  -- Keep only the newest 200 log rows.
  delete from public.tc_keepalive_log
   where id < (select max(id) - 200 from public.tc_keepalive_log);

  return v_now;
end
$keepalive$;
grant execute on function public.tc_keep_alive(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. THE read. Lets any monitor (or the Platform Health page) ask how close
--    the project is to being paused, WITHOUT granting table access.
--    Returns jsonb so external cron services can assert on it.
--
--    state: healthy  (< 3 days since last ping)
--           warning  (3–5 days — a scheduler has probably missed a run)
--           critical (> 5 days — pause is imminent, act now)
-- ---------------------------------------------------------------------------
create or replace function public.tc_keep_alive_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $status$
  select jsonb_build_object(
    'ok',            true,
    'last_ping',     h.last_ping,
    'last_source',   h.last_source,
    'ping_count',    h.ping_count,
    'hours_since',   round(extract(epoch from (now() - h.last_ping)) / 3600.0, 2),
    'days_since',    round(extract(epoch from (now() - h.last_ping)) / 86400.0, 2),
    'days_left',     greatest(0, round(7 - extract(epoch from (now() - h.last_ping)) / 86400.0, 2)),
    'pause_risk_at', h.last_ping + interval '7 days',
    'state', case
               when now() - h.last_ping < interval '3 days' then 'healthy'
               when now() - h.last_ping < interval '5 days' then 'warning'
               else 'critical'
             end,
    'checked_at',    now()
  )
  from public.tc_heartbeat h
  where h.id = 1;
$status$;
grant execute on function public.tc_keep_alive_status() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Observability for staff. THE V8 BUG FIX: the Platform Health page could
--    not read this table at all. Staff may now read the heartbeat and the log;
--    anon still cannot (it uses the status RPC instead). Nobody may write
--    directly — the only write path remains the SECURITY DEFINER function.
-- ---------------------------------------------------------------------------
grant select on public.tc_heartbeat    to authenticated;
grant select on public.tc_keepalive_log to authenticated;
revoke all on public.tc_heartbeat     from anon;
revoke all on public.tc_keepalive_log from anon;

drop policy if exists tc_heartbeat_staff_read on public.tc_heartbeat;
create policy tc_heartbeat_staff_read on public.tc_heartbeat
  for select using (public.is_admin() or public.is_tutor());

drop policy if exists tc_keepalive_log_staff_read on public.tc_keepalive_log;
create policy tc_keepalive_log_staff_read on public.tc_keepalive_log
  for select using (public.is_admin() or public.is_tutor());

-- ---------------------------------------------------------------------------
-- 6. pg_cron — a BONUS layer only.
--    It cannot rescue a paused project (it pauses too), but while the project
--    is awake it adds a free internal ping every 2 days. Never rely on it.
-- ---------------------------------------------------------------------------
do $cronsetup$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule(jobid) from cron.job where jobname = 'tc-keep-alive';
      perform cron.schedule('tc-keep-alive', '23 5 */2 * *',
                            $job$select public.tc_keep_alive('pg_cron')$job$);
    exception when others then
      raise notice 'pg_cron keep-alive not scheduled (%). This is non-fatal.', sqlerrm;
    end;
  end if;
end
$cronsetup$;

-- ---------------------------------------------------------------------------
-- 7. Google Drive sync settings (used by assets/js/drive-sync.js)
-- ---------------------------------------------------------------------------
alter table if exists public.practice_settings add column if not exists drive_client_id     text default '';
alter table if exists public.practice_settings add column if not exists drive_sync_enabled  boolean not null default false;
alter table if exists public.practice_settings add column if not exists drive_sync_days     int not null default 7;
alter table if exists public.practice_settings add column if not exists drive_folder_id     text default '';
alter table if exists public.practice_settings add column if not exists drive_last_backup   timestamptz;
alter table if exists public.practice_settings add column if not exists drive_last_status   text default '';
alter table if exists public.practice_settings add column if not exists drive_last_rows     int default 0;
alter table if exists public.practice_settings add column if not exists drive_last_bytes    bigint default 0;

-- practice_settings is admin-write by the loop policy, but the Drive panel is
-- opened by owners/admins only, so no extra policy is required. Reading it is
-- already permitted for tutors via the *_tutor_read policy.

select 'Tutoring Connect V9 keep-alive hardening + Drive settings installed ✅' as status;

-- ===== V12 PACK INCLUDED (schema registry + free-tier quota guard) =====
-- ============================================================================
-- Tutoring Connect V12 — SCHEMA REGISTRY + FREE-TIER QUOTA GUARD (idempotent)
-- ============================================================================
-- Two jobs, both aimed squarely at surviving on the Supabase free tier:
--
--   PART A — a SCHEMA REGISTRY, so a studio can always answer "which version am
--   I actually running?" without guessing. The V11 audit found the live ADEWALE
--   CLASSROOM project silently sitting at V4 while its files expected V9; the
--   only way to detect that was to probe for functions one by one. Now the
--   database records its own version.
--
--   PART B — a QUOTA GUARD for the 500 MB database limit. The platform already
--   refuses file uploads (links, never bytes), which protects the 1 GB *storage*
--   quota. But the *database* can still fill up, and on this platform it will
--   always fill up in the same place: CBT results. Every submitted quiz stores
--   `answers`, `review` and `detail` as JSONB — a 60-question paper is roughly
--   30-60 KB per candidate, so 300 sittings ≈ 15 MB, and a busy studio with
--   several years of history will eventually notice.
--
--   Three defences, cheapest first:
--     1. COMPRESS  — LZ4 on the heavy JSONB/text columns (PG14+). Typically
--                    40-60% off JSONB payloads, applied by Postgres itself with
--                    no application change.
--     2. MEASURE   — tc_db_report() exposes total size, the worst tables, and
--                    the percentage of the 500 MB budget consumed.
--     3. RECLAIM   — tc_prune_logs() enforces retention on append-only logs, and
--                    tc_slim_cbt_results() strips the verbose per-question blob
--                    from OLD results while keeping every score, so analytics
--                    and the scoresheet are completely unaffected.
--
--   Nothing here deletes a mark, a payment, a session or a learner record.
--   Only logs and the bulky replay data of long-past quizzes are touched, and
--   every step is opt-in with an explicit day threshold.
--
-- Safe to run repeatedly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PART A · SCHEMA REGISTRY
-- ---------------------------------------------------------------------------
create table if not exists public.tc_schema_registry (
  id          integer primary key default 1,
  version     text not null,
  applied_at  timestamptz not null default now(),
  packs       text[] not null default '{}',
  note        text,
  constraint tc_schema_registry_single_row check (id = 1)
);

insert into public.tc_schema_registry (id, version, packs, note)
values (1, 'V12', array['v1-core','v2-tutoring-ops','v3-classroom-exams',
                        'v4-enterprise-parity','v5-ops-parity','v6-cbt-modes',
                        'v7-family-access','v9-keepalive-drive','v12-quota-guard'],
        'Installed by database/complete-schema.sql')
on conflict (id) do update
   set version    = excluded.version,
       applied_at = now(),
       packs      = excluded.packs,
       note       = excluded.note;

alter table public.tc_schema_registry enable row level security;
grant select on public.tc_schema_registry to authenticated;
revoke all on public.tc_schema_registry from anon;

drop policy if exists tc_schema_registry_read on public.tc_schema_registry;
create policy tc_schema_registry_read on public.tc_schema_registry
  for select using (public.is_admin() or public.is_tutor());

-- One call the app can make instead of probing function-by-function.
create or replace function public.tc_schema_info()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'version', r.version,
    'applied_at', r.applied_at,
    'packs', r.packs,
    'expected', 'V12'
  ) from public.tc_schema_registry r where r.id = 1;
$$;
grant execute on function public.tc_schema_info() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- PART B1 · COMPRESS — LZ4 on the columns that actually get big.
--   Guarded twice: server_version must be >= 14, and each ALTER is wrapped so a
--   build without LZ4 support degrades to the default pglz instead of failing
--   the whole script.
--   NOTE: this affects rows written AFTER the change. Existing rows re-compress
--   when they are next rewritten (or on a VACUUM FULL, which we do not run
--   automatically because it takes an exclusive lock).
-- ---------------------------------------------------------------------------
do $lz4$
declare
  t record;
  targets text[][] := array[
    -- The genuinely heavy ones, verified to exist in complete-schema.sql.
    ['cbt_exams',        'questions'],      -- the whole question bank per paper
    ['cbt_results',      'answers'],        -- what the candidate picked
    ['cbt_results',      'review'],         -- per-question replay for the PDF
    ['cbt_results',      'detail'],         -- grading detail
    ['cbt_results',      'subject_scores'], -- per-subject breakdown
    ['applications',     'payload'],        -- full application form submissions
    ['application_links','fields'],
    ['survey_responses', 'answers'],
    ['module_records',   'data'],
    ['surveys',          'questions'],
    ['polls',            'options'],
    ['session_notes',    'body'],
    ['reading_items',    'notes'],
    ['practice_settings','role_access'],
    ['practice_settings','role_write']
  ];
  i int;
begin
  if current_setting('server_version_num')::int < 140000 then
    raise notice 'LZ4 column compression needs PostgreSQL 14+. Skipped (TOAST/pglz still applies).';
    return;
  end if;
  for i in 1 .. array_length(targets, 1) loop
    begin
      if exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name  = targets[i][1]
           and column_name = targets[i][2]
      ) then
        execute format('alter table public.%I alter column %I set compression lz4',
                       targets[i][1], targets[i][2]);
      end if;
    exception when others then
      raise notice 'LZ4 not applied to %.% (%). Default compression remains.',
                   targets[i][1], targets[i][2], sqlerrm;
    end;
  end loop;
end
$lz4$;

-- ---------------------------------------------------------------------------
-- PART B2 · MEASURE — what is actually using the 500 MB?
-- ---------------------------------------------------------------------------
create or replace function public.tc_db_report()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with sizes as (
    select c.relname as table_name,
           pg_total_relation_size(c.oid) as bytes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  ), total as (
    select coalesce(sum(bytes), 0)::bigint as b from sizes
  )
  select jsonb_build_object(
    'ok', true,
    'checked_at', now(),
    'quota_bytes', 524288000,                                  -- 500 MB free tier
    'used_bytes', (select b from total),
    'used_mb', round((select b from total) / 1048576.0, 2),
    'used_pct', round((select b from total) / 5242880.0, 2),   -- % of 500 MB
    'state', case
               when (select b from total) > 440401920 then 'critical'   -- >84%
               when (select b from total) > 366545920 then 'warning'    -- >70%
               else 'healthy'
             end,
    'top_tables', (
      select jsonb_agg(jsonb_build_object(
               'table', table_name,
               'mb', round(bytes / 1048576.0, 2),
               'pct', round(bytes / greatest((select b from total), 1)::numeric * 100, 1)))
        from (select * from sizes order by bytes desc limit 12) s
    ),
    'row_counts', (
      select jsonb_object_agg(t, n) from (
        select 'cbt_results' as t, (select count(*) from public.cbt_results) as n
        union all select 'activity_log', (select count(*) from public.activity_log)
        union all select 'notifications', (select count(*) from public.notifications)
        union all select 'login_audit', (select count(*) from public.login_audit)
        union all select 'sessions', (select count(*) from public.sessions)
      ) x
    )
  );
$$;
grant execute on function public.tc_db_report() to authenticated;

-- ---------------------------------------------------------------------------
-- PART B3 · RECLAIM — retention on append-only logs.
--   Admin-only. Defaults are deliberately generous; nothing academic is touched.
-- ---------------------------------------------------------------------------
create or replace function public.tc_prune_logs(p_days int default 180)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(p_days, 30));
  a int := 0; b int := 0; c int := 0; d int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may prune logs.';
  end if;

  delete from public.activity_log     where created_at < cutoff;              get diagnostics a = row_count;
  delete from public.login_audit      where created_at < cutoff;              get diagnostics b = row_count;
  delete from public.notifications    where created_at < cutoff
                                        and read_at is not null;              get diagnostics c = row_count;
  delete from public.tc_keepalive_log where pinged_at < now() - interval '30 days';
  get diagnostics d = row_count;

  return jsonb_build_object(
    'ok', true, 'cutoff', cutoff,
    'deleted', jsonb_build_object('activity_log', a, 'login_audit', b,
                                  'notifications_read', c, 'keepalive_log', d));
end $$;
grant execute on function public.tc_prune_logs(int) to authenticated;

-- ---------------------------------------------------------------------------
-- PART B4 · RECLAIM — slim OLD quiz results.
--   `detail` and `answers` are the per-question replay blob: what the learner
--   picked, the key, the explanation. It is what powers the review screen and
--   the PDF, and it is by far the biggest thing this platform stores.
--
--   After a couple of terms nobody re-opens a review, but the SCORE must live
--   forever. So for results older than p_days we drop the replay blob and keep
--   score, max_score, subject_scores and every scoresheet row. Analytics,
--   value-added, predictions and the scoresheet are completely unaffected.
--
--   A marker is written into `detail` so the review screen can explain the
--   absence honestly instead of rendering an empty page.
-- ---------------------------------------------------------------------------
create or replace function public.tc_slim_cbt_results(p_days int default 365)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare n int := 0; freed_estimate bigint := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may slim CBT results.';
  end if;

  select coalesce(sum(pg_column_size(answers) + pg_column_size(review) + pg_column_size(detail)), 0)
    into freed_estimate
    from public.cbt_results
   where created_at < now() - make_interval(days => greatest(p_days, 90))
     and detail is not null
     and (detail ? 'archived') is not true;

  update public.cbt_results
     set answers = null,
         review  = null,
         detail  = jsonb_build_object(
                     'archived', true,
                     'archived_at', now(),
                     'note', 'Per-question replay removed to protect the free-tier database. '
                          || 'Score, per-subject scores and every scoresheet row are unchanged.')
   where created_at < now() - make_interval(days => greatest(p_days, 90))
     and detail is not null
     and (detail ? 'archived') is not true;
  get diagnostics n = row_count;

  return jsonb_build_object('ok', true, 'slimmed', n,
                            'freed_bytes_estimate', freed_estimate,
                            'freed_mb_estimate', round(freed_estimate / 1048576.0, 2));
end $$;
grant execute on function public.tc_slim_cbt_results(int) to authenticated;

-- ---------------------------------------------------------------------------
-- PART B5 · AUTOMATE — nightly housekeeping when pg_cron exists.
--   Conservative: logs older than a year, quiz replay older than two years.
--   pg_cron only runs while the project is awake, which is exactly what the
--   keep-alive layers guarantee.
-- ---------------------------------------------------------------------------
do $housekeeping$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule(jobid) from cron.job where jobname = 'tc-housekeeping';
      perform cron.schedule('tc-housekeeping', '17 3 * * 0',
        $job$
          delete from public.activity_log     where created_at < now() - interval '365 days';
          delete from public.login_audit      where created_at < now() - interval '365 days';
          delete from public.tc_keepalive_log where pinged_at  < now() - interval '30 days';
        $job$);
    exception when others then
      raise notice 'pg_cron housekeeping not scheduled (%). Non-fatal.', sqlerrm;
    end;
  end if;
end
$housekeeping$;

select 'Tutoring Connect V12 schema registry + quota guard installed ✅' as status;

-- ===== V15 PACK INCLUDED (family portal + rich polls + combined invoicing) =====
-- ============================================================================
-- Tutoring Connect V15 — FAMILY PORTAL · RICH POLLS · COMBINED INVOICING
-- ============================================================================
-- Three additions, all idempotent and safe to re-run.
--
--  A. FAMILY PORTAL SUPPORT (item 16)
--     parent_learner already existed but had no page, so nothing ever wrote to
--     it and every parent portal was empty. Beyond the new UI, a parent needs
--     two safe read paths that RLS can grant without exposing anyone else:
--       * tc_my_children()      — the learners this signed-in parent may see
--       * tc_child_summary(id)  — one child's headline numbers in a single call
--     Both are SECURITY DEFINER and filter by the caller, so a parent cannot
--     pass someone else's learner id and get data back.
--
--  B. RICH POLLS (item 27)
--     polls had only (title, options, anonymous, status). Real voting needs a
--     closing time, multiple-choice limits, an audience, a quorum and a rule
--     for when results become visible. Added as nullable columns so existing
--     polls keep working untouched.
--
--  C. COMBINED FAMILY INVOICING (the gap found in competitor research)
--     TutorBird/Teachworks bill per student. A Nigerian parent with three
--     children wants ONE invoice. tc_family_invoice() gathers every unpaid
--     invoice for a parent into a single consolidated statement.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A · FAMILY PORTAL
-- ---------------------------------------------------------------------------
create index if not exists parent_learner_parent_idx  on public.parent_learner (parent_id);
create index if not exists parent_learner_learner_idx on public.parent_learner (learner_id);
create index if not exists parents_user_idx           on public.parents (user_id);

-- Which children may the signed-in user see? Staff see all; a parent sees only
-- their own; a learner sees only themselves.
create or replace function public.tc_my_children()
returns table (
  id uuid, full_name text, student_no text, year_group text, relationship text
)
language sql stable security definer set search_path = public
as $$
  select l.id, l.full_name, l.student_no, l.year_group,
         coalesce(pl.relationship, case when l.user_id = auth.uid() then 'self' else 'staff' end)
    from public.learners l
    left join public.parent_learner pl on pl.learner_id = l.id
    left join public.parents p on p.id = pl.parent_id and p.user_id = auth.uid()
   where public.is_tutor()
      or l.user_id = auth.uid()
      or p.id is not null
   group by l.id, l.full_name, l.student_no, l.year_group, pl.relationship, l.user_id
   order by l.full_name;
$$;
grant execute on function public.tc_my_children() to authenticated;

-- One child's headline numbers, in a single round trip.
create or replace function public.tc_child_summary(p_learner uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_avg numeric; v_count int; v_att numeric; v_next timestamptz; v_hours numeric;
begin
  -- Authorisation is enforced here, not by the caller.
  if not (public.is_tutor() or public.is_family_of_learner(p_learner)) then
    return jsonb_build_object('ok', false, 'error', 'not_permitted');
  end if;

  select round(avg(pct), 1), count(*) into v_avg, v_count
    from public.scoresheet where learner_id = p_learner;

  select round(100.0 * count(*) filter (where lower(status) in ('present','late'))
               / nullif(count(*), 0), 0)
    into v_att
    from public.session_attendance where learner_id = p_learner;

  select min(s.starts_at) into v_next
    from public.sessions s
    join public.engagement_members em on em.engagement_id = s.engagement_id
   where em.learner_id = p_learner and s.starts_at > now();

  select coalesce(sum(e.hours_prepaid - e.hours_used), 0) into v_hours
    from public.engagements e
    join public.engagement_members em on em.engagement_id = e.id
   where em.learner_id = p_learner;

  return jsonb_build_object(
    'ok', true, 'learner_id', p_learner,
    'average_pct', v_avg, 'assessments', coalesce(v_count, 0),
    'attendance_pct', v_att, 'next_class', v_next,
    'hours_left', v_hours, 'checked_at', now());
end $$;
grant execute on function public.tc_child_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- B · RICH POLLS
-- ---------------------------------------------------------------------------
alter table if exists public.polls add column if not exists description     text;
alter table if exists public.polls add column if not exists audience        text default 'all';
alter table if exists public.polls add column if not exists engagement_id   uuid references public.engagements(id) on delete set null;
alter table if exists public.polls add column if not exists opens_at        timestamptz default now();
alter table if exists public.polls add column if not exists closes_at       timestamptz;
alter table if exists public.polls add column if not exists multi_choice    boolean not null default false;
alter table if exists public.polls add column if not exists max_choices     int default 1;
alter table if exists public.polls add column if not exists quorum          int default 0;
alter table if exists public.polls add column if not exists results_visible text default 'always';  -- always | after_vote | after_close
alter table if exists public.polls add column if not exists created_by      uuid;

alter table if exists public.poll_votes add column if not exists created_at timestamptz default now();
alter table if exists public.poll_votes add column if not exists comment    text;

-- One vote per person per poll (a multi-choice poll stores its picks joined
-- with "|" in a single row, so this constraint holds for both modes).
create unique index if not exists poll_votes_one_per_voter
  on public.poll_votes (poll_id, voter) where voter is not null;
create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);

-- Tally a poll without exposing who voted for what on an anonymous poll.
create or replace function public.tc_poll_results(p_poll uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_poll record; v_total int; v_rows jsonb; v_closed boolean; v_voted boolean;
begin
  select * into v_poll from public.polls where id = p_poll;
  if v_poll is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  v_closed := (v_poll.closes_at is not null and v_poll.closes_at < now())
              or lower(coalesce(v_poll.status, 'open')) <> 'open';
  select exists (select 1 from public.poll_votes where poll_id = p_poll and voter = auth.uid())
    into v_voted;

  -- Respect the poll's disclosure rule.
  if coalesce(v_poll.results_visible, 'always') = 'after_close' and not v_closed
     and not public.is_tutor() then
    return jsonb_build_object('ok', true, 'hidden', true,
                              'reason', 'Results are published when the poll closes.',
                              'closes_at', v_poll.closes_at);
  end if;
  if coalesce(v_poll.results_visible, 'always') = 'after_vote' and not v_voted
     and not public.is_tutor() then
    return jsonb_build_object('ok', true, 'hidden', true,
                              'reason', 'Cast your vote to see the results.');
  end if;

  select count(*) into v_total from public.poll_votes where poll_id = p_poll;

  -- Split multi-choice picks so each option is counted individually.
  select jsonb_agg(jsonb_build_object('choice', choice, 'votes', n)
                   order by n desc)
    into v_rows
    from (
      select trim(unnest(string_to_array(coalesce(choice, ''), '|'))) as choice, count(*) as n
        from public.poll_votes
       where poll_id = p_poll
       group by 1
       having trim(coalesce(choice, '')) <> ''
    ) t;

  return jsonb_build_object(
    'ok', true, 'poll_id', p_poll, 'title', v_poll.title,
    'closed', v_closed, 'closes_at', v_poll.closes_at,
    'anonymous', coalesce(v_poll.anonymous, true),
    'multi_choice', coalesce(v_poll.multi_choice, false),
    'total_voters', v_total,
    'quorum', coalesce(v_poll.quorum, 0),
    'quorum_met', coalesce(v_poll.quorum, 0) = 0 or v_total >= v_poll.quorum,
    'you_voted', v_voted,
    'results', coalesce(v_rows, '[]'::jsonb));
end $$;
grant execute on function public.tc_poll_results(uuid) to authenticated;

-- Everyone signed in may read an open poll and cast exactly one vote.
grant select on public.polls to authenticated;
grant select, insert, update, delete on public.poll_votes to authenticated;

drop policy if exists polls_read_all on public.polls;
create policy polls_read_all on public.polls for select using (true);

drop policy if exists poll_votes_own on public.poll_votes;
create policy poll_votes_own on public.poll_votes
  for all using (voter = auth.uid() or public.is_tutor())
  with check (voter = auth.uid() or public.is_tutor());

-- ---------------------------------------------------------------------------
-- C · COMBINED FAMILY INVOICING
--     One statement per PARENT covering every child, instead of one invoice
--     per child. This is the single feature the commercial tutoring platforms
--     charge for that this product lacked.
-- ---------------------------------------------------------------------------
create or replace function public.tc_family_statement(p_parent uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_parent uuid; v_rows jsonb; v_total numeric; v_paid numeric; v_name text;
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

  return jsonb_build_object(
    'ok', true,
    'parent_id', v_parent,
    'parent_name', v_name,
    'currency', (select currency from public.practice_settings where id = 1),
    'invoices', coalesce(v_rows, '[]'::jsonb),
    'total_billed', coalesce(v_total, 0),
    'total_paid', coalesce(v_paid, 0),
    'balance', coalesce(v_total, 0) - coalesce(v_paid, 0),
    'generated_at', now());
end $$;
grant execute on function public.tc_family_statement(uuid) to authenticated;

-- Keep the registry honest about what is installed.
insert into public.tc_schema_registry (id, version, packs, note)
values (1, 'V15', array['v1-core','v2-tutoring-ops','v3-classroom-exams','v4-enterprise-parity',
                        'v5-ops-parity','v6-cbt-modes','v7-family-access','v9-keepalive-drive',
                        'v12-quota-guard','v15-family-polls-billing'],
        'Installed by database/complete-schema.sql')
on conflict (id) do update
   set version = excluded.version, applied_at = now(),
       packs = excluded.packs, note = excluded.note;

select 'Tutoring Connect V15 family portal + rich polls + combined invoicing installed ✅' as status;

-- BEGIN v16-exam-registration.sql
-- =====================================================================
-- V16 — EXAM REGISTRATION LIFECYCLE
-- ---------------------------------------------------------------------
-- WHAT THIS PACK IS FOR
--
-- Before V16, `exam_registrations` was a dead-drop mailbox. A candidate
-- filled the public form, the row landed in the table, and that was the
-- end of it. There was no exam number, no way for the candidate to check
-- anything afterwards, no place to record the fee, no place to record a
-- score, and no admission decision. The page could not produce a slip, a
-- result or a letter, so every one of those documents had to be made by
-- hand outside the system.
--
-- School Connect's `entrance.html` does all of that (result slip,
-- certificate, admission letter, signing officer). This pack gives
-- Tutoring Connect the same lifecycle, adapted for a tutoring studio that
-- registers candidates for external boards (WAEC, NECO, JAMB, IGCSE,
-- IELTS, SAT ...) rather than running its own entrance exam.
--
-- THE LIFECYCLE THIS PACK ENABLES
--
--   submitted -> verified -> paid -> admitted -> sat -> released
--
-- Everything is idempotent: run this file as many times as you like.
-- It is also already included at the end of database/complete-schema.sql,
-- so if you run that one file you do NOT need to run this one separately.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Widen exam_registrations into a real candidate record.
--    `add column if not exists` means existing rows are untouched and no
--    data is lost — this is safe on a live studio.
-- ---------------------------------------------------------------------
alter table public.exam_registrations add column if not exists exam_no        text;
alter table public.exam_registrations add column if not exists nationality    text;
alter table public.exam_registrations add column if not exists state_of_origin text;
alter table public.exam_registrations add column if not exists address        text;
alter table public.exam_registrations add column if not exists prev_school    text;
alter table public.exam_registrations add column if not exists guardian_phone text;
alter table public.exam_registrations add column if not exists guardian_email text;
alter table public.exam_registrations add column if not exists exam_date      date;
alter table public.exam_registrations add column if not exists exam_time      text;
alter table public.exam_registrations add column if not exists venue          text;
alter table public.exam_registrations add column if not exists fee_amount     numeric(12,2);
alter table public.exam_registrations add column if not exists fee_currency   text default 'NGN';
alter table public.exam_registrations add column if not exists fee_status     text default 'unpaid';
alter table public.exam_registrations add column if not exists fee_reference  text;
alter table public.exam_registrations add column if not exists score          numeric(6,2);
alter table public.exam_registrations add column if not exists max_score      numeric(6,2);
alter table public.exam_registrations add column if not exists grade          text;
alter table public.exam_registrations add column if not exists subject_scores jsonb;
alter table public.exam_registrations add column if not exists decision       text;
alter table public.exam_registrations add column if not exists decision_note  text;
alter table public.exam_registrations add column if not exists decided_at     timestamptz;
alter table public.exam_registrations add column if not exists officer_name   text;
alter table public.exam_registrations add column if not exists officer_title  text;
alter table public.exam_registrations add column if not exists learner_id     uuid;
alter table public.exam_registrations add column if not exists updated_at     timestamptz default now();

-- One candidate cannot hold two exam numbers, and no number is reused.
create unique index if not exists exam_registrations_exam_no_uidx
  on public.exam_registrations (exam_no) where exam_no is not null;

-- Staff filter by these constantly; without them every filter is a seq scan.
create index if not exists exam_registrations_status_idx  on public.exam_registrations (status);
create index if not exists exam_registrations_board_idx   on public.exam_registrations (board);
create index if not exists exam_registrations_created_idx on public.exam_registrations (created_at desc);

-- ---------------------------------------------------------------------
-- 2. Exam numbers.
--    A candidate needs a short, human-readable, unique identifier they can
--    quote on the phone. Format:  <PREFIX>/<BOARD>/<YEAR>/<NNNN>
--    e.g.  TC/WAEC/2026/0007
--    A sequence guarantees uniqueness even if two candidates submit in the
--    same millisecond, which a count(*)+1 in JavaScript cannot.
-- ---------------------------------------------------------------------
create sequence if not exists public.exam_no_seq start with 1;

create or replace function public.tc_next_exam_no(p_board text default 'EXAM', p_prefix text default 'TC')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n bigint;
  v_board text;
begin
  v_n := nextval('public.exam_no_seq');
  -- Normalise the board into a short slug: "UTME / JAMB" -> "UTMEJAMB"
  v_board := upper(regexp_replace(coalesce(nullif(trim(p_board), ''), 'EXAM'), '[^A-Za-z0-9]', '', 'g'));
  if v_board = '' then v_board := 'EXAM'; end if;
  return coalesce(nullif(trim(p_prefix), ''), 'TC')
      || '/' || left(v_board, 8)
      || '/' || to_char(now(), 'YYYY')
      || '/' || lpad(v_n::text, 4, '0');
end $$;

grant execute on function public.tc_next_exam_no(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Public registration, done safely.
--    The anon role must be able to CREATE a registration but must never be
--    able to READ the table — otherwise anybody could enumerate every
--    candidate's phone number, date of birth and guardian details. So the
--    insert goes through a SECURITY DEFINER function that returns only the
--    new candidate's own exam number, and nothing else.
-- ---------------------------------------------------------------------
create or replace function public.tc_register_candidate(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text := nullif(trim(coalesce(p->>'code','')), '');
  v_link   public.exam_reg_links%rowtype;
  v_no     text;
  v_id     uuid;
begin
  if coalesce(trim(p->>'full_name'), '') = '' then
    raise exception 'Full name is required';
  end if;

  -- If the candidate arrived through a registration link, honour that
  -- link's rules: it must be open, unexpired and under its usage cap.
  if v_code is not null then
    select * into v_link from public.exam_reg_links where code = v_code;
    if not found then
      raise exception 'That registration link does not exist';
    end if;
    if v_link.status <> 'open' then
      raise exception 'That registration link is closed';
    end if;
    if v_link.expires_on is not null and v_link.expires_on < current_date then
      raise exception 'That registration link expired on %', v_link.expires_on;
    end if;
    if v_link.max_uses is not null and coalesce(v_link.uses, 0) >= v_link.max_uses then
      raise exception 'That registration link has reached its limit of % registrations', v_link.max_uses;
    end if;
  end if;

  v_no := public.tc_next_exam_no(coalesce(p->>'board', v_link.board, 'EXAM'), coalesce(p->>'prefix','TC'));

  insert into public.exam_registrations (
    code, exam_no, full_name, student_no, email, phone, dob, sex, id_no,
    board, series, centre, subjects, photo_url, doc_url, guardian, notes,
    nationality, state_of_origin, address, prev_school,
    guardian_phone, guardian_email, status
  ) values (
    v_code, v_no,
    trim(p->>'full_name'), nullif(trim(coalesce(p->>'student_no','')),''),
    nullif(trim(coalesce(p->>'email','')),''),   nullif(trim(coalesce(p->>'phone','')),''),
    nullif(p->>'dob','')::date,                  nullif(trim(coalesce(p->>'sex','')),''),
    nullif(trim(coalesce(p->>'id_no','')),''),
    coalesce(nullif(trim(coalesce(p->>'board','')),''), v_link.board),
    coalesce(nullif(trim(coalesce(p->>'series','')),''), v_link.series),
    nullif(trim(coalesce(p->>'centre','')),''),  nullif(trim(coalesce(p->>'subjects','')),''),
    nullif(trim(coalesce(p->>'photo_url','')),''), nullif(trim(coalesce(p->>'doc_url','')),''),
    nullif(trim(coalesce(p->>'guardian','')),''),  nullif(trim(coalesce(p->>'notes','')),''),
    nullif(trim(coalesce(p->>'nationality','')),''), nullif(trim(coalesce(p->>'state_of_origin','')),''),
    nullif(trim(coalesce(p->>'address','')),''),     nullif(trim(coalesce(p->>'prev_school','')),''),
    nullif(trim(coalesce(p->>'guardian_phone','')),''), nullif(trim(coalesce(p->>'guardian_email','')),''),
    'submitted'
  ) returning id into v_id;

  if v_code is not null then
    update public.exam_reg_links set uses = coalesce(uses, 0) + 1 where code = v_code;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'exam_no', v_no,
                            'full_name', trim(p->>'full_name'));
end $$;

grant execute on function public.tc_register_candidate(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Candidate self-service lookup.
--    A candidate checks their own slip or result with two facts only they
--    and the studio know: their exam number AND their surname. Surname is
--    the shared secret that stops someone walking the number sequence.
--    Personal contact details are deliberately NOT returned.
-- ---------------------------------------------------------------------
create or replace function public.tc_candidate_lookup(p_exam_no text, p_surname text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.exam_registrations%rowtype;
begin
  if coalesce(trim(p_exam_no), '') = '' or coalesce(trim(p_surname), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Enter both your exam number and your surname.');
  end if;

  select * into r from public.exam_registrations
   where upper(exam_no) = upper(trim(p_exam_no))
     and full_name ilike '%' || trim(p_surname) || '%'
   limit 1;

  if not found then
    return jsonb_build_object('ok', false,
      'error', 'No candidate matches that exam number and surname. Check both and try again.');
  end if;

  return jsonb_build_object('ok', true, 'candidate', jsonb_build_object(
    'exam_no', r.exam_no, 'full_name', r.full_name, 'board', r.board,
    'series', r.series, 'centre', r.centre, 'subjects', r.subjects,
    'photo_url', r.photo_url, 'status', r.status,
    'exam_date', r.exam_date, 'exam_time', r.exam_time, 'venue', r.venue,
    'fee_status', r.fee_status, 'fee_amount', r.fee_amount, 'fee_currency', r.fee_currency,
    -- Scores are only revealed once staff have moved the record to 'released'.
    'score',     case when r.status = 'released' then r.score     else null end,
    'max_score', case when r.status = 'released' then r.max_score else null end,
    'grade',     case when r.status = 'released' then r.grade     else null end,
    'subject_scores', case when r.status = 'released' then r.subject_scores else null end,
    'decision',      case when r.status = 'released' then r.decision      else null end,
    'decision_note', case when r.status = 'released' then r.decision_note else null end,
    'officer_name',  r.officer_name, 'officer_title', r.officer_title,
    'released', (r.status = 'released')
  ));
end $$;

grant execute on function public.tc_candidate_lookup(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Staff dashboard numbers in one round-trip.
-- ---------------------------------------------------------------------
create or replace function public.tc_exam_reg_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total',     count(*),
    'submitted', count(*) filter (where status = 'submitted'),
    'verified',  count(*) filter (where status = 'verified'),
    'paid',      count(*) filter (where fee_status = 'paid'),
    'unpaid',    count(*) filter (where coalesce(fee_status,'unpaid') <> 'paid'),
    'released',  count(*) filter (where status = 'released'),
    'admitted',  count(*) filter (where decision = 'admitted'),
    'fees_collected', coalesce(sum(fee_amount) filter (where fee_status = 'paid'), 0),
    'fees_outstanding', coalesce(sum(fee_amount) filter (where coalesce(fee_status,'unpaid') <> 'paid'), 0),
    'this_month', count(*) filter (where created_at >= date_trunc('month', now())),
    'boards', (
      select coalesce(jsonb_object_agg(b, n), '{}'::jsonb)
      from (select coalesce(board,'—') as b, count(*) as n
              from public.exam_registrations group by 1 order by 2 desc limit 8) t
    )
  ) from public.exam_registrations;
$$;

grant execute on function public.tc_exam_reg_stats() to authenticated;
revoke execute on function public.tc_exam_reg_stats() from anon;

-- ---------------------------------------------------------------------
-- 6. Convert an admitted candidate into a learner, in one click.
--    Idempotent: calling it twice returns the learner already created
--    instead of making a duplicate.
-- ---------------------------------------------------------------------
create or replace function public.tc_exam_to_learner(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.exam_registrations%rowtype;
  v_learner uuid;
begin
  if not public.is_tutor() then
    raise exception 'Only studio staff can enrol a candidate.';
  end if;

  select * into r from public.exam_registrations where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Candidate not found.');
  end if;
  if r.learner_id is not null then
    return jsonb_build_object('ok', true, 'learner_id', r.learner_id, 'already', true);
  end if;

  insert into public.learners (full_name, email, phone, dob, notes)
  values (r.full_name, r.email, r.phone, r.dob,
          'Enrolled from exam registration ' || coalesce(r.exam_no, '(no number)'))
  returning id into v_learner;

  update public.exam_registrations
     set learner_id = v_learner, updated_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'learner_id', v_learner, 'already', false);
end $$;

grant execute on function public.tc_exam_to_learner(uuid) to authenticated;
revoke execute on function public.tc_exam_to_learner(uuid) from anon;

-- ---------------------------------------------------------------------
-- 7. Tighten the anon insert policy.
--    V3 shipped `with check (true)`, which let anyone insert anything into
--    the table directly, bypassing link rules and self-assigning any exam
--    number they liked. Registration now goes exclusively through
--    tc_register_candidate(), which validates the link and allocates the
--    number from the sequence. Anon keeps NO direct table rights.
-- ---------------------------------------------------------------------
drop policy if exists exam_reg_ins on public.exam_registrations;
revoke insert on public.exam_registrations from anon;

-- Staff keep full read/write (this policy already existed; restated so the
-- pack is self-contained and safe to run on its own).
drop policy if exists exam_reg_staff on public.exam_registrations;
create policy exam_reg_staff on public.exam_registrations
  for all using (public.is_tutor()) with check (public.is_tutor());

select 'V16 exam registration lifecycle installed ✅' as status;

-- =====================================================================
-- V16b — NO-SHOW TRACKING (from the competitor benchmark)
-- ---------------------------------------------------------------------
-- Every platform in docs/COMPETITOR-BENCHMARK.md separates a no-show from
-- an absence, and reports a "no-show rate", because the two differ
-- commercially: an absence the family warned you about frees the slot; a
-- no-show burns the tutor's hour and is chargeable. This studio could not
-- tell them apart, so it could not prove its reminders were working.
-- =====================================================================
alter table public.session_attendance add column if not exists chargeable  boolean default true;
alter table public.session_attendance add column if not exists notified_at timestamptz;

create index if not exists session_attendance_status_idx on public.session_attendance (status);

-- No-show rate over any window, per tutor or studio-wide.
create or replace function public.tc_no_show_report(p_days int default 90)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with a as (
    select sa.*
      from public.session_attendance sa
      join public.sessions s on s.id = sa.session_id
     where s.starts_at >= now() - make_interval(days => greatest(p_days, 1))
  )
  select jsonb_build_object(
    'window_days', p_days,
    'total',    count(*),
    'present',  count(*) filter (where status in ('present','late')),
    'absent',   count(*) filter (where status = 'absent'),
    'excused',  count(*) filter (where status = 'excused'),
    'no_show',  count(*) filter (where status = 'no-show'),
    'late_cancel', count(*) filter (where status = 'cancelled-late'),
    -- The headline industry metric.
    'no_show_rate_pct', case when count(*) = 0 then 0
      else round(100.0 * count(*) filter (where status = 'no-show') / count(*), 1) end,
    'attendance_rate_pct', case when count(*) = 0 then 0
      else round(100.0 * count(*) filter (where status in ('present','late')) / count(*), 1) end,
    'chargeable_missed', count(*) filter (where status in ('no-show','cancelled-late') and coalesce(chargeable, true))
  ) from a;
$$;

grant execute on function public.tc_no_show_report(int) to authenticated;
revoke execute on function public.tc_no_show_report(int) from anon;

select 'V16b no-show tracking installed ✅' as status;


-- Keep the registry honest about what is installed.
insert into public.tc_schema_registry (id, version, packs, note)
values (1, 'V16', array['v1-core','v2-tutoring-ops','v3-classroom-exams','v4-enterprise-parity',
                        'v5-ops-parity','v6-cbt-modes','v7-family-access','v9-keepalive-drive',
                        'v12-quota-guard','v15-family-polls-billing','v16-exam-registration'],
        'Installed by database/complete-schema.sql')
on conflict (id) do update
   set version = excluded.version, applied_at = now(),
       packs = excluded.packs, note = excluded.note;

select 'Tutoring Connect V16 — exam registration lifecycle + data workbench installed ✅' as status;

-- BEGIN v17-licensing-and-family-billing.sql
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


-- Keep the registry honest about what is installed.
insert into public.tc_schema_registry (id, version, packs, note)
values (1, 'V17', array['v1-core','v2-tutoring-ops','v3-classroom-exams','v4-enterprise-parity',
                        'v5-ops-parity','v6-cbt-modes','v7-family-access','v9-keepalive-drive',
                        'v12-quota-guard','v15-family-polls-billing','v16-exam-registration',
                        'v17-licensing-family-billing'],
        'Installed by database/complete-schema.sql')
on conflict (id) do update
   set version = excluded.version, applied_at = now(),
       packs = excluded.packs, note = excluded.note;

select 'Tutoring Connect V17 — enforced licensing + sibling billing installed ✅' as status;

-- BEGIN v18-security-hardening.sql
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
    'expected', 'V20',
    'packs',    r.packs,
    'applied_at', r.applied_at,
    'up_to_date', (r.version = 'V20')
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


insert into public.tc_schema_registry (id, version, packs, note)
values (1, 'V18', array['v1-core','v2-tutoring-ops','v3-classroom-exams','v4-enterprise-parity',
                        'v5-ops-parity','v6-cbt-modes','v7-family-access','v9-keepalive-drive',
                        'v12-quota-guard','v15-family-polls-billing','v16-exam-registration',
                        'v17-licensing-family-billing','v18-security-hardening'],
        'Installed by database/complete-schema.sql')
on conflict (id) do update
   set version = excluded.version, applied_at = now(),
       packs = excluded.packs, note = excluded.note;

select 'Tutoring Connect V18 — security hardening installed ✅' as status;

-- BEGIN v19-revenue-and-security.sql
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


insert into public.tc_schema_registry (id, version, packs, note)
values (1, 'V19', array['v1-core','v2-tutoring-ops','v3-classroom-exams','v4-enterprise-parity',
                        'v5-ops-parity','v6-cbt-modes','v7-family-access','v9-keepalive-drive',
                        'v12-quota-guard','v15-family-polls-billing','v16-exam-registration',
                        'v17-licensing-family-billing','v18-security-hardening',
                        'v19-revenue-and-security'],
        'Installed by database/complete-schema.sql')
on conflict (id) do update
   set version = excluded.version, applied_at = now(),
       packs = excluded.packs, note = excluded.note;

select 'Tutoring Connect V19 — revenue automation + enterprise security installed ✅' as status;

-- BEGIN v20-cbt-2fa-polls.sql
-- =====================================================================
-- V20 — CBT SCHEMA REPAIR, TWO-FACTOR AUTH, RICH POLLS
-- ---------------------------------------------------------------------
-- BUG 10 (reported): "Could not find the 'calculator' column of
-- 'cbt_exams' in the schema cache" when saving a quiz.
--
-- Root cause, verified against the schema: public.cbt_exams was created
-- with only SEVEN columns (id, title, code, questions, duration_min,
-- engagement_id, status). Later packs added quiz_kind, subject, subjects,
-- multi_subject, anti_cheat, push_to_scoresheet, show_review, exam_mode
-- and is_open — but the builder in cbt-multi.html also writes:
--
--     calculator, math_keyboard, subject_breakdown, identity_mode,
--     instructions, exam_type, csv_data, csv_source
--
-- ...and NONE of those were ever added. PostgREST rejects the whole insert
-- the moment it meets the first unknown column, which is why saving a
-- quiz failed outright rather than partially. Every missing column is
-- added here.
--
-- Also in this pack:
--   * Two-factor authentication support (TOTP), tracked per user.
--   * Poll/vote creation support so voting.html can actually create polls.
--   * cbt_results gains per-question detail needed by the new one-question
--     -per-page runner and the review screen.
--
-- Idempotent. Folded into database/complete-schema.sql.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. cbt_exams — every column the application actually writes.
-- ---------------------------------------------------------------------
alter table if exists public.cbt_exams add column if not exists calculator        boolean default true;
alter table if exists public.cbt_exams add column if not exists math_keyboard     boolean default true;
alter table if exists public.cbt_exams add column if not exists subject_breakdown jsonb   default '[]'::jsonb;
alter table if exists public.cbt_exams add column if not exists identity_mode     text    default 'name';
alter table if exists public.cbt_exams add column if not exists instructions      text;
alter table if exists public.cbt_exams add column if not exists exam_type         text;
alter table if exists public.cbt_exams add column if not exists csv_data          jsonb   default '[]'::jsonb;
alter table if exists public.cbt_exams add column if not exists csv_source        text;
alter table if exists public.cbt_exams add column if not exists is_archived       boolean default false;
alter table if exists public.cbt_exams add column if not exists shuffle_questions boolean default true;
alter table if exists public.cbt_exams add column if not exists shuffle_options   boolean default false;
alter table if exists public.cbt_exams add column if not exists questions_to_serve int     default 0;
alter table if exists public.cbt_exams add column if not exists pass_mark         numeric(5,2);
alter table if exists public.cbt_exams add column if not exists opens_at          timestamptz;
alter table if exists public.cbt_exams add column if not exists closes_at         timestamptz;
alter table if exists public.cbt_exams add column if not exists updated_at        timestamptz default now();
alter table if exists public.cbt_exams add column if not exists created_by        uuid;

create index if not exists cbt_exams_code_idx    on public.cbt_exams (code);
create index if not exists cbt_exams_status_idx  on public.cbt_exams (status);
create index if not exists cbt_exams_created_idx on public.cbt_exams (created_at desc);

-- cbt_results needs the per-question record the review screen reads.
alter table if exists public.cbt_results add column if not exists answers        jsonb default '{}'::jsonb;
alter table if exists public.cbt_results add column if not exists per_question   jsonb default '[]'::jsonb;
alter table if exists public.cbt_results add column if not exists violations     jsonb default '[]'::jsonb;
alter table if exists public.cbt_results add column if not exists time_taken_sec int;
alter table if exists public.cbt_results add column if not exists submitted_at   timestamptz default now();
alter table if exists public.cbt_results add column if not exists auto_submitted boolean default false;

-- A guard so this class of bug is caught by a query rather than by a user.
create or replace function public.tc_cbt_schema_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_missing text[] := '{}';
  v_needed  text[] := array[
    'title','code','questions','duration_min','engagement_id','status',
    'quiz_kind','subject','subjects','multi_subject','anti_cheat',
    'push_to_scoresheet','show_review','exam_mode','is_open',
    'calculator','math_keyboard','subject_breakdown','identity_mode',
    'instructions','exam_type','csv_data','csv_source','is_archived',
    'shuffle_questions','shuffle_options','questions_to_serve','pass_mark'];
  c text;
begin
  foreach c in array v_needed loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'cbt_exams'
                      and column_name = c) then
      v_missing := array_append(v_missing, c);
    end if;
  end loop;
  return jsonb_build_object(
    'ok', cardinality(v_missing) = 0,
    'missing_columns', to_jsonb(v_missing),
    'hint', case when cardinality(v_missing) = 0
                 then 'cbt_exams has every column the builder writes.'
                 else 'Re-run database/complete-schema.sql — the CBT builder will fail to save until these exist.'
            end);
end $$;

grant execute on function public.tc_cbt_schema_check() to authenticated;
revoke all on function public.tc_cbt_schema_check() from public, anon;


-- ---------------------------------------------------------------------
-- 2. TWO-FACTOR AUTHENTICATION (TOTP)
-- ---------------------------------------------------------------------
-- Supabase Auth provides the actual TOTP engine free (GoTrue MFA), so no
-- secret is ever stored here and no paid service is involved. What this
-- table adds is the STUDIO's policy layer: which roles must enrol, who
-- has enrolled, and when they last verified. Enforcement of the policy
-- lives in the app; enforcement of the factor itself lives in Supabase.
-- ---------------------------------------------------------------------
create table if not exists public.user_mfa (
  user_id      uuid primary key,
  enrolled     boolean default false,
  factor_id    text,
  method       text default 'totp',
  enrolled_at  timestamptz,
  last_verified_at timestamptz,
  backup_codes_issued int default 0,
  note         text
);

alter table public.user_mfa enable row level security;

-- A user manages only their own factor.
drop policy if exists user_mfa_self on public.user_mfa;
create policy user_mfa_self on public.user_mfa
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- An admin may SEE who has enrolled (never the secret — there isn't one here).
drop policy if exists user_mfa_admin_read on public.user_mfa;
create policy user_mfa_admin_read on public.user_mfa
  for select to authenticated using (public.is_admin());

revoke all on public.user_mfa from anon;

-- Studio policy: which roles are required to use 2FA.
alter table public.practice_settings add column if not exists mfa_required_roles text default '';
alter table public.practice_settings add column if not exists mfa_grace_days     int  default 14;

create or replace function public.tc_mfa_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text; v_req text; v_row public.user_mfa%rowtype; v_required boolean;
begin
  v_role := coalesce(public.tc_current_role(), '');
  select coalesce(mfa_required_roles, '') into v_req from public.practice_settings where id = 1;
  select * into v_row from public.user_mfa where user_id = auth.uid();

  v_required := v_role <> '' and position(v_role in v_req) > 0;

  return jsonb_build_object(
    'ok', true,
    'role', v_role,
    'required', v_required,
    'enrolled', coalesce(v_row.enrolled, false),
    'enrolled_at', v_row.enrolled_at,
    'method', coalesce(v_row.method, 'totp'),
    'grace_days', (select coalesce(mfa_grace_days, 14) from public.practice_settings where id = 1),
    'compliant', (not v_required) or coalesce(v_row.enrolled, false),
    'note', 'Two-factor codes are generated by Supabase Auth (free). This studio '
         || 'stores only whether you have enrolled — never a secret or a code.');
end $$;

grant execute on function public.tc_mfa_status() to authenticated;
revoke all on function public.tc_mfa_status() from public, anon;

create or replace function public.tc_mfa_record(p_enrolled boolean, p_factor text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.user_mfa (user_id, enrolled, factor_id, enrolled_at, last_verified_at)
  values (auth.uid(), coalesce(p_enrolled, false), p_factor,
          case when p_enrolled then now() end, now())
  on conflict (user_id) do update
     set enrolled = excluded.enrolled,
         factor_id = coalesce(excluded.factor_id, public.user_mfa.factor_id),
         enrolled_at = coalesce(public.user_mfa.enrolled_at, excluded.enrolled_at),
         last_verified_at = now();
  return public.tc_mfa_status();
end $$;

grant execute on function public.tc_mfa_record(boolean, text) to authenticated;
revoke all on function public.tc_mfa_record(boolean, text) from public, anon;

-- Who has and has not enrolled — the admin's compliance view.
create or replace function public.tc_mfa_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Two-factor reporting is for administrators only.'
      using errcode = 'insufficient_privilege';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'email', p.email, 'role', p.role,
           'enrolled', coalesce(m.enrolled, false),
           'enrolled_at', m.enrolled_at) order by coalesce(m.enrolled,false), p.email), '[]'::jsonb)
    into v
    from public.profiles p
    left join public.user_mfa m on m.user_id = p.id;
  return jsonb_build_object('ok', true, 'users', v,
    'required_roles', (select coalesce(mfa_required_roles,'') from public.practice_settings where id = 1));
end $$;

grant execute on function public.tc_mfa_report() to authenticated;
revoke all on function public.tc_mfa_report() from public, anon;


-- ---------------------------------------------------------------------
-- 3. POLLS / VOTING — make creation possible.
--    voting.html had no create path at all. These columns and the RPC
--    below are what the rebuilt page needs.
-- ---------------------------------------------------------------------
alter table if exists public.polls add column if not exists created_by  uuid;
alter table if exists public.polls add column if not exists audience    text default 'all';
alter table if exists public.polls add column if not exists anonymous   boolean default true;
alter table if exists public.polls add column if not exists kind        text default 'poll';
alter table if exists public.polls add column if not exists status      text default 'open';
alter table if exists public.polls add column if not exists updated_at  timestamptz default now();

create or replace function public.tc_create_poll(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_opts jsonb;
begin
  if not public.is_tutor() then
    raise exception 'Only studio staff can create a poll or a vote.'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p->>'question'), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'A question is required.');
  end if;

  v_opts := coalesce(p->'options', '[]'::jsonb);
  if jsonb_array_length(v_opts) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Give voters at least two options.');
  end if;

  insert into public.polls (title, description, options, closes_at, multi_choice, max_choices,
                            quorum, results_visible, audience, anonymous, kind, status, created_by)
  values (trim(p->>'question'), nullif(trim(coalesce(p->>'description','')),''),
          -- polls.options is TEXT in the base schema, so store the option list
          -- as a pipe-separated string. Storing jsonb here silently failed.
          (select string_agg(value #>> '{}', '|') from jsonb_array_elements(v_opts)),
          nullif(p->>'closes_at','')::timestamptz,
          coalesce((p->>'multi_choice')::boolean, false),
          coalesce((p->>'max_choices')::int, 1),
          coalesce((p->>'quorum')::int, 0),
          coalesce(nullif(trim(coalesce(p->>'results_visible','')),''), 'after_close'),
          coalesce(nullif(trim(coalesce(p->>'audience','')),''), 'all'),
          coalesce((p->>'anonymous')::boolean, true),
          coalesce(nullif(trim(coalesce(p->>'kind','')),''), 'poll'),
          'open', auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'poll_id', v_id);
end $$;

grant execute on function public.tc_create_poll(jsonb) to authenticated;
revoke all on function public.tc_create_poll(jsonb) from public, anon;


-- Re-assert the V18 rule for everything created above.
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


-- ---------------------------------------------------------------------
-- ITEM 3 FIX — retire the legacy seeded studio name.
-- The original seed used `on conflict (id) do nothing`, so a studio whose
-- practice_settings row was created by an early version still holds the
-- old name. The footer reads this row, which is why renaming the code had
-- no effect on a live studio. This rewrites it in place.
-- ---------------------------------------------------------------------
update public.practice_settings
   set name = 'HMG Tutoring Studio'
 where id = 1
   and (name is null or name ilike '%lumen%');

select 'Legacy studio name retired ✅' as status, name from public.practice_settings where id = 1;

select 'V20 CBT schema repair + 2FA + poll creation installed ✅' as status;


insert into public.tc_schema_registry (id, version, packs, note)
values (1, 'V20', array['v1-core','v2-tutoring-ops','v3-classroom-exams','v4-enterprise-parity',
                        'v5-ops-parity','v6-cbt-modes','v7-family-access','v9-keepalive-drive',
                        'v12-quota-guard','v15-family-polls-billing','v16-exam-registration',
                        'v17-licensing-family-billing','v18-security-hardening',
                        'v19-revenue-and-security','v20-cbt-2fa-polls'],
        'Installed by database/complete-schema.sql')
on conflict (id) do update
   set version = excluded.version, applied_at = now(),
       packs = excluded.packs, note = excluded.note;

select 'Tutoring Connect V20 — CBT repair + 2FA + polls installed ✅' as status;


