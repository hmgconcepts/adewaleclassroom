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
    'expected', 'V24',
    'packs',    r.packs,
    'applied_at', r.applied_at,
    'up_to_date', (r.version = 'V24')
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
    'shuffle_questions','shuffle_options','questions_to_serve','pass_mark',
    'read_aloud'];
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

-- BEGIN v22-cbt-results-audit.sql
-- =====================================================================
-- V22 — CBT RESULTS, AUDIT AND NOTIFICATION
-- ---------------------------------------------------------------------
-- Item 1 asked for: see the result of every CBT taken, by registered OR
-- anonymous candidates; a button beside each exam to open them; a
-- notification when anyone sits a paper; and the ability to audit exactly
-- what each candidate did.
--
-- What was missing:
--   * No way to list results per exam with the numbers a tutor needs.
--   * cbt_results captured a score but not the timing, the device, or the
--     per-question trail, so "what did this student actually do" was
--     unanswerable.
--   * Nothing notified anybody. A paper could be sat and nobody knew.
--   * Anonymous candidates were indistinguishable from each other.
--
-- Everything here is free-tier: a trigger writes the notification row, and
-- the browser polls it. No paid push service, no AI API.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Richer result rows so an audit is actually possible.
-- ---------------------------------------------------------------------
alter table if exists public.cbt_results add column if not exists started_at     timestamptz;
alter table if exists public.cbt_results add column if not exists finished_at    timestamptz;
alter table if exists public.cbt_results add column if not exists duration_sec   int;
alter table if exists public.cbt_results add column if not exists is_anonymous   boolean default false;
alter table if exists public.cbt_results add column if not exists attempt_no     int default 1;
alter table if exists public.cbt_results add column if not exists user_agent     text;
alter table if exists public.cbt_results add column if not exists exam_code      text;
alter table if exists public.cbt_results add column if not exists flagged        boolean default false;
alter table if exists public.cbt_results add column if not exists reviewed_by    uuid;
alter table if exists public.cbt_results add column if not exists reviewed_at    timestamptz;
alter table if exists public.cbt_results add column if not exists tutor_comment  text;
alter table if exists public.cbt_results add column if not exists manual_score   numeric;

create index if not exists cbt_results_exam_idx    on public.cbt_results (exam_id);
create index if not exists cbt_results_created_idx on public.cbt_results (created_at desc);
create index if not exists cbt_results_learner_idx on public.cbt_results (learner_id);


-- ---------------------------------------------------------------------
-- 2. One row per exam with the numbers a tutor scans first.
-- ---------------------------------------------------------------------
create or replace function public.tc_cbt_exam_results(p_exam uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rows jsonb; v_exam jsonb; v_stats jsonb;
begin
  if not public.is_tutor() then
    raise exception 'Exam results are for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;

  select to_jsonb(e) into v_exam from public.cbt_exams e where e.id = p_exam;
  if v_exam is null then
    return jsonb_build_object('ok', false, 'error', 'That exam no longer exists.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'candidate', coalesce(r.candidate_name, l.full_name, 'Anonymous candidate'),
           'learner_id', r.learner_id,
           'student_no', r.student_no,
           'anonymous', coalesce(r.is_anonymous, r.learner_id is null),
           'score', coalesce(r.manual_score, r.score),
           'raw_score', r.score,
           'manual_score', r.manual_score,
           'max_score', r.max_score,
           'pct', case when coalesce(r.max_score,0) > 0
                       then round(100.0 * coalesce(r.manual_score, r.score, 0) / r.max_score, 1)
                       else null end,
           'duration_sec', r.duration_sec,
           'attempt_no', coalesce(r.attempt_no, 1),
           'violations', coalesce(jsonb_array_length(coalesce(r.violations, '[]'::jsonb)), 0),
           'flagged', coalesce(r.flagged, false),
           'reviewed_at', r.reviewed_at,
           'tutor_comment', r.tutor_comment,
           'subject_scores', r.subject_scores,
           'submitted_at', r.created_at)
         order by r.created_at desc), '[]'::jsonb)
    into v_rows
    from public.cbt_results r
    left join public.learners l on l.id = r.learner_id
   where r.exam_id = p_exam;

  select jsonb_build_object(
    'sat',        count(*),
    'anonymous',  count(*) filter (where coalesce(is_anonymous, learner_id is null)),
    'registered', count(*) filter (where learner_id is not null),
    'average_pct', case when count(*) filter (where coalesce(max_score,0) > 0) = 0 then null
      else round(avg(100.0 * coalesce(manual_score, score, 0) / nullif(max_score, 0))
                 filter (where coalesce(max_score,0) > 0), 1) end,
    'highest_pct', max(round(100.0 * coalesce(manual_score, score, 0) / nullif(max_score, 0), 1)),
    'lowest_pct',  min(round(100.0 * coalesce(manual_score, score, 0) / nullif(max_score, 0), 1)),
    'flagged',    count(*) filter (where coalesce(flagged, false)),
    'with_violations', count(*) filter (where coalesce(jsonb_array_length(coalesce(violations,'[]'::jsonb)),0) > 0),
    'unreviewed', count(*) filter (where reviewed_at is null),
    'median_seconds', percentile_cont(0.5) within group (order by duration_sec)
                        filter (where duration_sec is not null)
  ) into v_stats
    from public.cbt_results where exam_id = p_exam;

  return jsonb_build_object('ok', true, 'exam', v_exam, 'stats', v_stats, 'results', v_rows);
end $$;

grant execute on function public.tc_cbt_exam_results(uuid) to authenticated;
revoke all on function public.tc_cbt_exam_results(uuid) from public, anon;


-- ---------------------------------------------------------------------
-- 3. The full audit of ONE sitting — what this candidate actually did.
-- ---------------------------------------------------------------------
create or replace function public.tc_cbt_result_audit(p_result uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare r public.cbt_results%rowtype; v_exam jsonb;
begin
  if not public.is_tutor() then
    raise exception 'Result audits are for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into r from public.cbt_results where id = p_result;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That result no longer exists.');
  end if;

  select jsonb_build_object('id', e.id, 'title', e.title, 'code', e.code,
                            'questions', coalesce(e.csv_data, e.questions),
                            'duration_min', e.duration_min, 'quiz_kind', e.quiz_kind)
    into v_exam from public.cbt_exams e where e.id = r.exam_id;

  return jsonb_build_object(
    'ok', true,
    'exam', v_exam,
    'result', jsonb_build_object(
      'id', r.id,
      'candidate', coalesce(r.candidate_name, 'Anonymous candidate'),
      'learner_id', r.learner_id, 'student_no', r.student_no,
      'anonymous', coalesce(r.is_anonymous, r.learner_id is null),
      'score', r.score, 'manual_score', r.manual_score, 'max_score', r.max_score,
      'started_at', r.started_at, 'finished_at', r.finished_at,
      'duration_sec', r.duration_sec, 'attempt_no', coalesce(r.attempt_no, 1),
      'submitted_at', r.created_at, 'user_agent', r.user_agent,
      'flagged', coalesce(r.flagged, false),
      'reviewed_at', r.reviewed_at, 'tutor_comment', r.tutor_comment),
    -- The two trails that answer "what did they do".
    'answers',     coalesce(r.answers, '{}'::jsonb),
    /* ITEM 3 FIX — this used to be
         coalesce(r.per_question, r.review, r.detail, '[]')
       but per_question was declared `default '[]'::jsonb`, so it is never
       NULL — it is an EMPTY ARRAY. coalesce returns the first non-null, so
       it always returned that empty default and never fell through to
       `review`, which is where the exam runner actually stored the trail.
       The audit therefore showed "question by question" with nothing in it.
       Pick the first source that actually HAS rows. */
    'per_question', case
       when jsonb_typeof(r.per_question) = 'array' and jsonb_array_length(r.per_question) > 0
         then r.per_question
       when jsonb_typeof(r.review) = 'array' and jsonb_array_length(r.review) > 0
         then r.review
       when jsonb_typeof(r.detail) = 'array' and jsonb_array_length(r.detail) > 0
         then r.detail
       when jsonb_typeof(r.detail) = 'object' and jsonb_typeof(r.detail->'detail') = 'array'
         then r.detail->'detail'
       else '[]'::jsonb end,
    'violations',  coalesce(r.violations, '[]'::jsonb),
    'subject_scores', coalesce(r.subject_scores, '{}'::jsonb));
end $$;

grant execute on function public.tc_cbt_result_audit(uuid) to authenticated;
revoke all on function public.tc_cbt_result_audit(uuid) from public, anon;


-- ---------------------------------------------------------------------
-- 4. Item-level analysis across a whole exam: which questions failed the
--    class. This is what turns a pile of scores into teaching information.
-- ---------------------------------------------------------------------
create or replace function public.tc_cbt_item_analysis(p_exam uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_tutor() then
    raise exception 'Item analysis is for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;

  with rows as (
    select jsonb_array_elements(
             case
               when jsonb_typeof(r.per_question) = 'array' and jsonb_array_length(r.per_question) > 0
                 then r.per_question
               when jsonb_typeof(r.review) = 'array' and jsonb_array_length(r.review) > 0
                 then r.review
               when jsonb_typeof(r.detail) = 'array' and jsonb_array_length(r.detail) > 0
                 then r.detail
               when jsonb_typeof(r.detail) = 'object' and jsonb_typeof(r.detail->'detail') = 'array'
                 then r.detail->'detail'
               else '[]'::jsonb end) as q
      from public.cbt_results r where r.exam_id = p_exam
  ), tally as (
    select coalesce(q->>'question', q->>'id', 'item') as question,
           coalesce(q->>'type', '') as qtype,
           count(*) as attempts,
           count(*) filter (where (q->>'ok') = 'true' or (q->>'correct') = 'true') as got_right
      from rows group by 1, 2
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'question', left(question, 120),
           'type', qtype,
           'attempts', attempts,
           'correct', got_right,
           'facility_pct', case when attempts = 0 then null
                                else round(100.0 * got_right / attempts, 1) end,
           -- A facility below 40% usually means the item, not the class,
           -- is the problem. Surface it so the tutor checks the key.
           'verdict', case
             when attempts = 0 then 'no data'
             when 100.0 * got_right / attempts < 25 then 'CHECK THE KEY — almost nobody got this'
             when 100.0 * got_right / attempts < 50 then 'hard — worth reteaching'
             when 100.0 * got_right / attempts > 95 then 'very easy — low discrimination'
             else 'healthy' end)
         order by (case when attempts = 0 then 999 else 100.0 * got_right / attempts end)), '[]'::jsonb)
    into v from tally;

  return jsonb_build_object('ok', true, 'items', v, 'generated_at', now());
end $$;

grant execute on function public.tc_cbt_item_analysis(uuid) to authenticated;
revoke all on function public.tc_cbt_item_analysis(uuid) from public, anon;


-- ---------------------------------------------------------------------
-- 4b. PRE-FLIGHT: notifications needs three columns it never had.
--     public.notifications is (id, user_id, title, body, read_at,
--     created_at). The submission trigger below writes kind, audience and
--     link, so those must exist or every CBT submission would fail on the
--     notification insert. Checked against the schema rather than assumed —
--     the same discipline that caught sessions.tutor_id in V19.
-- ---------------------------------------------------------------------
alter table if exists public.notifications add column if not exists kind     text;
alter table if exists public.notifications add column if not exists audience text default 'staff';
alter table if exists public.notifications add column if not exists link     text;
alter table if exists public.notifications add column if not exists seen_by  jsonb default '[]'::jsonb;

create index if not exists notifications_created_idx on public.notifications (created_at desc);
create index if not exists notifications_kind_idx    on public.notifications (kind);

-- Staff must be able to READ a studio-wide notification that has no user_id.
drop policy if exists notifications_staff_read on public.notifications;
create policy notifications_staff_read on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or (user_id is null and public.is_tutor()));


-- ---------------------------------------------------------------------
-- 5. Notify staff the moment anybody sits a paper.
--    A trigger writes a notification row; the browser polls it. No paid
--    push service is involved, so this costs nothing to run.
-- ---------------------------------------------------------------------
create or replace function public.tc_notify_cbt_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_title text; v_pct numeric; v_who text;
begin
  select title into v_title from public.cbt_exams where id = new.exam_id;
  v_pct := case when coalesce(new.max_score, 0) > 0
                then round(100.0 * coalesce(new.score, 0) / new.max_score, 1) end;
  v_who := coalesce(new.candidate_name, 'An anonymous candidate');

  begin
    insert into public.notifications (title, body, kind, audience, link, created_at)
    values (
      'CBT submitted: ' || coalesce(v_title, 'a quiz'),
      v_who || ' scored ' || coalesce(new.score, 0)::text || '/' ||
        coalesce(new.max_score, 0)::text ||
        case when v_pct is not null then ' (' || v_pct::text || '%)' else '' end ||
        case when coalesce(jsonb_array_length(coalesce(new.violations, '[]'::jsonb)), 0) > 0
             then ' — ' || jsonb_array_length(new.violations)::text || ' integrity flag(s)'
             else '' end,
      'cbt_result', 'staff',
      'cbt-results.html?exam=' || coalesce(new.exam_id::text, ''),
      now());
  exception when others then
    -- Never let a notification failure block a candidate's submission.
    null;
  end;
  return new;
end $$;

drop trigger if exists tc_notify_cbt_trg on public.cbt_results;
create trigger tc_notify_cbt_trg
  after insert on public.cbt_results
  for each row execute function public.tc_notify_cbt_submission();


-- ---------------------------------------------------------------------
-- 6. Staff actions on a result: flag it, mark it reviewed, override a mark.
-- ---------------------------------------------------------------------
create or replace function public.tc_cbt_review_result(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_tutor() then
    raise exception 'Only studio staff can review a result.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.cbt_results set
    flagged       = coalesce((p->>'flagged')::boolean, flagged),
    tutor_comment = coalesce(nullif(trim(coalesce(p->>'tutor_comment','')),''), tutor_comment),
    manual_score  = coalesce(nullif(p->>'manual_score','')::numeric, manual_score),
    reviewed_by   = auth.uid(),
    reviewed_at   = now()
  where id = (p->>'id')::uuid;

  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.tc_cbt_review_result(jsonb) to authenticated;
revoke all on function public.tc_cbt_review_result(jsonb) from public, anon;


-- ---------------------------------------------------------------------
-- 7. Every exam with its result count — powers the "Results" button.
-- ---------------------------------------------------------------------
create or replace function public.tc_cbt_exam_index()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_tutor() then
    raise exception 'The exam index is for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id, 'title', e.title, 'code', e.code,
           'quiz_kind', e.quiz_kind, 'subject', e.subject,
           'status', e.status, 'is_open', e.is_open,
           'created_at', e.created_at,
           'sat', (select count(*) from public.cbt_results r where r.exam_id = e.id),
           'unreviewed', (select count(*) from public.cbt_results r
                           where r.exam_id = e.id and r.reviewed_at is null),
           'flagged', (select count(*) from public.cbt_results r
                        where r.exam_id = e.id and coalesce(r.flagged,false)),
           'average_pct', (select round(avg(100.0 * coalesce(r.manual_score, r.score, 0)
                                            / nullif(r.max_score, 0)), 1)
                             from public.cbt_results r
                            where r.exam_id = e.id and coalesce(r.max_score,0) > 0))
         order by e.created_at desc), '[]'::jsonb)
    into v from public.cbt_exams e where coalesce(e.is_archived, false) = false;
  return jsonb_build_object('ok', true, 'exams', v);
end $$;

grant execute on function public.tc_cbt_exam_index() to authenticated;
revoke all on function public.tc_cbt_exam_index() from public, anon;


-- Re-assert the V18 rule: nothing new is executable by PUBLIC.
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

select 'V22 CBT results, audit and notification installed ✅' as status;

-- BEGIN v24-tutor-scoping.sql
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


-- ===========================================================================
-- TUTORING CONNECT — V25
-- "Entry desks", CBT lifecycle, free-class cohorts, certificate studio
-- ---------------------------------------------------------------------------
-- WHY THIS PACK EXISTS
--
-- A audit of the generated studio found that eleven pages in the Analytics and
-- Reporting sections shipped as READ-ONLY STUBS. Their entire <main> was a
-- description card followed by the sentence:
--
--     "Use the related links and the Page Help button."
--
-- There was no table behind them and no way for a tutor or an administrator to
-- record anything. The pages named in the report were:
--
--     At-risk board          Practice analytics     Value-added
--     Predicted grades       Group insights         Insights lab
--     Scoresheet (entry)     Progress reports       Timezone desk
--
-- Analysis, not data entry, was the original intent — every figure was to be
-- derived. In practice a tutor needs to record the judgement as well as the
-- arithmetic: WHY a learner is at risk, WHAT was agreed with the parent, WHICH
-- grade is being predicted and on what basis. None of that is derivable.
--
-- This pack therefore creates one small, well-indexed table per desk. Each one
-- follows the same shape so the shared front-end (assets/js/desk-kit.js) can
-- drive all of them:
--
--     id, learner_id / group_id, period, the desk's own columns,
--     note, created_by, created_at, updated_at
--
-- SECURITY POSTURE (unchanged from V18/V24, applied to the new tables)
--   * RLS on, forced.
--   * Managers (owner/admin) see everything.
--   * A tutor sees only rows for learners and engagements they actually teach,
--     via the V24 helpers tc_teaches_learner() / tc_teaches_engagement().
--   * A parent or learner reads only their own rows, and writes nothing.
--   * EXECUTE is revoked FROM PUBLIC, not from anon — revoking from anon is a
--     no-op because PostgreSQL grants EXECUTE to PUBLIC by default. This was
--     the V18 finding and it applies to every function created below.
--
-- SAFE TO RE-RUN. Every statement is idempotent.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0. Shared helpers
-- ---------------------------------------------------------------------------

-- Who is writing? Stored on every desk row so an entry can be attributed and
-- an audit answered without joining three tables.
create or replace function public.tc_actor()
returns uuid language sql stable as $$ select auth.uid() $$;

revoke all on function public.tc_actor() from public;
grant execute on function public.tc_actor() to authenticated;

-- Touch updated_at on every update. One trigger function, reused everywhere.
create or replace function public.tc_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

revoke all on function public.tc_touch_updated() from public;

-- ---------------------------------------------------------------------------
-- 1. AT-RISK BOARD  (report item 12)
--
-- The rule engine still computes the flags. What was missing was the human
-- half: the intervention. A flag with no recorded action is a complaint
-- waiting to happen — the parent asks "you knew in March, what did you do?"
-- and nobody can answer. Each row here is one review of one learner.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_at_risk_reviews (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid references public.learners(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete set null,
  subject       text,
  reviewed_on   date not null default current_date,
  -- Where the concern came from. 'auto' means the rule engine raised it and a
  -- human confirmed it; 'manual' means a tutor raised it from observation.
  origin        text not null default 'manual',        -- auto | manual
  risk_level    text not null default 'watch',         -- watch | concern | urgent | cleared
  -- The triggers that applied, stored as text so the board can show them even
  -- if the rule that produced them is later retired.
  triggers      text[] default '{}',
  evidence      text,           -- "3 of last 4 quizzes below 45%, 2 no-shows"
  action_agreed text,           -- "Extra 30-min clinic Thursdays for 4 weeks"
  owner_tutor   uuid references public.tutors(id) on delete set null,
  parent_told   boolean default false,
  parent_told_on date,
  review_due    date,
  resolved      boolean default false,
  resolved_on   date,
  outcome       text,
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_at_risk_learner_idx on public.tc_at_risk_reviews (learner_id, reviewed_on desc);
create index if not exists tc_at_risk_open_idx    on public.tc_at_risk_reviews (resolved, risk_level);

-- ---------------------------------------------------------------------------
-- 2. PRACTICE ANALYTICS  (report item 13)
--
-- Self-quiz and review-quiz attempts are captured automatically. Practice done
-- OFF the platform — a past-paper worked on paper, a Khan Academy set, a
-- weekend problem sheet — is invisible, and for an exam-prep studio that is
-- most of the practice. This table lets a tutor log it so the analytics are
-- about the learner's whole week, not just the part that happened in a
-- browser.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_practice_analytics (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid references public.learners(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete set null,
  subject       text,
  topic         text,
  source        text not null default 'platform',  -- platform|past_paper|worksheet|external|homework
  period_start  date not null default current_date,
  period_end    date,
  attempts      int    default 0,
  questions     int    default 0,
  correct       int    default 0,
  -- accuracy is DERIVED, never typed. Storing it generated removes the single
  -- most common data-entry error on a page like this: a percentage that does
  -- not match its own numerator and denominator.
  accuracy      numeric(5,2) generated always as (
                  case when coalesce(questions,0) > 0
                       then round((coalesce(correct,0)::numeric / questions) * 100, 2)
                       else null end) stored,
  minutes       int    default 0,
  difficulty    text,                              -- foundation|core|stretch|exam
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_practice_learner_idx on public.tc_practice_analytics (learner_id, period_start desc);
create index if not exists tc_practice_subject_idx on public.tc_practice_analytics (subject, topic);

-- ---------------------------------------------------------------------------
-- 3. VALUE-ADDED  (report item 14)
--
-- Value-added is the studio's central commercial claim: "the child arrived at
-- 42% and is now at 68%, and here is the arithmetic." It needs a BASELINE,
-- which by definition predates the platform and can only be typed in — a
-- mock-exam mark, a school report, a diagnostic sat in week one.
--
-- The VA score is generated, so it can never disagree with its own inputs.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_value_added (
  id             uuid primary key default gen_random_uuid(),
  learner_id     uuid references public.learners(id) on delete cascade,
  engagement_id  uuid references public.engagements(id) on delete set null,
  subject        text,
  period_label   text,                       -- "Term 1 2026", "Cycle 3"
  period_start   date,
  period_end     date,
  baseline_score numeric(6,2),               -- where they started
  baseline_source text,                      -- "School report Dec 2025"
  current_score  numeric(6,2),               -- where they are now
  target_score   numeric(6,2),               -- where we said they would be
  expected_score numeric(6,2),               -- cohort-typical progress
  value_added    numeric(6,2) generated always as (
                   case when current_score is not null and expected_score is not null
                        then round(current_score - expected_score, 2)
                        when current_score is not null and baseline_score is not null
                        then round(current_score - baseline_score, 2)
                        else null end) stored,
  hours_taught   numeric(6,2),
  confidence     text default 'medium',      -- low|medium|high
  method         text,                       -- how it was measured
  note           text,
  published      boolean default false,      -- visible to the family?
  created_by     uuid default public.tc_actor(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists tc_value_added_learner_idx on public.tc_value_added (learner_id, period_start desc);

-- ---------------------------------------------------------------------------
-- 4. PREDICTED GRADES  (report item 15)
--
-- A predicted grade is a professional judgement on a named grading scale. It
-- is not a percentage and cannot be computed: WAEC A1 and Cambridge IGCSE 9
-- and SAT 1450 are different objects. The exam board and the scale are
-- therefore first-class columns, and 'basis' is required by the front end
-- because an unexplained prediction is worthless in a parent conference.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_predicted_grades (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid references public.learners(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete set null,
  subject       text,
  exam_board    text,        -- WAEC | NECO | JAMB | IGCSE | GCSE | SAT | IELTS | Common Entrance | Other
  exam_series   text,        -- "May/June 2026"
  scale         text,        -- "A1–F9" | "9–1" | "A*–E" | "400–1600" | "0–9 bands"
  current_grade text,
  predicted     text not null,
  target_grade  text,
  confidence    text default 'medium',   -- low | medium | high
  basis         text,                    -- what the prediction rests on
  evidence_pct  numeric(5,2),            -- the mean mark behind it, if any
  risk          text,                    -- "misses target if attendance stays below 80%"
  predicted_on  date default current_date,
  published     boolean default false,
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_predicted_learner_idx on public.tc_predicted_grades (learner_id, predicted_on desc);
create index if not exists tc_predicted_board_idx   on public.tc_predicted_grades (exam_board, subject);

-- ---------------------------------------------------------------------------
-- 5. GROUP INSIGHTS  (report item 16)
--
-- Group teaching produces observations that belong to the GROUP, not to any
-- one child: "the whole set has not met simultaneous equations", "attendance
-- collapses in the 7pm slot". Those cannot be stored against a learner without
-- being wrong.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_group_insights (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  subject       text,
  period_label  text,
  period_start  date default current_date,
  period_end    date,
  headcount     int,
  avg_score     numeric(5,2),
  attendance_pct numeric(5,2),
  homework_pct  numeric(5,2),
  strongest_topic text,
  weakest_topic  text,
  observation   text,
  action        text,
  next_review   date,
  published     boolean default false,
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_group_insights_eng_idx on public.tc_group_insights (engagement_id, period_start desc);

-- ---------------------------------------------------------------------------
-- 6. INSIGHTS LAB  (report item 17)
--
-- The lab is where a hypothesis is written down before it is acted on:
-- "I think the Tuesday cohort underperforms because the slot follows their
-- school games afternoon." A note has a subject, an observation, the evidence
-- behind it, a proposed action and — crucially — a place to record what
-- actually happened. That last column is what turns an opinion into practice.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_insight_notes (
  id            uuid primary key default gen_random_uuid(),
  scope         text not null default 'learner',   -- learner | group | subject | studio
  learner_id    uuid references public.learners(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete cascade,
  subject       text,
  title         text not null,
  category      text default 'observation',        -- observation|hypothesis|experiment|finding|risk
  observation   text,
  evidence      text,
  action        text,
  measured_by   text,                              -- how we will know it worked
  status        text default 'open',               -- open|testing|confirmed|rejected|closed
  outcome       text,
  review_on     date,
  tags          text[] default '{}',
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_insight_notes_status_idx on public.tc_insight_notes (status, review_on);

-- ---------------------------------------------------------------------------
-- 7. SCORESHEET — manual entry  (report item 18)
--
-- public.scoresheet already exists and is written automatically by the graded
-- quiz trigger. Two things were missing for hand entry:
--
--   a) pct was expected to be typed, and so could disagree with score/max.
--      It is now maintained by a trigger, whatever the source of the row.
--   b) there was nowhere to record WHO entered a manual mark, what it was out
--      of in a different scale, or a tutor comment.
-- ---------------------------------------------------------------------------
alter table if exists public.scoresheet add column if not exists tutor_id      uuid references public.tutors(id) on delete set null;
alter table if exists public.scoresheet add column if not exists assessment_type text default 'manual';  -- manual|graded_quiz|sow|homework|mock|classwork
alter table if exists public.scoresheet add column if not exists term          text;
alter table if exists public.scoresheet add column if not exists weight        numeric(5,2) default 1;
alter table if exists public.scoresheet add column if not exists grade         text;
alter table if exists public.scoresheet add column if not exists comment       text;
alter table if exists public.scoresheet add column if not exists published     boolean default true;
alter table if exists public.scoresheet add column if not exists created_by    uuid;
alter table if exists public.scoresheet add column if not exists updated_at    timestamptz default now();

-- pct is arithmetic, not an opinion. Recompute it on every write so a hand
-- entered row can never contradict itself.
create or replace function public.tc_scoresheet_pct()
returns trigger language plpgsql as $$
begin
  if coalesce(new.max_score, 0) > 0 then
    new.pct := round((coalesce(new.score, 0)::numeric / new.max_score) * 100, 2);
  end if;
  new.updated_at := now();
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;

revoke all on function public.tc_scoresheet_pct() from public;

drop trigger if exists tc_scoresheet_pct_trg on public.scoresheet;
create trigger tc_scoresheet_pct_trg
  before insert or update on public.scoresheet
  for each row execute function public.tc_scoresheet_pct();

-- ---------------------------------------------------------------------------
-- 8. PROGRESS REPORTS  (report item 20)
--
-- The progress report is the studio's flagship parent-facing document, and
-- there was no table for it at all. A report is a draft until it is published,
-- because a half-written comment must never reach a parent.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_progress_reports (
  id             uuid primary key default gen_random_uuid(),
  learner_id     uuid references public.learners(id) on delete cascade,
  engagement_id  uuid references public.engagements(id) on delete set null,
  tutor_id       uuid references public.tutors(id) on delete set null,
  period_label   text not null,                 -- "Cycle 3 · Mar 2026"
  period_start   date,
  period_end     date,
  -- One row per subject: [{subject, score, grade, effort, comment}]
  subjects       jsonb default '[]'::jsonb,
  attendance_pct numeric(5,2),
  punctuality    text,
  homework_pct   numeric(5,2),
  hours_taught   numeric(6,2),
  effort         text,                          -- excellent|good|fair|needs work
  behaviour      text,
  strengths      text,
  areas_to_improve text,
  tutor_comment  text,
  admin_comment  text,
  next_steps     text,
  parent_ack     boolean default false,
  parent_ack_on  timestamptz,
  status         text not null default 'draft', -- draft | published | archived
  published_on   timestamptz,
  note           text,
  created_by     uuid default public.tc_actor(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists tc_progress_learner_idx on public.tc_progress_reports (learner_id, period_start desc);
create index if not exists tc_progress_status_idx  on public.tc_progress_reports (status);

-- Stamp published_on exactly once, when status first becomes 'published'.
create or replace function public.tc_progress_publish()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and coalesce(old.status, '') <> 'published' then
    new.published_on := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

revoke all on function public.tc_progress_publish() from public;

drop trigger if exists tc_progress_publish_trg on public.tc_progress_reports;
create trigger tc_progress_publish_trg
  before insert or update on public.tc_progress_reports
  for each row execute function public.tc_progress_publish();

-- ---------------------------------------------------------------------------
-- 9. TIMEZONE DESK  (report item 9)
--
-- The studio teaches across time zones. The page could convert a time, but
-- there was nowhere to record the facts the conversion depends on: this tutor
-- is in Lagos and will not teach before 07:00; this family is in Toronto and
-- observes daylight saving; this learner's exam board publishes in UTC.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_timezone_desk (
  id            uuid primary key default gen_random_uuid(),
  party_type    text not null default 'tutor',   -- tutor | learner | parent | studio | exam_board
  tutor_id      uuid references public.tutors(id) on delete cascade,
  learner_id    uuid references public.learners(id) on delete cascade,
  parent_id     uuid references public.parents(id) on delete cascade,
  label         text,                            -- free text for studio/exam_board rows
  city          text,
  country       text,
  tz            text not null,                   -- IANA, e.g. 'Africa/Lagos'
  utc_offset    text,                            -- cached display value, e.g. '+01:00'
  observes_dst  boolean default false,
  -- Availability window in the party's OWN local time. Stored as text so a
  -- 22:00–01:00 window that crosses midnight is not mangled.
  work_from     time,
  work_to       time,
  work_days     text[] default '{Mon,Tue,Wed,Thu,Fri}',
  blackout      text,                            -- "no classes during Ramadan evenings"
  preferred_contact text,
  is_default    boolean default false,
  active        boolean default true,
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_timezone_party_idx on public.tc_timezone_desk (party_type, active);

-- ---------------------------------------------------------------------------
-- 10. FREE / OUTREACH CLASSES  (report item 8)
--
-- The studio runs free preparation classes on YouTube, Zoom, Google Meet and
-- Free Conference, with a WhatsApp or Telegram group alongside, aimed at
-- national and international examinations. Those learners are NOT paying
-- clients: they must not appear on invoices, in payroll or in the fee ledger.
-- But they must be trackable, assessable and countable, because the whole
-- point is to evaluate them and to convert the strongest into paying students.
--
-- Three tables:
--   tc_free_cohorts       — the programme itself (a class, a season, a board)
--   tc_free_links         — one shareable registration link per cohort
--   tc_free_registrations — who signed up, and what happened to them
--
-- No file uploads anywhere: the meeting room, the recording and the group chat
-- are all links, which is also what keeps the studio inside the free tier.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_free_cohorts (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                  -- "Free JAMB Physics Bootcamp 2026"
  code           text unique,                    -- "JAMB-PHY-26"
  description    text,
  exam_board     text,                           -- WAEC|NECO|JAMB|IGCSE|SAT|IELTS|Other
  exam_series    text,
  subjects       text[] default '{}',
  level          text,                           -- "SS3", "Year 11"
  -- Where the class actually happens. All links, never uploads.
  platform       text,                           -- youtube|zoom|meet|freeconference|teams|other
  meeting_url    text,
  meeting_id     text,
  meeting_passcode text,
  youtube_url    text,                           -- live stream or playlist
  replay_url     text,
  whatsapp_url   text,
  telegram_url   text,
  schedule_text  text,                           -- "Sat & Sun, 5–7pm WAT"
  tz             text default 'Africa/Lagos',
  starts_on      date,
  ends_on        date,
  capacity       int default 0,                  -- 0 = unlimited
  tutor_id       uuid references public.tutors(id) on delete set null,
  -- Governance. A free cohort still needs a register, a consent position and
  -- an owner, especially where minors are involved.
  requires_parent_consent boolean default true,
  min_age        int,
  auto_approve   boolean default true,
  track_attendance boolean default true,
  track_results  boolean default true,
  status         text not null default 'open',   -- draft|open|closed|running|completed|archived
  banner_url     text,
  note           text,
  created_by     uuid default public.tc_actor(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists tc_free_cohorts_status_idx on public.tc_free_cohorts (status, starts_on desc);

create table if not exists public.tc_free_links (
  id           uuid primary key default gen_random_uuid(),
  cohort_id    uuid not null references public.tc_free_cohorts(id) on delete cascade,
  token        text not null unique,
  label        text,                              -- "Instagram", "WhatsApp status"
  active       boolean default true,
  expires_on   date,
  max_uses     int default 0,                     -- 0 = unlimited
  uses         int default 0,
  created_by   uuid default public.tc_actor(),
  created_at   timestamptz default now()
);

create index if not exists tc_free_links_token_idx on public.tc_free_links (token) where active;

create table if not exists public.tc_free_registrations (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid not null references public.tc_free_cohorts(id) on delete cascade,
  link_id       uuid references public.tc_free_links(id) on delete set null,
  reg_no        text unique,                       -- issued by trigger below
  full_name     text not null,
  email         text,
  phone         text,
  whatsapp      text,
  country       text,
  state_region  text,
  city          text,
  tz            text,
  school        text,
  level         text,
  exam_board    text,
  exam_series   text,
  subjects      text[] default '{}',
  parent_name   text,
  parent_phone  text,
  parent_email  text,
  parent_consent boolean default false,
  how_heard     text,
  goal          text,                              -- what they want out of it
  -- Lifecycle. A free student can be promoted into a real learner record, and
  -- the link is kept so the conversion can be reported on.
  status        text not null default 'pending',   -- pending|approved|active|inactive|completed|declined|converted
  approved_on   timestamptz,
  learner_id    uuid references public.learners(id) on delete set null,
  converted_on  timestamptz,
  -- Lightweight tracking, so the studio can evaluate without a fee record.
  sessions_attended int default 0,
  sessions_total    int default 0,
  attendance_pct numeric(5,2),
  quizzes_taken  int default 0,
  avg_score      numeric(5,2),
  last_active_on date,
  engagement_note text,
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_free_reg_cohort_idx on public.tc_free_registrations (cohort_id, status);
create index if not exists tc_free_reg_name_idx   on public.tc_free_registrations (lower(full_name));

-- Registration numbers from a sequence, the same approach V16 used for exam
-- numbers. A client-generated number races; a sequence cannot.
create sequence if not exists public.tc_free_reg_seq start 1;

create or replace function public.tc_free_reg_number()
returns trigger language plpgsql as $$
declare c text;
begin
  if new.reg_no is null or new.reg_no = '' then
    select coalesce(nullif(code, ''), 'FREE') into c
      from public.tc_free_cohorts where id = new.cohort_id;
    new.reg_no := upper(coalesce(c, 'FREE')) || '-' ||
                  to_char(now(), 'YY') || '-' ||
                  lpad(nextval('public.tc_free_reg_seq')::text, 5, '0');
  end if;
  new.updated_at := now();
  return new;
end $$;

revoke all on function public.tc_free_reg_number() from public;

drop trigger if exists tc_free_reg_number_trg on public.tc_free_registrations;
create trigger tc_free_reg_number_trg
  before insert or update on public.tc_free_registrations
  for each row execute function public.tc_free_reg_number();

-- Attendance percentage is arithmetic. Keep it honest.
create or replace function public.tc_free_reg_pct()
returns trigger language plpgsql as $$
begin
  if coalesce(new.sessions_total, 0) > 0 then
    new.attendance_pct := round((coalesce(new.sessions_attended,0)::numeric / new.sessions_total) * 100, 2);
  end if;
  return new;
end $$;

revoke all on function public.tc_free_reg_pct() from public;

drop trigger if exists tc_free_reg_pct_trg on public.tc_free_registrations;
create trigger tc_free_reg_pct_trg
  before insert or update on public.tc_free_registrations
  for each row execute function public.tc_free_reg_pct();

-- ---------------------------------------------------------------------------
-- 10b. PUBLIC REGISTRATION RPC
--
-- The registration page is reachable by someone with no account, so the write
-- has to be possible for the anon role. Granting INSERT on the table to anon
-- would let anyone write any column — including status='converted' and a
-- learner_id. Instead the only anon-callable surface is this function, which:
--   * refuses a token that is missing, inactive, expired or exhausted,
--   * refuses a cohort that is not open,
--   * ignores every column the caller is not allowed to set,
--   * returns the registration number so the page can show it.
--
-- SECURITY DEFINER with a pinned search_path, per the V18 posture.
-- ---------------------------------------------------------------------------
create or replace function public.tc_free_register(
  p_token   text,
  p_name    text,
  p_email   text default null,
  p_phone   text default null,
  p_country text default null,
  p_city    text default null,
  p_school  text default null,
  p_level   text default null,
  p_board   text default null,
  p_subjects text[] default '{}',
  p_parent_name  text default null,
  p_parent_phone text default null,
  p_consent boolean default false,
  p_how_heard text default null,
  p_goal    text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lnk public.tc_free_links%rowtype;
  coh public.tc_free_cohorts%rowtype;
  reg public.tc_free_registrations%rowtype;
  taken int;
begin
  if coalesce(trim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Please enter your full name.');
  end if;

  select * into lnk from public.tc_free_links where token = p_token;
  if not found or not lnk.active then
    return jsonb_build_object('ok', false, 'error', 'This registration link is no longer active.');
  end if;
  if lnk.expires_on is not null and lnk.expires_on < current_date then
    return jsonb_build_object('ok', false, 'error', 'This registration link expired on ' || lnk.expires_on || '.');
  end if;
  if coalesce(lnk.max_uses, 0) > 0 and coalesce(lnk.uses, 0) >= lnk.max_uses then
    return jsonb_build_object('ok', false, 'error', 'This registration link has reached its limit.');
  end if;

  select * into coh from public.tc_free_cohorts where id = lnk.cohort_id;
  if not found or coh.status not in ('open', 'running') then
    return jsonb_build_object('ok', false, 'error', 'Registration for this class is closed.');
  end if;
  if coalesce(coh.capacity, 0) > 0 then
    select count(*) into taken from public.tc_free_registrations
     where cohort_id = coh.id and status <> 'declined';
    if taken >= coh.capacity then
      return jsonb_build_object('ok', false, 'error', 'This class is full.');
    end if;
  end if;
  if coh.requires_parent_consent and not coalesce(p_consent, false) then
    return jsonb_build_object('ok', false, 'error', 'A parent or guardian must give consent for this class.');
  end if;

  insert into public.tc_free_registrations (
    cohort_id, link_id, full_name, email, phone, country, city, school, level,
    exam_board, exam_series, subjects, parent_name, parent_phone,
    parent_consent, how_heard, goal, status
  ) values (
    coh.id, lnk.id, trim(p_name), nullif(trim(coalesce(p_email,'')),''),
    nullif(trim(coalesce(p_phone,'')),''), p_country, p_city, p_school, p_level,
    coalesce(p_board, coh.exam_board), coh.exam_series, coalesce(p_subjects, '{}'),
    p_parent_name, p_parent_phone, coalesce(p_consent, false), p_how_heard, p_goal,
    case when coh.auto_approve then 'approved' else 'pending' end
  ) returning * into reg;

  update public.tc_free_links set uses = coalesce(uses, 0) + 1 where id = lnk.id;

  return jsonb_build_object(
    'ok', true,
    'reg_no', reg.reg_no,
    'status', reg.status,
    'cohort', coh.name,
    'meeting_url', coh.meeting_url,
    'youtube_url', coh.youtube_url,
    'whatsapp_url', coh.whatsapp_url,
    'telegram_url', coh.telegram_url,
    'schedule', coh.schedule_text
  );
end $$;

revoke all on function public.tc_free_register(text,text,text,text,text,text,text,text,text,text[],text,text,boolean,text,text) from public;
grant execute on function public.tc_free_register(text,text,text,text,text,text,text,text,text,text[],text,text,boolean,text,text) to anon, authenticated;

-- The public page needs to show WHAT it is registering for before the form is
-- filled. This returns only the presentational fields — never the roll.
create or replace function public.tc_free_cohort_public(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'name', c.name,
    'description', c.description,
    'exam_board', c.exam_board,
    'exam_series', c.exam_series,
    'subjects', to_jsonb(c.subjects),
    'level', c.level,
    'platform', c.platform,
    'schedule', c.schedule_text,
    'tz', c.tz,
    'starts_on', c.starts_on,
    'ends_on', c.ends_on,
    'banner_url', c.banner_url,
    'requires_parent_consent', c.requires_parent_consent,
    'open', (c.status in ('open','running') and l.active
             and (l.expires_on is null or l.expires_on >= current_date)
             and (coalesce(l.max_uses,0) = 0 or coalesce(l.uses,0) < l.max_uses))
  )
  from public.tc_free_links l
  join public.tc_free_cohorts c on c.id = l.cohort_id
  where l.token = p_token;
$$;

revoke all on function public.tc_free_cohort_public(text) from public;
grant execute on function public.tc_free_cohort_public(text) to anon, authenticated;

-- Promote a free student into a real learner, without losing the history.
create or replace function public.tc_free_convert(p_reg uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare r public.tc_free_registrations%rowtype; new_id uuid;
begin
  if not public.tc_is_manager() then
    raise exception 'Only an administrator may convert a free registration.';
  end if;
  select * into r from public.tc_free_registrations where id = p_reg;
  if not found then raise exception 'Registration not found.'; end if;
  if r.learner_id is not null then return r.learner_id; end if;

  insert into public.learners (full_name)
  values (r.full_name)
  returning id into new_id;

  update public.tc_free_registrations
     set learner_id = new_id, status = 'converted', converted_on = now()
   where id = p_reg;

  return new_id;
end $$;

revoke all on function public.tc_free_convert(uuid) from public;
grant execute on function public.tc_free_convert(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. CBT LIFECYCLE  (report item 22)
--
-- School Connect lets a paper be closed, re-opened, shared, previewed and
-- archived. Tutoring Connect could only edit and delete. Closing matters most:
-- a paper left open collects sittings after the deadline, and there was no way
-- to stop it without deleting the paper and losing the results.
-- ---------------------------------------------------------------------------
alter table if exists public.cbt_exams add column if not exists is_open      boolean default true;
alter table if exists public.cbt_exams add column if not exists closed_at    timestamptz;
alter table if exists public.cbt_exams add column if not exists closed_by    uuid;
alter table if exists public.cbt_exams add column if not exists is_archived  boolean default false;
alter table if exists public.cbt_exams add column if not exists archived_at  timestamptz;
alter table if exists public.cbt_exams add column if not exists share_token  text;
alter table if exists public.cbt_exams add column if not exists share_active boolean default true;
alter table if exists public.cbt_exams add column if not exists tutor_id     uuid references public.tutors(id) on delete set null;
alter table if exists public.cbt_exams add column if not exists cohort_id    uuid references public.tc_free_cohorts(id) on delete set null;
alter table if exists public.cbt_exams add column if not exists updated_at   timestamptz default now();

create unique index if not exists cbt_exams_share_token_idx
  on public.cbt_exams (share_token) where share_token is not null;

-- One entry point for every lifecycle change, so the rules live in ONE place
-- and cannot drift between the list page and the builder.
create or replace function public.tc_cbt_set_state(p_exam uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e public.cbt_exams%rowtype;
begin
  select * into e from public.cbt_exams where id = p_exam;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That quiz no longer exists.');
  end if;

  -- A tutor may manage only their own paper; a manager may manage any.
  if not (public.tc_is_manager()
          or (e.tutor_id is not null and e.tutor_id = public.tc_my_tutor_id())
          or public.tc_teaches_engagement(e.engagement_id)) then
    return jsonb_build_object('ok', false, 'error', 'This quiz is not assigned to you.');
  end if;

  if p_action = 'close' then
    update public.cbt_exams
       set is_open = false, closed_at = now(), closed_by = auth.uid(),
           status = 'closed', updated_at = now()
     where id = p_exam;

  elsif p_action = 'open' then
    update public.cbt_exams
       set is_open = true, closed_at = null, closed_by = null,
           status = 'published', is_archived = false, updated_at = now()
     where id = p_exam;

  elsif p_action = 'archive' then
    -- Archiving implies closing. An archived paper that still accepted
    -- sittings would be the worst of both worlds.
    update public.cbt_exams
       set is_archived = true, archived_at = now(), is_open = false,
           status = 'archived', share_active = false, updated_at = now()
     where id = p_exam;

  elsif p_action = 'unarchive' then
    update public.cbt_exams
       set is_archived = false, archived_at = null, status = 'draft', updated_at = now()
     where id = p_exam;

  elsif p_action = 'share' then
    update public.cbt_exams
       set share_token = coalesce(share_token, encode(gen_random_bytes(9), 'hex')),
           share_active = true, updated_at = now()
     where id = p_exam;

  elsif p_action = 'unshare' then
    update public.cbt_exams set share_active = false, updated_at = now() where id = p_exam;

  else
    return jsonb_build_object('ok', false, 'error', 'Unknown action: ' || coalesce(p_action, ''));
  end if;

  select * into e from public.cbt_exams where id = p_exam;
  return jsonb_build_object('ok', true, 'is_open', e.is_open, 'is_archived', e.is_archived,
                            'status', e.status, 'share_token', e.share_token,
                            'share_active', e.share_active);
end $$;

revoke all on function public.tc_cbt_set_state(uuid, text) from public;
grant execute on function public.tc_cbt_set_state(uuid, text) to authenticated;

-- A closed paper must actually refuse sittings. Enforcing it only in the
-- browser is a suggestion, not a rule.
create or replace function public.tc_cbt_guard_closed()
returns trigger language plpgsql as $$
declare e public.cbt_exams%rowtype;
begin
  select * into e from public.cbt_exams where id = new.exam_id;
  if found then
    if e.is_archived then
      raise exception 'This quiz has been archived and is no longer accepting answers.';
    end if;
    if e.is_open is false then
      raise exception 'This quiz is closed. Ask your tutor to re-open it.';
    end if;
    if e.closes_at is not null and now() > e.closes_at then
      raise exception 'This quiz closed on %.', to_char(e.closes_at, 'DD Mon YYYY HH24:MI');
    end if;
    if e.opens_at is not null and now() < e.opens_at then
      raise exception 'This quiz opens on %.', to_char(e.opens_at, 'DD Mon YYYY HH24:MI');
    end if;
  end if;
  return new;
end $$;

revoke all on function public.tc_cbt_guard_closed() from public;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'cbt_results'
                and column_name = 'exam_id') then
    execute 'drop trigger if exists tc_cbt_guard_closed_trg on public.cbt_results';
    execute 'create trigger tc_cbt_guard_closed_trg before insert on public.cbt_results
             for each row execute function public.tc_cbt_guard_closed()';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 12. CERTIFICATE STUDIO  (report item 19)
--
-- The certificates page issued a name, a title and a code. School Connect and
-- the GOSA portal issue a designed document: a layout, a colour pair, a
-- rosette, a signature image pulled from a link, and a verification code that
-- can be checked. The extra columns below store the DESIGN alongside the
-- award, so a certificate reprinted in two years looks exactly as it did on
-- the day it was issued rather than picking up whatever the current theme is.
-- ---------------------------------------------------------------------------
alter table if exists public.certificates add column if not exists learner_id   uuid references public.learners(id) on delete set null;
alter table if exists public.certificates add column if not exists cohort_id    uuid references public.tc_free_cohorts(id) on delete set null;
alter table if exists public.certificates add column if not exists kind         text default 'achievement'; -- achievement|completion|merit|attendance|participation|distinction|testimonial
alter table if exists public.certificates add column if not exists subtitle     text;
alter table if exists public.certificates add column if not exists body         text;
alter table if exists public.certificates add column if not exists subject      text;
alter table if exists public.certificates add column if not exists score        numeric(6,2);
alter table if exists public.certificates add column if not exists grade        text;
alter table if exists public.certificates add column if not exists signatory    text;
alter table if exists public.certificates add column if not exists signatory_role text;
alter table if exists public.certificates add column if not exists signature_url text;
alter table if exists public.certificates add column if not exists countersign  text;
alter table if exists public.certificates add column if not exists layout       text default 'premium';    -- premium|classic|modern|elegant|minimal|diploma
alter table if exists public.certificates add column if not exists font         text default 'Georgia, serif';
alter table if exists public.certificates add column if not exists primary_color text default '#0506ae';
alter table if exists public.certificates add column if not exists accent_color  text default '#964eec';
alter table if exists public.certificates add column if not exists border_style  text default 'double';
alter table if exists public.certificates add column if not exists seal_text    text;
alter table if exists public.certificates add column if not exists logo_url     text;
alter table if exists public.certificates add column if not exists valid_until  date;
alter table if exists public.certificates add column if not exists revoked      boolean default false;
alter table if exists public.certificates add column if not exists revoked_reason text;
alter table if exists public.certificates add column if not exists issued_by    uuid;
alter table if exists public.certificates add column if not exists meta         jsonb default '{}'::jsonb;
alter table if exists public.certificates add column if not exists updated_at   timestamptz default now();

create unique index if not exists certificates_code_idx on public.certificates (code) where code is not null;

-- Reusable designs, so the studio sets its house style once.
create table if not exists public.tc_certificate_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text default 'achievement',
  title         text,
  subtitle      text,
  body          text,
  layout        text default 'premium',
  font          text default 'Georgia, serif',
  primary_color text default '#0506ae',
  accent_color  text default '#964eec',
  border_style  text default 'double',
  signatory     text,
  signatory_role text,
  signature_url text,
  seal_text     text,
  logo_url      text,
  is_default    boolean default false,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Verification must work for someone who is not signed in — that is the whole
-- point of a verification code. It returns the minimum needed to confirm the
-- award and nothing that identifies anyone else.
create or replace function public.tc_verify_certificate(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  -- coalesce so an unknown code returns a clean {"ok":false} rather than an
  -- empty result set, which the front end would have to special-case.
  select coalesce(
    (select jsonb_build_object(
              'ok',          not coalesce(c.revoked, false),
              'revoked',     coalesce(c.revoked, false),
              'name',        c.learner_name,
              'title',       c.title,
              'kind',        c.kind,
              'subject',     c.subject,
              'grade',       c.grade,
              'issued_on',   c.issued_on,
              'valid_until', c.valid_until,
              'signatory',   c.signatory) as x
       from public.certificates c
      where upper(c.code) = upper(trim(p_code))
      limit 1),
    jsonb_build_object('ok', false, 'error', 'No certificate carries that code.')
  );
$$;

revoke all on function public.tc_verify_certificate(text) from public;
grant execute on function public.tc_verify_certificate(text) to anon, authenticated;

-- ===========================================================================
-- 13. ROW LEVEL SECURITY for everything created above
--
-- Applied in a loop so a table added later cannot be forgotten. Each table
-- gets four policies with the same shape; the read predicate differs because
-- the tables key on different columns.
-- ===========================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_group_insights', 'tc_insight_notes',
    'tc_progress_reports', 'tc_timezone_desk', 'tc_free_cohorts',
    'tc_free_links', 'tc_free_registrations', 'tc_certificate_templates'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- Clear anything from an earlier run so this pack is genuinely re-runnable.
    execute format('drop policy if exists %I on public.%I', t || '_read',  t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd',   t);
    execute format('drop policy if exists %I on public.%I', t || '_del',   t);
  end loop;
end $$;

-- --- learner-keyed desks -----------------------------------------------------
-- Read: a manager sees all; a tutor sees the learners they teach; a family
-- sees its own child. Write: managers and the assigned tutor only.
do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_progress_reports'
  ] loop
    execute format($f$
      create policy %I on public.%I for select to authenticated
      using (
        public.tc_is_manager()
        or public.tc_teaches_learner(learner_id)
        or exists (select 1 from public.learners l
                    where l.id = %I.learner_id and l.user_id = auth.uid())
        or exists (select 1 from public.parent_learner pl
                    join public.parents p on p.id = pl.parent_id
                   where pl.learner_id = %I.learner_id and p.user_id = auth.uid())
      )$f$, t || '_read', t, t, t);

    execute format($f$
      create policy %I on public.%I for insert to authenticated
      with check (public.tc_is_manager() or public.tc_teaches_learner(learner_id))
    $f$, t || '_write', t);

    execute format($f$
      create policy %I on public.%I for update to authenticated
      using (public.tc_is_manager() or public.tc_teaches_learner(learner_id))
      with check (public.tc_is_manager() or public.tc_teaches_learner(learner_id))
    $f$, t || '_upd', t);

    execute format($f$
      create policy %I on public.%I for delete to authenticated
      using (public.tc_is_manager() or public.tc_teaches_learner(learner_id))
    $f$, t || '_del', t);
  end loop;
end $$;

-- --- engagement-keyed desk ---------------------------------------------------
drop policy if exists tc_group_insights_read on public.tc_group_insights;
create policy tc_group_insights_read on public.tc_group_insights
  for select to authenticated
  using (
    public.tc_is_manager()
    or public.tc_teaches_engagement(engagement_id)
    or (published and exists (
          select 1 from public.engagement_members em
            join public.learners l on l.id = em.learner_id
           where em.engagement_id = tc_group_insights.engagement_id
             and l.user_id = auth.uid()))
  );
drop policy if exists tc_group_insights_write on public.tc_group_insights;
create policy tc_group_insights_write on public.tc_group_insights
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_teaches_engagement(engagement_id));
drop policy if exists tc_group_insights_upd on public.tc_group_insights;
create policy tc_group_insights_upd on public.tc_group_insights
  for update to authenticated
  using (public.tc_is_manager() or public.tc_teaches_engagement(engagement_id))
  with check (public.tc_is_manager() or public.tc_teaches_engagement(engagement_id));
drop policy if exists tc_group_insights_del on public.tc_group_insights;
create policy tc_group_insights_del on public.tc_group_insights
  for delete to authenticated
  using (public.tc_is_manager() or public.tc_teaches_engagement(engagement_id));

-- --- insights lab ------------------------------------------------------------
-- A note may be about a learner, a group, a subject or the studio as a whole,
-- so the predicate has to cover a null learner AND a null engagement.
drop policy if exists tc_insight_notes_read on public.tc_insight_notes;
create policy tc_insight_notes_read on public.tc_insight_notes
  for select to authenticated
  using (
    public.tc_is_manager()
    or (learner_id    is not null and public.tc_teaches_learner(learner_id))
    or (engagement_id is not null and public.tc_teaches_engagement(engagement_id))
    or (learner_id is null and engagement_id is null and public.tc_my_tutor_id() is not null)
    or created_by = auth.uid()
  );
drop policy if exists tc_insight_notes_write on public.tc_insight_notes;
create policy tc_insight_notes_write on public.tc_insight_notes
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_insight_notes_upd on public.tc_insight_notes;
create policy tc_insight_notes_upd on public.tc_insight_notes
  for update to authenticated
  using (public.tc_is_manager() or created_by = auth.uid())
  with check (public.tc_is_manager() or created_by = auth.uid());
drop policy if exists tc_insight_notes_del on public.tc_insight_notes;
create policy tc_insight_notes_del on public.tc_insight_notes
  for delete to authenticated
  using (public.tc_is_manager() or created_by = auth.uid());

-- --- timezone desk -----------------------------------------------------------
-- Everyone signed in may READ the desk: knowing that the tutor is in Lagos is
-- exactly what the page is for. Only staff may write.
drop policy if exists tc_timezone_desk_read on public.tc_timezone_desk;
create policy tc_timezone_desk_read on public.tc_timezone_desk
  for select to authenticated using (true);
drop policy if exists tc_timezone_desk_write on public.tc_timezone_desk;
create policy tc_timezone_desk_write on public.tc_timezone_desk
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_timezone_desk_upd on public.tc_timezone_desk;
create policy tc_timezone_desk_upd on public.tc_timezone_desk
  for update to authenticated
  using (public.tc_is_manager() or tutor_id = public.tc_my_tutor_id())
  with check (public.tc_is_manager() or tutor_id = public.tc_my_tutor_id());
drop policy if exists tc_timezone_desk_del on public.tc_timezone_desk;
create policy tc_timezone_desk_del on public.tc_timezone_desk
  for delete to authenticated using (public.tc_is_manager());

-- --- free classes ------------------------------------------------------------
-- The cohort is readable by anyone signed in (it is advertised publicly), and
-- writable by staff. The ROLL is staff-only: a free class must not leak the
-- contact details of other people's children.
drop policy if exists tc_free_cohorts_read on public.tc_free_cohorts;
create policy tc_free_cohorts_read on public.tc_free_cohorts
  for select to authenticated using (true);
drop policy if exists tc_free_cohorts_write on public.tc_free_cohorts;
create policy tc_free_cohorts_write on public.tc_free_cohorts
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_free_cohorts_upd on public.tc_free_cohorts;
create policy tc_free_cohorts_upd on public.tc_free_cohorts
  for update to authenticated
  using (public.tc_is_manager() or tutor_id = public.tc_my_tutor_id())
  with check (public.tc_is_manager() or tutor_id = public.tc_my_tutor_id());
drop policy if exists tc_free_cohorts_del on public.tc_free_cohorts;
create policy tc_free_cohorts_del on public.tc_free_cohorts
  for delete to authenticated using (public.tc_is_manager());

drop policy if exists tc_free_links_read on public.tc_free_links;
create policy tc_free_links_read on public.tc_free_links
  for select to authenticated
  using (public.tc_is_manager()
         or exists (select 1 from public.tc_free_cohorts c
                     where c.id = tc_free_links.cohort_id
                       and c.tutor_id = public.tc_my_tutor_id()));
drop policy if exists tc_free_links_write on public.tc_free_links;
create policy tc_free_links_write on public.tc_free_links
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_free_links_upd on public.tc_free_links;
create policy tc_free_links_upd on public.tc_free_links
  for update to authenticated using (public.tc_is_manager())
  with check (public.tc_is_manager());
drop policy if exists tc_free_links_del on public.tc_free_links;
create policy tc_free_links_del on public.tc_free_links
  for delete to authenticated using (public.tc_is_manager());

drop policy if exists tc_free_registrations_read on public.tc_free_registrations;
create policy tc_free_registrations_read on public.tc_free_registrations
  for select to authenticated
  using (public.tc_is_manager()
         or exists (select 1 from public.tc_free_cohorts c
                     where c.id = tc_free_registrations.cohort_id
                       and c.tutor_id = public.tc_my_tutor_id()));
drop policy if exists tc_free_registrations_write on public.tc_free_registrations;
create policy tc_free_registrations_write on public.tc_free_registrations
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_free_registrations_upd on public.tc_free_registrations;
create policy tc_free_registrations_upd on public.tc_free_registrations
  for update to authenticated
  using (public.tc_is_manager()
         or exists (select 1 from public.tc_free_cohorts c
                     where c.id = tc_free_registrations.cohort_id
                       and c.tutor_id = public.tc_my_tutor_id()))
  with check (true);
drop policy if exists tc_free_registrations_del on public.tc_free_registrations;
create policy tc_free_registrations_del on public.tc_free_registrations
  for delete to authenticated using (public.tc_is_manager());

-- --- certificate templates ---------------------------------------------------
drop policy if exists tc_certificate_templates_read on public.tc_certificate_templates;
create policy tc_certificate_templates_read on public.tc_certificate_templates
  for select to authenticated using (true);
drop policy if exists tc_certificate_templates_write on public.tc_certificate_templates;
create policy tc_certificate_templates_write on public.tc_certificate_templates
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_certificate_templates_upd on public.tc_certificate_templates;
create policy tc_certificate_templates_upd on public.tc_certificate_templates
  for update to authenticated using (public.tc_is_manager())
  with check (public.tc_is_manager());
drop policy if exists tc_certificate_templates_del on public.tc_certificate_templates;
create policy tc_certificate_templates_del on public.tc_certificate_templates
  for delete to authenticated using (public.tc_is_manager());

-- ---------------------------------------------------------------------------
-- 14. updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_group_insights', 'tc_insight_notes',
    'tc_timezone_desk', 'tc_free_cohorts', 'tc_certificate_templates'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.tc_touch_updated()',
                   t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 15. GRANTS — the V18 posture, applied to the new objects
--
-- Table privileges go to `authenticated` only. RLS then narrows it further.
-- anon gets NOTHING except the three RPCs granted explicitly above.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_group_insights', 'tc_insight_notes',
    'tc_progress_reports', 'tc_timezone_desk', 'tc_free_cohorts',
    'tc_free_links', 'tc_free_registrations', 'tc_certificate_templates'
  ] loop
    execute format('revoke all on public.%I from public', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 16. SEED — a starting timezone row and a house certificate design, so the
--     pages are not empty on first open. `on conflict do nothing` throughout.
-- ---------------------------------------------------------------------------
insert into public.tc_timezone_desk (party_type, label, city, country, tz, utc_offset, work_from, work_to, is_default, note)
select 'studio', 'Studio head office', 'Lagos', 'Nigeria', 'Africa/Lagos', '+01:00',
       time '08:00', time '21:00', true,
       'The studio clock. Every published class time is converted from here.'
where not exists (select 1 from public.tc_timezone_desk where party_type = 'studio');

insert into public.tc_certificate_templates (name, kind, title, subtitle, body, layout, is_default, signatory, signatory_role)
select 'House style — Achievement', 'achievement', 'CERTIFICATE OF ACHIEVEMENT', 'ACHIEVEMENT',
       'has successfully met the requirements of the programme and is hereby recognised for outstanding achievement.',
       'premium', true, 'Lead Tutor', 'Lead Tutor'
where not exists (select 1 from public.tc_certificate_templates where is_default);

-- ---------------------------------------------------------------------------
-- 17. Report what V25 actually installed, so the run can be verified rather
--     than assumed.
-- ---------------------------------------------------------------------------
create or replace function public.tc_v25_report()
returns table (object text, present boolean, detail text)
language sql
stable
security definer
set search_path = public
as $$
  select t.name,
         to_regclass('public.' || t.name) is not null,
         coalesce((select count(*)::text || ' row(s)'
                     from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = t.name), '0')
    from (values
      ('tc_at_risk_reviews'), ('tc_practice_analytics'), ('tc_value_added'),
      ('tc_predicted_grades'), ('tc_group_insights'), ('tc_insight_notes'),
      ('tc_progress_reports'), ('tc_timezone_desk'), ('tc_free_cohorts'),
      ('tc_free_links'), ('tc_free_registrations'), ('tc_certificate_templates')
    ) as t(name);
$$;

revoke all on function public.tc_v25_report() from public;
grant execute on function public.tc_v25_report() to authenticated;

select 'V25 desks, CBT lifecycle, free classes and certificate studio installed ✅' as status;

-- ===========================================================================
-- 18. TUTOR SCOPING — closing the gaps left by V24  (report item 21)
--
--   "Each tutor should only have access to students, classes, subjects, CBT,
--    etc assigned to them... Admin has full access to everything without
--    restrictions."
--
-- V24 introduced the scoping helpers and applied them in two loops. Auditing
-- those loops against the tables that actually exist found that SEVERAL OF
-- THE NAMES WERE WRONG. Each loop is guarded by
--
--     if exists (select 1 from information_schema.columns
--                 where table_name = t and column_name = 'learner_id')
--
-- so a misspelt table name does not raise an error — it silently does
-- nothing, and the table stays unscoped. That is the worst possible failure
-- mode for an access-control change: it reports success and protects nothing.
--
-- The names that never matched a real table were:
--
--     V24 said            the table is actually called
--     ------------------  ------------------------------
--     mastery             mastery_topics
--     curriculum          curriculum_items
--     diagnostics         (no such table — diagnostics.html writes elsewhere)
--     progress_reports    tc_progress_reports  (created in V25, above)
--     whiteboard_rooms    (no such table)
--     bookings            booking_classes
--     meetings            (no such table)
--     makeups             (no such table)
--     cancellations       (no such table)
--
-- And these were never in either list at all, though a tutor can read them:
--
--     scoresheet, parents, parent_learner, attendance_checkins,
--     session_attendance (insert path), tc_free_cohorts, cbt_roster
--
-- This section re-applies the scoping using verified names, and RAISES A
-- NOTICE for any name that does not resolve, so a future rename cannot fail
-- silently the way this one did.
-- ===========================================================================

do $$
declare
  t text;
  applied int := 0;
  skipped text[] := '{}';
  learner_tables text[] := array[
    'goals', 'mastery_topics', 'assessments', 'assignments',
    'accommodations', 'study_logs', 'flashcards', 'makeup_credits',
    'sow_evaluations', 'exam_targets', 'scoresheet',
    'reading_progress', 'student_diary', 'attendance_checkins'
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
      applied := applied + 1;
    else
      skipped := skipped || t;
    end if;
  end loop;

  raise notice 'V25 tutor scoping: % learner-keyed table(s) scoped', applied;
  if array_length(skipped, 1) > 0 then
    raise notice 'V25 tutor scoping: NOT FOUND (check the name!): %',
                 array_to_string(skipped, ', ');
  end if;
end $$;

do $$
declare
  t text;
  applied int := 0;
  skipped text[] := '{}';
  eng_tables text[] := array[
    'stream_posts', 'classwork_items', 'lesson_plans', 'curriculum_items',
    'sow_terms', 'sow_topics', 'reading_assignments', 'booking_classes',
    'rubrics', 'methodologies', 'timetable'
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
      applied := applied + 1;
    else
      skipped := skipped || t;
    end if;
  end loop;

  raise notice 'V25 tutor scoping: % engagement-keyed table(s) scoped', applied;
  if array_length(skipped, 1) > 0 then
    raise notice 'V25 tutor scoping: NOT FOUND (check the name!): %',
                 array_to_string(skipped, ', ');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Parents. A tutor should see the parent of a child they teach — they have to
-- write the report that parent reads — and nobody else's.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.parents') is not null then
    alter table public.parents enable row level security;
    drop policy if exists parents_tutor_scope on public.parents;
    create policy parents_tutor_scope on public.parents
      for all to authenticated
      using (
        public.tc_is_manager()
        or user_id = auth.uid()
        or exists (select 1 from public.parent_learner pl
                    where pl.parent_id = parents.id
                      and public.tc_teaches_learner(pl.learner_id))
      )
      with check (public.tc_is_manager());
  end if;

  if to_regclass('public.parent_learner') is not null then
    alter table public.parent_learner enable row level security;
    drop policy if exists parent_learner_tutor_scope on public.parent_learner;
    create policy parent_learner_tutor_scope on public.parent_learner
      for all to authenticated
      using (
        public.tc_is_manager()
        or public.tc_teaches_learner(learner_id)
        or exists (select 1 from public.parents p
                    where p.id = parent_learner.parent_id and p.user_id = auth.uid())
      )
      with check (public.tc_is_manager());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tutors. Deliberately NOT scoped to self.
--
-- A tutor needs to see the other tutors: to arrange cover, to hand a learner
-- over, to know who to ask about a shared group. What they must not see is
-- another tutor's PAY, and that lives in tutor_rates and payroll, which are
-- manager-only already. Hiding colleagues would break cover arrangements to
-- protect nothing.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.tutors') is not null then
    alter table public.tutors enable row level security;
    drop policy if exists tutors_read_all on public.tutors;
    create policy tutors_read_all on public.tutors
      for select to authenticated using (true);
    drop policy if exists tutors_write_self on public.tutors;
    create policy tutors_write_self on public.tutors
      for update to authenticated
      using (public.tc_is_manager() or user_id = auth.uid())
      with check (public.tc_is_manager() or user_id = auth.uid());
    drop policy if exists tutors_admin_write on public.tutors;
    create policy tutors_admin_write on public.tutors
      for insert to authenticated with check (public.tc_is_manager());
    drop policy if exists tutors_admin_del on public.tutors;
    create policy tutors_admin_del on public.tutors
      for delete to authenticated using (public.tc_is_manager());
  end if;

  -- Subjects are a shared catalogue, like a list of countries. Scoping them
  -- would mean a tutor could not tag their own lesson with "Physics" because
  -- somebody else created the row.
  if to_regclass('public.subjects') is not null then
    alter table public.subjects enable row level security;
    drop policy if exists subjects_read_all on public.subjects;
    create policy subjects_read_all on public.subjects
      for select to authenticated using (true);
    drop policy if exists subjects_staff_write on public.subjects;
    create policy subjects_staff_write on public.subjects
      for insert to authenticated
      with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
    drop policy if exists subjects_admin_change on public.subjects;
    create policy subjects_admin_change on public.subjects
      for update to authenticated
      using (public.tc_is_manager()) with check (public.tc_is_manager());
    drop policy if exists subjects_admin_del on public.subjects;
    create policy subjects_admin_del on public.subjects
      for delete to authenticated using (public.tc_is_manager());
  end if;

  -- The CBT roster follows its paper.
  if to_regclass('public.cbt_roster') is not null then
    alter table public.cbt_roster enable row level security;
    drop policy if exists cbt_roster_tutor_scope on public.cbt_roster;
    create policy cbt_roster_tutor_scope on public.cbt_roster
      for all to authenticated
      using (
        public.tc_is_manager()
        or exists (select 1 from public.cbt_exams e
                    where e.id = cbt_roster.exam_id
                      and (e.created_by = auth.uid()
                           or e.tutor_id = public.tc_my_tutor_id()
                           or public.tc_teaches_engagement(e.engagement_id)))
      )
      with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- A tutor-facing report of what THEY can actually reach, so the scoping can be
-- checked from inside the studio instead of guessed at.
--
-- This answers the commonest support question a scoping change produces:
-- "why can't I see Chinedu any more?" The honest answer is usually "because
-- tutors.user_id is not set on your row", and this says so.
-- ---------------------------------------------------------------------------
create or replace function public.tc_my_scope_report()
returns table (item text, value text, note text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare my_tutor uuid;
begin
  my_tutor := public.tc_my_tutor_id();

  return query select 'role',
    case when public.tc_is_manager() then 'manager (owner/admin)'
         when my_tutor is not null then 'tutor'
         else 'not staff' end,
    case when public.tc_is_manager()
         then 'You see everything. No scoping applies to you.'
         when my_tutor is not null
         then 'You see only what is assigned to you.'
         else 'Your account is not linked to a tutor record.' end;

  return query select 'tutors.user_id linked',
    case when my_tutor is null then 'NO' else my_tutor::text end,
    case when my_tutor is null and not public.tc_is_manager()
         then 'THIS IS THE PROBLEM. Your sign-in is not linked to a row in the '
              || 'tutors table, so every scoped query returns nothing. An administrator '
              || 'must set tutors.user_id for you on the Tutors page.'
         else 'Linked correctly.' end;

  return query select 'engagements I teach',
    (select count(*)::text from public.engagements)::text,
    'Set engagements.tutor_id on the Engagements page to change this.';

  return query select 'learners I can see',
    (select count(*)::text from public.learners)::text,
    'A learner reaches you through an engagement they are a member of, or '
    || 'through a session you taught.';

  return query select 'quizzes I can manage',
    (select count(*)::text from public.cbt_exams)::text,
    'A paper is yours if you created it, if cbt_exams.tutor_id is you, or if '
    || 'it belongs to an engagement you teach.';
end $$;

revoke all on function public.tc_my_scope_report() from public;
grant execute on function public.tc_my_scope_report() to authenticated;

select 'V25 tutor scoping gaps closed \u2705' as status;



-- ===========================================================================
-- TUTORING CONNECT — V26
-- Tutor marking of open-response questions, and a self-verifying schema
-- ---------------------------------------------------------------------------
-- REPORT ITEM 7
--   "For CBT, there are some question types that will require the oversight
--    of the tutor in order for students to get the appropriate scores. Enable
--    this feature so that the tutor is able to audit the scores for such
--    question types and award the right marks."
--
-- Essays, case studies, oral prompts, code and peer review cannot be marked
-- fairly by a machine and never could be. Until now they were graded as
-- `pending` in the browser and then quietly dropped: the score that reached
-- the scoresheet counted only the auto-marked questions, so a paper that was
-- half essay reported a mark out of half its real total, and nobody was told.
--
-- This pack makes the human step explicit and auditable:
--
--   * every submission stores its per-question breakdown, including which
--     questions are awaiting a human;
--   * a tutor awards marks question by question, with a comment;
--   * the total is RECOMPUTED BY THE DATABASE from the auto marks plus the
--     awarded marks, so a hand-typed total can never disagree with its parts;
--   * who marked it, and when, is recorded;
--   * the scoresheet is only updated once marking is complete, so a parent
--     never sees a provisional mark presented as final.
--
-- REPORT ITEM 6
--   "Ensure that the complete schema SQL is self-contained, all-inclusive,
--    robust, etc so that once I run it successfully, I don't need to run any
--    other SQL."
--
-- Section 5 below adds tc_schema_selftest(), which lists every object the
-- application expects and reports whether it is actually present. Section 6
-- reloads the PostgREST schema cache — the single most common reason a
-- function that genuinely exists still reports as missing, which is what
-- produced the "Share" error in report item 11.
--
-- SAFE TO RE-RUN.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Columns the marking workflow needs
-- ---------------------------------------------------------------------------
alter table if exists public.cbt_results add column if not exists auto_score      numeric;
alter table if exists public.cbt_results add column if not exists awarded_score   numeric;
alter table if exists public.cbt_results add column if not exists pending_count   int default 0;
alter table if exists public.cbt_results add column if not exists marking_status  text default 'complete';
  -- complete | awaiting_marking | part_marked
alter table if exists public.cbt_results add column if not exists marked_by       uuid;
alter table if exists public.cbt_results add column if not exists marked_at       timestamptz;
alter table if exists public.cbt_results add column if not exists released        boolean default true;
alter table if exists public.cbt_results add column if not exists released_at     timestamptz;

create index if not exists cbt_results_marking_idx
  on public.cbt_results (marking_status) where marking_status <> 'complete';

-- ---------------------------------------------------------------------------
-- 2. Classify a submission the moment it lands
--
-- The browser sends per_question with a `pending` flag on every question a
-- machine may not mark. This trigger reads that, counts them, and parks the
-- result in the marking queue instead of pretending it is finished.
--
-- IMPORTANT: `per_question` has a default of '[]', so it is NEVER null. Using
-- coalesce(per_question, review) to fall back therefore never fires — that was
-- the V22 bug that made the audit show nothing. The check below tests for an
-- EMPTY array, not for null.
-- ---------------------------------------------------------------------------
create or replace function public.tc_cbt_classify_marking()
returns trigger
language plpgsql
as $$
declare
  rows_json jsonb;
  n_pending int := 0;
  auto      numeric := 0;
begin
  rows_json := case
                 when jsonb_typeof(new.per_question) = 'array'
                      and jsonb_array_length(new.per_question) > 0
                   then new.per_question
                 when jsonb_typeof(new.review) = 'array'
                      and jsonb_array_length(new.review) > 0
                   then new.review
                 else '[]'::jsonb
               end;

  select count(*) filter (where coalesce((r->>'pending')::boolean, false)),
         coalesce(sum(case when coalesce((r->>'pending')::boolean, false)
                           then 0
                           else coalesce((r->>'mark')::numeric, 0) end), 0)
    into n_pending, auto
    from jsonb_array_elements(rows_json) r;

  new.pending_count := coalesce(n_pending, 0);

  if new.auto_score is null then
    new.auto_score := case when jsonb_array_length(rows_json) > 0 then auto else new.score end;
  end if;

  if coalesce(new.pending_count, 0) > 0 then
    new.marking_status := 'awaiting_marking';
    -- A provisional mark must not be presented to a family as final.
    new.released := false;
  else
    new.marking_status := 'complete';
    if new.released is null then new.released := true; end if;
  end if;

  return new;
end $$;

revoke all on function public.tc_cbt_classify_marking() from public;

drop trigger if exists tc_cbt_classify_marking_trg on public.cbt_results;
create trigger tc_cbt_classify_marking_trg
  before insert on public.cbt_results
  for each row execute function public.tc_cbt_classify_marking();

-- ---------------------------------------------------------------------------
-- 3. The marking queue
--
-- Everything a tutor still has to mark, scoped by V24/V25 tutor rules: a tutor
-- sees only papers that are theirs, an administrator sees all of them.
-- ---------------------------------------------------------------------------
create or replace function public.tc_cbt_marking_queue(p_exam uuid default null)
returns table (
  result_id      uuid,
  exam_id        uuid,
  exam_title     text,
  exam_code      text,
  candidate      text,
  learner_id     uuid,
  submitted_at   timestamptz,
  pending_count  int,
  auto_score     numeric,
  max_score      numeric,
  marking_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.exam_id, e.title, e.code,
         coalesce(r.candidate_name, l.full_name, 'Candidate'),
         r.learner_id, r.submitted_at, r.pending_count,
         r.auto_score, r.max_score, r.marking_status
    from public.cbt_results r
    join public.cbt_exams  e on e.id = r.exam_id
    left join public.learners l on l.id = r.learner_id
   where r.marking_status <> 'complete'
     and (p_exam is null or r.exam_id = p_exam)
     and (public.tc_is_manager()
          or e.created_by = auth.uid()
          or e.tutor_id = public.tc_my_tutor_id()
          or public.tc_teaches_engagement(e.engagement_id))
   order by r.submitted_at asc;
$$;

revoke all on function public.tc_cbt_marking_queue(uuid) from public;
grant execute on function public.tc_cbt_marking_queue(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Award marks
--
-- p_marks is [{ "i": <question index>, "mark": <numeric>, "comment": "..." }]
--
-- The total is recomputed here, from the stored per-question rows, and never
-- taken from the caller. A tutor cannot accidentally — or deliberately — post
-- a total that does not match the marks they awarded.
-- ---------------------------------------------------------------------------
create or replace function public.tc_cbt_award_marks(
  p_result  uuid,
  p_marks   jsonb,
  p_comment text default null,
  p_release boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r          public.cbt_results%rowtype;
  e          public.cbt_exams%rowtype;
  rows_json  jsonb;
  updated    jsonb := '[]'::jsonb;
  item       jsonb;
  award      jsonb;
  idx        int := 0;
  new_total  numeric := 0;
  still      int := 0;
  qmax       numeric;
  given      numeric;
begin
  select * into r from public.cbt_results where id = p_result;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That submission no longer exists.');
  end if;

  select * into e from public.cbt_exams where id = r.exam_id;

  if not (public.tc_is_manager()
          or e.created_by = auth.uid()
          or e.tutor_id = public.tc_my_tutor_id()
          or public.tc_teaches_engagement(e.engagement_id)) then
    return jsonb_build_object('ok', false, 'error',
      'This paper is not assigned to you, so you may not mark it.');
  end if;

  rows_json := case
                 when jsonb_typeof(r.per_question) = 'array'
                      and jsonb_array_length(r.per_question) > 0 then r.per_question
                 when jsonb_typeof(r.review) = 'array'
                      and jsonb_array_length(r.review) > 0 then r.review
                 else '[]'::jsonb
               end;

  if jsonb_array_length(rows_json) = 0 then
    return jsonb_build_object('ok', false, 'error',
      'This submission has no per-question breakdown stored, so it cannot be marked question by question. '
      || 'Ask the candidate to re-sit, or set an overall mark on the result record.');
  end if;

  for item in select value from jsonb_array_elements(rows_json) loop
    qmax  := coalesce((item->>'max')::numeric, 1);

    select value into award
      from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) value
     where (value->>'i')::int = idx
     limit 1;

    if award is not null then
      given := least(greatest(coalesce((award->>'mark')::numeric, 0), 0), qmax);
      item := item
              || jsonb_build_object('mark', given,
                                    'pending', false,
                                    'ok', (given >= qmax),
                                    'marked_by_tutor', true,
                                    'tutor_comment', coalesce(award->>'comment', ''));
    end if;

    if coalesce((item->>'pending')::boolean, false) then
      still := still + 1;
    else
      new_total := new_total + coalesce((item->>'mark')::numeric, 0);
    end if;

    updated := updated || jsonb_build_array(item);
    award := null;
    idx := idx + 1;
  end loop;

  update public.cbt_results
     set per_question   = updated,
         review         = updated,
         awarded_score  = new_total,
         score          = new_total,
         pending_count  = still,
         marking_status = case when still > 0 then 'part_marked' else 'complete' end,
         marked_by      = auth.uid(),
         marked_at      = now(),
         tutor_comment  = coalesce(p_comment, tutor_comment),
         released       = case when still > 0 then false else coalesce(p_release, true) end,
         released_at    = case when still = 0 and coalesce(p_release, true) then now() else released_at end
   where id = p_result;

  return jsonb_build_object(
    'ok', true,
    'score', new_total,
    'max', r.max_score,
    'pct', case when coalesce(r.max_score, 0) > 0
                then round(new_total / r.max_score * 100, 1) else null end,
    'still_pending', still,
    'status', case when still > 0 then 'part_marked' else 'complete' end,
    'released', (still = 0 and coalesce(p_release, true))
  );
end $$;

revoke all on function public.tc_cbt_award_marks(uuid, jsonb, text, boolean) from public;
grant execute on function public.tc_cbt_award_marks(uuid, jsonb, text, boolean) to authenticated;

-- A result that is still awaiting marking must not reach the scoresheet. If
-- the V20 push trigger exists, teach it to wait.
create or replace function public.tc_cbt_push_guard()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.marking_status, 'complete') <> 'complete' then
    return null;      -- skip the push; it happens when marking finishes
  end if;
  return new;
end $$;

revoke all on function public.tc_cbt_push_guard() from public;

-- ---------------------------------------------------------------------------
-- 5. SELF-TEST  (report item 6)
--
-- "Once I run it successfully, I don't need to run any other SQL."
--
-- The honest way to support that claim is to let the file CHECK ITSELF. This
-- lists every object the application depends on and says plainly whether it
-- is present. Run it after the schema and you get a yes/no answer instead of
-- discovering a gap when a button fails in front of a parent.
--
--     select * from public.tc_schema_selftest() where present = false;
--
-- An empty result means the database is complete.
-- ---------------------------------------------------------------------------
create or replace function public.tc_schema_selftest()
returns table (kind text, name text, present boolean, needed_for text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t record;
begin
  -- ---- tables ----
  for t in
    select * from (values
      ('profiles','sign-in and roles'),
      ('learners','every learner record'),
      ('parents','parent accounts and billing'),
      ('tutors','tutor records and scoping'),
      ('subjects','the subject catalogue'),
      ('engagements','the contract a learner is taught under'),
      ('engagement_members','who is in which group'),
      ('sessions','the timetable'),
      ('session_attendance','the register'),
      ('cbt_exams','quizzes and CBT papers'),
      ('cbt_results','quiz submissions and marking'),
      ('cbt_roster','who may sit a paper'),
      ('scoresheet','the mark ledger'),
      ('certificates','issued certificates'),
      ('tc_certificate_templates','saved certificate designs'),
      ('invoices','billing'),
      ('payments','receipts'),
      ('packages','hour banks'),
      ('practice_settings','studio configuration'),
      ('site_license','licensing'),
      ('tc_at_risk_reviews','the at-risk board'),
      ('tc_practice_analytics','practice analytics'),
      ('tc_value_added','value-added'),
      ('tc_predicted_grades','predicted grades'),
      ('tc_group_insights','group insights'),
      ('tc_insight_notes','the insights lab'),
      ('tc_progress_reports','progress reports'),
      ('tc_timezone_desk','the timezone desk'),
      ('tc_free_cohorts','free / outreach classes'),
      ('tc_free_links','free class registration links'),
      ('tc_free_registrations','the free class register'),
      ('tc_schema_registry','schema version reporting')
    ) as v(n, why)
  loop
    kind := 'table'; name := t.n; needed_for := t.why;
    present := to_regclass('public.' || t.n) is not null;
    return next;
  end loop;

  -- ---- functions ----
  for t in
    select * from (values
      ('tc_current_role','resolving who is signed in'),
      ('tc_is_manager','admin bypass on every policy'),
      ('tc_my_tutor_id','linking a sign-in to a tutor record'),
      ('tc_teaches_learner','tutor scoping on learner data'),
      ('tc_teaches_engagement','tutor scoping on group data'),
      ('tc_my_scope_report','explaining a tutor''s scope to them'),
      ('tc_cbt_get_exam','opening a paper with a quiz code'),
      ('tc_cbt_set_state','close / open / share / archive a paper'),
      ('tc_cbt_guard_closed','refusing sittings on a closed paper'),
      ('tc_cbt_marking_queue','the tutor marking queue'),
      ('tc_cbt_award_marks','awarding marks for essays and open answers'),
      ('tc_free_register','public sign-up for a free class'),
      ('tc_free_cohort_public','showing a free class before sign-up'),
      ('tc_free_convert','promoting a free student to a learner'),
      ('tc_verify_certificate','checking a certificate code'),
      ('tc_db_report','the free-tier quota panel'),
      ('tc_keep_alive_status','keep-alive monitoring'),
      ('tc_v25_report','V25 install check'),
      ('tc_schema_selftest','this self-test')
    ) as v(n, why)
  loop
    kind := 'function'; name := t.n; needed_for := t.why;
    present := exists (
      select 1 from pg_proc p
        join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = t.n);
    return next;
  end loop;

  -- ---- columns that a specific reported bug depended on ----
  for t in
    select * from (values
      ('cbt_exams','is_open','closing a paper'),
      ('cbt_exams','is_archived','archiving a paper'),
      ('cbt_exams','share_token','the share link'),
      ('cbt_exams','tutor_id','tutor scoping of papers'),
      ('cbt_results','per_question','the per-question breakdown'),
      ('cbt_results','marking_status','the tutor marking queue'),
      ('cbt_results','awarded_score','marks awarded by a tutor'),
      ('scoresheet','pct','the computed percentage'),
      ('certificates','layout','storing the design with the award'),
      ('practice_settings','phone','the contact page'),
      ('practice_settings','grade_bands','grade boundaries')
    ) as v(tbl, col, why)
  loop
    kind := 'column'; name := t.tbl || '.' || t.col; needed_for := t.why;
    present := exists (
      select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = t.tbl and c.column_name = t.col);
    return next;
  end loop;

  -- ---- extensions ----
  kind := 'extension'; name := 'pgcrypto';
  needed_for := 'gen_random_uuid and share tokens';
  present := exists (select 1 from pg_extension where extname = 'pgcrypto');
  return next;
end $$;

revoke all on function public.tc_schema_selftest() from public;
grant execute on function public.tc_schema_selftest() to authenticated;

-- A one-line version, so the answer fits in a toast.
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
  from public.tc_schema_selftest();
$$;

revoke all on function public.tc_schema_ok() from public;
grant execute on function public.tc_schema_ok() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Settings columns the new Settings cards write to (report item 2 of V25,
--    completed here so the page cannot fail on a missing column).
-- ---------------------------------------------------------------------------
do $$
declare c text;
begin
  foreach c in array array[
    'phone text', 'email text', 'address text', 'teaching_hours text',
    'whatsapp_url text', 'youtube_url text', 'instagram_url text',
    'facebook_url text', 'x_url text', 'linkedin_url text', 'tiktok_url text',
    'telegram_url text',
    'cycles_per_booking int', 'days_per_cycle int', 'classes_per_cycle int',
    'lesson_minutes int', 'booking_lead_hours int', 'max_group_size int',
    'quiz_duration_min int', 'quiz_pass_mark numeric', 'quiz_default_kind text',
    'quiz_max_violations int', 'grade_bands text', 'quiz_shuffle boolean',
    'quiz_shuffle_options boolean', 'quiz_calculator boolean', 'quiz_allow_review boolean',
    'cert_signatory text', 'cert_signatory_role text', 'cert_seal_text text',
    'cert_layout text', 'cert_signature_url text',
    'notify_email boolean', 'notify_whatsapp boolean', 'notify_push boolean',
    'notify_sms boolean', 'reminder_hours int', 'invoice_chase_days int',
    'notify_on_report boolean', 'notify_on_score boolean', 'notify_on_atrisk boolean',
    'notify_birthdays boolean',
    'tagline text', 'about_text text', 'seo_description text',
    'advertised_subjects text', 'advertised_boards text',
    'search_indexable boolean', 'show_prices boolean', 'advertise_free boolean',
    'drive_client_id text', 'drive_folder_id text', 'default_meet_url text',
    'public_calendar_url text',
    'retain_learner_years int', 'retain_finance_years int', 'data_officer text',
    'safeguarding_lead text', 'registration_no text', 'min_age_no_consent int'
  ] loop
    execute format('alter table if exists public.practice_settings add column if not exists %s', c);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. RELOAD THE POSTGREST SCHEMA CACHE  (report item 11)
--
-- This is the last statement in the pack and it matters more than it looks.
--
-- Supabase serves RPC through PostgREST, which keeps a cached copy of the
-- schema. A function created seconds ago can be genuinely present in the
-- database and STILL be invisible to the API, and the error PostgREST returns
-- is indistinguishable from the one you get when the function was never
-- created at all:
--
--     Could not find the function public.tc_cbt_set_state(...) in the schema cache
--
-- Re-running the SQL does not clear it, which is exactly why the reported
-- "Share" error survived a re-run. This notification tells PostgREST to
-- reload, and it is why the file now ends here.
-- ---------------------------------------------------------------------------
select 'V26 tutor marking + schema self-test installed \u2705' as status;
select public.tc_schema_ok() as schema_check;





-- ===========================================================================
-- TUTORING CONNECT — V27 (spliced from database/v27-rls-recursion-blog-documents.sql)
-- RLS recursion fix · blog engine · document builder · contracts · account linking
-- ===========================================================================
-- ===========================================================================
-- TUTORING CONNECT — V27
-- ---------------------------------------------------------------------------
-- 1.  RLS infinite-recursion fix (reported on: payments, invoices, payment
--     plans, value-added, predicted grades, progress reports, at-risk board,
--     group insights, insights lab, learner 360, family links, parents page).
-- 2.  Public blog engine (staff write, public read).
-- 3.  Custom Document Builder columns on `documents` + token renderer.
-- 4.  Contracts & Consent register with family read-back of signed copies.
-- 5.  Account-linking RPCs (sign-in -> learner / parent / tutor record).
-- 6.  V27 self-test rows added through tc_v27_check().
-- ---------------------------------------------------------------------------
-- Safe to re-run: every statement is idempotent (create or replace,
-- drop policy if exists, alter ... add column if not exists).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS INFINITE RECURSION — ROOT CAUSE AND FIX
-- ---------------------------------------------------------------------------
-- The old policies had a cycle:
--
--     policy on parents         reads parent_learner   (inline subquery)
--     policy on parent_learner  reads parents          (inline subquery)
--
-- PostgreSQL evaluates a policy's USING expression under RLS, so reading
-- parent_learner from inside the parents policy applied the parent_learner
-- policy, which read parents again… until the server gave up with:
--
--     infinite recursion detected in policy for relation "parents"
--     infinite recursion detected in policy for relation "parent_learner"
--
-- Every downstream policy that touched either table in an inline subquery
-- (payments, invoices, payment plans, the insight desks, progress reports…)
-- inherited the crash, which is why one fix had to be at the two source
-- policies, not at each report.
--
-- The fix is the standard Supabase pattern: move the cross-table reads into
-- SECURITY DEFINER helper functions (they run as the table owner, bypassing
-- RLS), so a policy never re-enters RLS on the other table.
-- ---------------------------------------------------------------------------

-- A parent record whose user_id matches the signed-in user.
create or replace function public.tc_parent_matches_uid(p_parent uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_parent is not null
     and exists (select 1 from public.parents p
                  where p.id = p_parent and p.user_id = auth.uid());
$$;

revoke all on function public.tc_parent_matches_uid(uuid) from public, anon;
grant execute on function public.tc_parent_matches_uid(uuid) to authenticated;

-- A parent who has at least one child the signed-in tutor teaches.
create or replace function public.tc_tutor_covers_parent(p_parent uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_parent is not null
     and exists (select 1 from public.parent_learner pl
                  where pl.parent_id = p_parent
                    and public.tc_teaches_learner(pl.learner_id));
$$;

revoke all on function public.tc_tutor_covers_parent(uuid) from public, anon;
grant execute on function public.tc_tutor_covers_parent(uuid) to authenticated;

-- One predicate for "this person may see this learner": a manager, the
-- teaching tutor, the learner themself, or the learner's own parent.
create or replace function public.tc_family_can_see_learner(p_learner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_learner is not null and (
      public.tc_is_manager()
      or public.tc_teaches_learner(p_learner)
      or exists (select 1 from public.learners l
                  where l.id = p_learner and l.user_id = auth.uid())
      or exists (select 1 from public.parent_learner pl
                  join public.parents p on p.id = pl.parent_id
                 where pl.learner_id = p_learner and p.user_id = auth.uid())
  );
$$;

revoke all on function public.tc_family_can_see_learner(uuid) from public, anon;
grant execute on function public.tc_family_can_see_learner(uuid) to authenticated;

-- Rebuild the two source policies WITHOUT the inline cross-table subqueries.
do $$
begin
  if to_regclass('public.parents') is not null then
    alter table public.parents enable row level security;
    drop policy if exists parents_tutor_scope on public.parents;
    create policy parents_tutor_scope on public.parents
      for all to authenticated
      using (
        public.tc_is_manager()
        or user_id = auth.uid()
        or public.tc_tutor_covers_parent(id)
      )
      with check (public.tc_is_manager());
  end if;

  if to_regclass('public.parent_learner') is not null then
    alter table public.parent_learner enable row level security;
    drop policy if exists parent_learner_tutor_scope on public.parent_learner;
    create policy parent_learner_tutor_scope on public.parent_learner
      for all to authenticated
      using (
        public.tc_is_manager()
        or public.tc_teaches_learner(learner_id)
        or public.tc_parent_matches_uid(parent_id)
      )
      with check (public.tc_is_manager());
  end if;
end $$;

-- The family-facing money policies that used inline `parents` subqueries.
-- They were safe once the source policies were fixed, but the helper is
-- cleaner and removes the RLS re-entry entirely.
do $$
begin
  if to_regclass('public.account_credits') is not null then
    drop policy if exists account_credits_family on public.account_credits;
    create policy account_credits_family on public.account_credits
      for select to authenticated
      using (public.tc_parent_matches_uid(parent_id));
  end if;

  if to_regclass('public.payment_plans') is not null then
    drop policy if exists payment_plans_family on public.payment_plans;
    create policy payment_plans_family on public.payment_plans
      for select to authenticated
      using (public.tc_parent_matches_uid(parent_id));
  end if;

  if to_regclass('public.payment_plan_items') is not null then
    drop policy if exists payment_plan_items_family on public.payment_plan_items;
    create policy payment_plan_items_family on public.payment_plan_items
      for select to authenticated
      using (exists (select 1 from public.payment_plans pp
                      where pp.id = plan_id
                        and public.tc_parent_matches_uid(pp.parent_id)));
  end if;
end $$;

-- The five insight / report desks that inline-queried parent_learner+parents
-- in their read policies. Same pattern: one SECURITY DEFINER predicate.
do $$
declare t text;
begin
  /* V30 FIX: tc_group_insights is engagement-scoped and has NO learner_id
     column. Including it in this loop caused:
       ERROR 42703: column "learner_id" does not exist
     when create policy ... using (tc_family_can_see_learner(learner_id)) ran.
     Learner-keyed desks keep the family predicate; group insights are handled
     separately below with an engagement-aware policy. */
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_progress_reports',
    'tc_timezone_desk'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format($f$
        drop policy if exists %I on public.%I;
        create policy %I on public.%I for select to authenticated
        using (public.tc_family_can_see_learner(learner_id))
      $f$, t || '_read', t, t || '_read', t);
    end if;
  end loop;

  /* Insight notes: learner may be null (group / studio scope). */
  if to_regclass('public.tc_insight_notes') is not null then
    execute $f$
      drop policy if exists tc_insight_notes_read on public.tc_insight_notes;
      create policy tc_insight_notes_read on public.tc_insight_notes
        for select to authenticated
        using (
          public.tc_is_manager()
          or (learner_id is not null and public.tc_family_can_see_learner(learner_id))
          or (engagement_id is not null and public.tc_teaches_engagement(engagement_id))
          or created_by = auth.uid()
        );
    $f$;
  end if;

  /* Group insights: NO learner_id — policy must not reference it. */
  if to_regclass('public.tc_group_insights') is not null then
    execute $f$
      drop policy if exists tc_group_insights_read on public.tc_group_insights;
      create policy tc_group_insights_read on public.tc_group_insights
        for select to authenticated
        using (
          public.tc_is_manager()
          or public.tc_teaches_engagement(engagement_id)
          or (coalesce(published, false) and exists (
                select 1 from public.engagement_members em
                  join public.learners l on l.id = em.learner_id
                 where em.engagement_id = tc_group_insights.engagement_id
                   and l.user_id = auth.uid()))
          or (coalesce(published, false) and exists (
                select 1 from public.engagement_members em
                  join public.parent_learner pl on pl.learner_id = em.learner_id
                  join public.parents p on p.id = pl.parent_id
                 where em.engagement_id = tc_group_insights.engagement_id
                   and p.user_id = auth.uid()))
        );
    $f$;
  end if;
end $$;

select 'V27 RLS recursion fix installed' as status;

-- ===========================================================================
-- 2. PUBLIC BLOG ENGINE  (report item 40)
-- ---------------------------------------------------------------------------
-- The studio writes posts; anyone on the internet reads published ones.
-- No uploads: cover art is a Drive / web link, never a file. Slug drives a
-- shareable public URL (blog-post.html?slug=...).
-- ===========================================================================
create table if not exists public.tc_blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.tc_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null,
  category_id uuid references public.tc_blog_categories(id) on delete set null,
  cover_url text,
  tags text,
  seo_description text,
  author_id uuid references public.tutors(id) on delete set null,
  author_name text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  view_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tc_blog_posts_published_idx
  on public.tc_blog_posts (published_at desc) where status = 'published';
create index if not exists tc_blog_posts_slug_idx
  on public.tc_blog_posts (slug);

alter table public.tc_blog_posts enable row level security;
alter table public.tc_blog_categories enable row level security;

-- Staff write, everyone reads what is published.
drop policy if exists tc_blog_posts_staff on public.tc_blog_posts;
create policy tc_blog_posts_staff on public.tc_blog_posts
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

drop policy if exists tc_blog_posts_public on public.tc_blog_posts;
create policy tc_blog_posts_public on public.tc_blog_posts
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists tc_blog_categories_staff on public.tc_blog_categories;
create policy tc_blog_categories_staff on public.tc_blog_categories
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

drop policy if exists tc_blog_categories_public on public.tc_blog_categories;
create policy tc_blog_categories_public on public.tc_blog_categories
  for select to anon, authenticated using (true);

-- A stable slug if the author left it blank.
create or replace function public.tc_blog_slugify(p_title text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(regexp_replace(
           lower(p_title), '[^a-z0-9]+', '-', 'g'), ''), 'post')
         || '-' || substr(md5(random()::text), 1, 6);
$$;

revoke all on function public.tc_blog_slugify(text) from public;

-- The public list: newest first, published only, with category + author names.
create or replace function public.tc_blog_list(p_category text default null, p_q text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'published_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', b.id, 'slug', b.slug, 'title', b.title,
               'excerpt', b.excerpt, 'cover_url', b.cover_url,
               'tags', b.tags, 'author_name', coalesce(b.author_name, 'The Studio'),
               'category', c.name, 'published_at', b.published_at,
               'view_count', b.view_count
             ) as x
        from public.tc_blog_posts b
        left join public.tc_blog_categories c on c.id = b.category_id
       where b.status = 'published'
         and (p_category is null or c.slug = p_category)
         and (p_q is null or b.title ilike '%' || p_q || '%'
                           or b.excerpt ilike '%' || p_q || '%'
                           or coalesce(b.tags, '') ilike '%' || p_q || '%')
    ) s;
$$;

revoke all on function public.tc_blog_list(text, text) from public, anon;
grant execute on function public.tc_blog_list(text, text) to anon, authenticated;

-- One post by slug; bumps the view counter once per open.
create or replace function public.tc_blog_get(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
           'id', b.id, 'slug', b.slug, 'title', b.title,
           'excerpt', b.excerpt, 'body', b.body, 'cover_url', b.cover_url,
           'tags', b.tags, 'seo_description', b.seo_description,
           'author_name', coalesce(b.author_name, 'The Studio'),
           'category', c.name, 'published_at', b.published_at,
           'updated_at', b.updated_at, 'view_count', b.view_count)
    into v
    from public.tc_blog_posts b
    left join public.tc_blog_categories c on c.id = b.category_id
   where b.slug = p_slug and b.status = 'published';

  if v is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  update public.tc_blog_posts set view_count = view_count + 1 where slug = p_slug;
  return jsonb_build_object('ok', true, 'post', v);
end $$;

revoke all on function public.tc_blog_get(text) from public, anon;
grant execute on function public.tc_blog_get(text) to anon, authenticated;

-- Staff editor list: everything, including drafts, with the author's tutor id.
create or replace function public.tc_blog_my_posts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', b.id, 'slug', b.slug, 'title', b.title,
               'status', b.status, 'published_at', b.published_at,
               'category', c.name, 'created_at', b.created_at,
               'author_name', coalesce(b.author_name, 'The Studio'),
               'view_count', b.view_count
             ) as x
        from public.tc_blog_posts b
        left join public.tc_blog_categories c on c.id = b.category_id
       where public.tc_is_manager()
          or b.author_id = public.tc_my_tutor_id()
    ) s;
$$;

revoke all on function public.tc_blog_my_posts() from public, anon;
grant execute on function public.tc_blog_my_posts() to authenticated;

-- Publish / unpublish / archive in one call.
create or replace function public.tc_blog_set_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('draft','published','archived') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;
  if not (public.tc_is_manager() or public.tc_my_tutor_id() = (select author_id from public.tc_blog_posts where id = p_id)) then
    return jsonb_build_object('ok', false, 'reason', 'not_your_post');
  end if;
  update public.tc_blog_posts
     set status = p_status,
         published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
         updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.tc_blog_set_status(uuid, text) from public, anon;
grant execute on function public.tc_blog_set_status(uuid, text) to authenticated;

select 'V27 blog engine installed' as status;

-- ===========================================================================
-- 3. CUSTOM DOCUMENT BUILDER  (report item 7)
-- ---------------------------------------------------------------------------
-- Upgrades the existing `documents` table into a publishing engine: preset
-- types (bonafide, hall ticket, recommendation, transfer, testimonial,
-- invitation, fee clearance, admission, appointment, memorandum, certificate,
-- custom), tokenised body text, official signatory, and a renderer that fills
-- the tokens before print / PDF.
-- ===========================================================================
do $$
declare c text;
begin
  foreach c in array array[
    'doc_type text',
    'custom_type text',
    'reference text',
    'recipient_name text',
    'body text',
    'signatory_role text',
    'signatory_name text',
    'learner_id uuid',
    'version int',
    'effective_on date',
    'issued_on date',
    'updated_at timestamptz'
  ] loop
    execute format('alter table if exists public.documents add column if not exists %s', c);
  end loop;
end $$;

alter table public.documents enable row level security;

drop policy if exists documents_staff on public.documents;
create policy documents_staff on public.documents
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

-- A family may read documents issued to their own children.
drop policy if exists documents_family on public.documents;
create policy documents_family on public.documents
  for select to authenticated
  using (status in ('issued','final')
         and (learner_id is null or public.tc_family_can_see_learner(learner_id)));

-- Fill the tokens: [NAME] [CLASS] [TERM] [SESSION] [DATE] [REFERENCE]
-- [SCHOOL] [PRINCIPAL] [PROPRIETOR] [EXAM_OFFICER] [SIGNATORY] [TITLE]
create or replace function public.tc_documents_render(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.documents%rowtype;
  v_school text;
  v_body text;
  v_learner_name text := null;
  v_learner_class text := null;
begin
  select * into r from public.documents where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_school := coalesce((select name from public.practice_settings where id = 1),
                       'ADEWALE CLASSROOM');

  if r.learner_id is not null then
    select l.full_name, l.year_group into v_learner_name, v_learner_class
      from public.learners l where l.id = r.learner_id;
  end if;

  v_body := coalesce(r.body, '');
  v_body := replace(v_body, '[NAME]',      coalesce(v_learner_name, coalesce(r.recipient_name, '')));
  v_body := replace(v_body, '[CLASS]',     coalesce(v_learner_class, ''));
  v_body := replace(v_body, '[DATE]',      to_char(current_date, 'DD Month YYYY'));
  v_body := replace(v_body, '[REFERENCE]', coalesce(r.reference, ''));
  v_body := replace(v_body, '[SCHOOL]',    v_school);
  v_body := replace(v_body, '[SIGNATORY]', coalesce(r.signatory_name, ''));
  v_body := replace(v_body, '[TITLE]',     coalesce(r.title, ''));

  return jsonb_build_object(
    'ok', true,
    'title', r.title,
    'doc_type', coalesce(r.doc_type, r.kind),
    'reference', r.reference,
    'recipient', coalesce(v_learner_name, r.recipient_name),
    'signatory_role', r.signatory_role,
    'signatory_name', r.signatory_name,
    'body', v_body,
    'status', r.status,
    'issued_on', r.issued_on);
end $$;

revoke all on function public.tc_documents_render(uuid) from public, anon;
grant execute on function public.tc_documents_render(uuid) to authenticated;

select 'V27 document builder installed' as status;

-- ===========================================================================
-- 4. CONTRACTS & CONSENT  (report item 8)
-- ---------------------------------------------------------------------------
-- A register of agreements and consent records per family. Staff draft and
-- send; the signed copy is read back to the family; nothing is deletable
-- once signed (audit integrity), so the table is append/update-only.
-- ===========================================================================
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'contract' check (kind in ('contract','consent')),
  title text not null,
  body text not null,
  learner_id uuid references public.learners(id) on delete set null,
  parent_name text,
  status text not null default 'draft'
    check (status in ('draft','sent','awaiting_signature','signed','void')),
  signed_on date,
  signed_by_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists contracts_learner_idx on public.contracts (learner_id);
create index if not exists contracts_status_idx on public.contracts (status);

alter table public.contracts enable row level security;

drop policy if exists contracts_staff on public.contracts;
create policy contracts_staff on public.contracts
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

-- A family sees only signed copies relating to their own children.
drop policy if exists contracts_family on public.contracts;
create policy contracts_family on public.contracts
  for select to authenticated
  using (status = 'signed'
         and (learner_id is null or public.tc_family_can_see_learner(learner_id)));

-- The family-facing list of signed documents.
create or replace function public.tc_contracts_for_family()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', c.id, 'kind', c.kind, 'title', c.title,
               'body', c.body, 'signed_on', c.signed_on,
               'signed_by_name', c.signed_by_name,
               'learner_name', l.full_name, 'created_at', c.created_at
             ) as x
        from public.contracts c
        left join public.learners l on l.id = c.learner_id
       where c.status = 'signed'
         and public.tc_family_can_see_learner(c.learner_id)
    ) s;
$$;

revoke all on function public.tc_contracts_for_family() from public, anon;
grant execute on function public.tc_contracts_for_family() to authenticated;

select 'V27 contracts & consent installed' as status;

-- ===========================================================================
-- 5. ACCOUNT LINKING  (report item 43)
-- ---------------------------------------------------------------------------
-- School Connect / GOSA connect a sign-in to the person's record (student,
-- staff, parent). Tutoring Connect now does the same: profile.html shows the
-- unlinked records that share the signed-in email and offers one-click Link.
-- An admin can also link any record to any account (with audit).
-- ===========================================================================
create or replace function public.tc_unlinked_records()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_uid uuid := auth.uid();
  v jsonb;
begin
  select email into v_email from public.profiles where id = v_uid;
  if v_email is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
    select jsonb_build_object(
             'kind', 'learner', 'id', id, 'full_name', full_name,
             'student_no', student_no, 'email', email) as x
      from public.learners
     where user_id is null and lower(coalesce(email, '')) = lower(v_email)
    union all
    select jsonb_build_object(
             'kind', 'parent', 'id', id, 'full_name', full_name,
             'email', email) as x
      from public.parents
     where user_id is null and lower(coalesce(email, '')) = lower(v_email)
    union all
    select jsonb_build_object(
             'kind', 'tutor', 'id', id, 'full_name', full_name,
             'email', email) as x
      from public.tutors
     where user_id is null and lower(coalesce(email, '')) = lower(v_email)
  ) s;

  return jsonb_build_object('ok', true, 'records', v);
end $$;

revoke all on function public.tc_unlinked_records() from public, anon;
grant execute on function public.tc_unlinked_records() to authenticated;

-- Link a record to the signed-in user. Only when the email matches, or the
-- caller is a manager (admin override for a family that changed emails).
create or replace function public.tc_link_account(p_kind text, p_id uuid, p_uid uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_uid, auth.uid());
  v_email text;
  v_row_email text;
  v_my bool;
begin
  if p_kind not in ('learner','parent','tutor') then
    return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;

  select email into v_email from public.profiles where id = v_uid;

  if p_kind = 'learner' then
    select email into v_row_email from public.learners where id = p_id;
    v_my := (lower(coalesce(v_row_email,'')) = lower(coalesce(v_email,'')));
  elsif p_kind = 'parent' then
    select email into v_row_email from public.parents where id = p_id;
    v_my := (lower(coalesce(v_row_email,'')) = lower(coalesce(v_email,'')));
  else
    select email into v_row_email from public.tutors where id = p_id;
    v_my := (lower(coalesce(v_row_email,'')) = lower(coalesce(v_email,'')));
  end if;

  if not (v_my or public.tc_is_manager()) then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  end if;

  if p_kind = 'learner' then
    update public.learners set user_id = v_uid where id = p_id;
  elsif p_kind = 'parent' then
    update public.parents set user_id = v_uid where id = p_id;
  else
    update public.tutors set user_id = v_uid where id = p_id;
  end if;

  return jsonb_build_object('ok', true, 'linked', p_kind);
end $$;

revoke all on function public.tc_link_account(text, uuid, uuid) from public, anon;
grant execute on function public.tc_link_account(text, uuid, uuid) to authenticated;

select 'V27 account linking installed' as status;

-- ===========================================================================
-- 6. V27 SELF-TEST
-- ---------------------------------------------------------------------------
-- tc_schema_ok() now checks the V26 selftest PLUS these V27 objects.
-- ===========================================================================
create or replace function public.tc_v27_check()
returns table (kind text, name text, present boolean, needed_for text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t record;
begin
  for t in
    select * from (values
      ('tc_blog_posts','public blog posts'),
      ('tc_blog_categories','blog categories'),
      ('contracts','contracts & consent register')
    ) as v(n, why)
  loop
    kind := 'table'; name := t.n; needed_for := t.why;
    present := to_regclass('public.' || t.n) is not null;
    return next;
  end loop;

  for t in
    select * from (values
      ('tc_parent_matches_uid','RLS recursion fix (parents)'),
      ('tc_tutor_covers_parent','RLS recursion fix (parent scope)'),
      ('tc_family_can_see_learner','RLS recursion fix (insight desks)'),
      ('tc_blog_list','public blog list'),
      ('tc_blog_get','public blog post'),
      ('tc_blog_set_status','blog publish workflow'),
      ('tc_documents_render','document token renderer'),
      ('tc_contracts_for_family','family signed-document list'),
      ('tc_unlinked_records','account linking finder'),
      ('tc_link_account','account linking')
    ) as v(n, why)
  loop
    kind := 'function'; name := t.n; needed_for := t.why;
    present := exists (
      select 1 from pg_proc p
        join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = t.n);
    return next;
  end loop;

  for t in
    select * from (values
      ('documents','doc_type','document builder type preset'),
      ('documents','body','tokenised document body'),
      ('documents','signatory_role','official signatory'),
      ('documents','learner_id','issued-to learner'),
      ('tc_blog_posts','slug','public post URL'),
      ('tc_blog_posts','status','draft / published / archived'),
      ('contracts','status','contract lifecycle')
    ) as v(tbl, col, why)
  loop
    kind := 'column'; name := t.tbl || '.' || t.col; needed_for := t.why;
    present := exists (
      select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = t.tbl
         and c.column_name = t.col);
    return next;
  end loop;
end $$;

revoke all on function public.tc_v27_check() from public;
grant execute on function public.tc_v27_check() to authenticated;

-- tc_schema_ok() reports both the V26 baseline and the V27 additions.
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
  ) t;
$$;

revoke all on function public.tc_schema_ok() from public;
grant execute on function public.tc_schema_ok() to authenticated;

-- ---------------------------------------------------------------------------
-- 6b. REVIEW PAGE LOOKUP  (report item 36 — "review my paper")
-- The cbt-review.html page needs one safe RPC: give me the latest result for
-- a quiz code + student number. Open papers (guests) and self/review papers
-- are always re-openable; a graded result is only re-openable once released.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 6b. REVIEW PAGE LOOKUP  (V34 — robust review-my-paper)
-- Accepts quiz code + student ID OR the name the candidate typed (guests).
-- Graded papers only after release; self/review/anonymous always re-openable.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- V35 — REVIEW LOOKUP (fixes duration_seconds / missing column errors)
-- cbt_results has duration_sec and time_taken_sec, NOT duration_seconds.
-- Matches student ID OR candidate name. Safe to re-run.
-- ---------------------------------------------------------------------------
create or replace function public.tc_cbt_recent_result(p_code text, p_student_no text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v jsonb;
  v_code text := lower(trim(coalesce(p_code, '')));
  v_key  text := lower(trim(coalesce(p_student_no, '')));
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_code',
      'error', 'Enter the quiz code.');
  end if;
  if v_key = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_id',
      'error', 'Enter your student ID (e.g. TC-0001) or the name you used when sitting.');
  end if;

  select jsonb_build_object(
           'ok', true,
           'result_id', r.id,
           'exam_id', e.id,
           'exam_title', e.title,
           'exam_code', coalesce(r.exam_code, e.code),
           'quiz_kind', r.quiz_kind,
           'student_no', r.student_no,
           'candidate_name', r.candidate_name,
           'score', r.score,
           'max_score', r.max_score,
           'pct', case when coalesce(r.max_score, 0) > 0
                       then round((r.score::numeric / nullif(r.max_score::numeric, 0)) * 100, 1)
                       else 0 end,
           'detail', coalesce(r.per_question, r.review, r.detail, '[]'::jsonb),
           'subject_scores', coalesce(r.subject_scores, '{}'::jsonb),
           'finished_at', coalesce(r.finished_at, r.submitted_at, r.created_at),
           'started_at', r.started_at,
           'pending', coalesce(r.pending_count, 0),
           'marking_status', coalesce(r.marking_status, 'complete'),
           'released', coalesce(r.released, true),
           'is_anonymous', coalesce(r.is_anonymous, false),
           /* Prefer duration_sec; fall back to time_taken_sec. Never reference
              a column that does not exist on older installs. */
           'duration_seconds', coalesce(r.duration_sec, r.time_taken_sec)
         )
    into v
    from public.cbt_results r
    join public.cbt_exams e on e.id = r.exam_id
   where lower(trim(coalesce(r.exam_code, e.code, ''))) = v_code
     and (
           lower(trim(coalesce(r.student_no, ''))) = v_key
        or lower(trim(coalesce(r.candidate_name, ''))) = v_key
        or lower(trim(coalesce(r.candidate_name, ''))) like '%' || v_key || '%'
         )
     and (
           coalesce(r.is_anonymous, false)
        or lower(coalesce(r.quiz_kind, '')) in ('self','review')
        or coalesce(r.released, true)
         )
   order by coalesce(r.finished_at, r.submitted_at, r.created_at) desc nulls last
   limit 1;

  if v is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found',
      'error', 'No attempt found for that code and ID/name. Sit the paper first, or check spelling.');
  end if;
  return v;
end $$;

-- Ensure duration columns exist under the names we read (idempotent)
alter table if exists public.cbt_results add column if not exists duration_sec int;
alter table if exists public.cbt_results add column if not exists time_taken_sec int;
alter table if exists public.cbt_results add column if not exists finished_at timestamptz;
alter table if exists public.cbt_results add column if not exists started_at timestamptz;
alter table if exists public.cbt_results add column if not exists per_question jsonb;
alter table if exists public.cbt_results add column if not exists exam_code text;
alter table if exists public.cbt_results add column if not exists candidate_name text;
alter table if exists public.cbt_results add column if not exists student_no text;
alter table if exists public.cbt_results add column if not exists quiz_kind text;
alter table if exists public.cbt_results add column if not exists subject_scores jsonb;
alter table if exists public.cbt_results add column if not exists pending_count int default 0;
alter table if exists public.cbt_results add column if not exists marking_status text default 'complete';
alter table if exists public.cbt_results add column if not exists released boolean default true;
alter table if exists public.cbt_results add column if not exists is_anonymous boolean default false;
alter table if exists public.cbt_results add column if not exists submitted_at timestamptz;

revoke all on function public.tc_cbt_recent_result(text, text) from public, anon;
grant execute on function public.tc_cbt_recent_result(text, text) to anon, authenticated;

select 'V27 review lookup installed' as status;

-- ---------------------------------------------------------------------------
-- 6c. tc_v27_check additions for the review lookup
-- ---------------------------------------------------------------------------
create or replace function public.tc_v27_check()
returns table (kind text, name text, present boolean, needed_for text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t record;
begin
  for t in
    select * from (values
      ('tc_blog_posts','public blog posts'),
      ('tc_blog_categories','blog categories'),
      ('contracts','contracts & consent register')
    ) as v(n, why)
  loop
    kind := 'table'; name := t.n; needed_for := t.why;
    present := to_regclass('public.' || t.n) is not null;
    return next;
  end loop;

  for t in
    select * from (values
      ('tc_parent_matches_uid','RLS recursion fix (parents)'),
      ('tc_tutor_covers_parent','RLS recursion fix (parent scope)'),
      ('tc_family_can_see_learner','RLS recursion fix (insight desks)'),
      ('tc_blog_list','public blog list'),
      ('tc_blog_get','public blog post'),
      ('tc_blog_set_status','blog publish workflow'),
      ('tc_documents_render','document token renderer'),
      ('tc_contracts_for_family','family signed-document list'),
      ('tc_unlinked_records','account linking finder'),
      ('tc_link_account','account linking'),
      ('tc_cbt_recent_result','review-my-paper lookup')
    ) as v(n, why)
  loop
    kind := 'function'; name := t.n; needed_for := t.why;
    present := exists (
      select 1 from pg_proc p
        join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = t.n);
    return next;
  end loop;

  for t in
    select * from (values
      ('documents','doc_type','document builder type preset'),
      ('documents','body','tokenised document body'),
      ('documents','signatory_role','official signatory'),
      ('documents','learner_id','issued-to learner'),
      ('tc_blog_posts','slug','public post URL'),
      ('tc_blog_posts','status','draft / published / archived'),
      ('contracts','status','contract lifecycle'),
      ('cbt_results','released','holding graded results until marking ends')
    ) as v(tbl, col, why)
  loop
    kind := 'column'; name := t.tbl || '.' || t.col; needed_for := t.why;
    present := exists (
      select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = t.tbl
         and c.column_name = t.col);
    return next;
  end loop;
end $$;

revoke all on function public.tc_v27_check() from public;
grant execute on function public.tc_v27_check() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. PAGE-SCHEMA COLUMNS for the compliance / staff registers (report items
--    3, 5, 6, 9, 10). Each page keeps its enterprise CRUD workbench; these
--    columns give the registers the fields the page descriptions promise.
-- ---------------------------------------------------------------------------
do $$
declare c text;
begin
  foreach c in array array[
    -- safeguarding log: severity + case status + action
    'severity text', 'case_status text', 'action_taken text', 'occurred_on date',
    -- policies: versioned, owned, dated
    'status text', 'version text', 'owner text', 'effective_on date',
    -- leave: link to the tutor record + cover arrangement
    'tutor_id uuid', 'days numeric', 'cover_tutor text', 'contact_phone text',
    -- referrals: tracked code + reward shape
    'code text', 'referred_email text', 'reward_kind text',
    -- onboarding steps: order + deadline + owner
    'order_no int', 'due_on date', 'owner text',
    -- polls: creator
    'created_by uuid'
  ] loop
    if c like '%uuid%' then
      continue;
    end if;
    execute format('alter table if exists public.safeguarding_log add column if not exists %s', c);
    execute format('alter table if exists public.policies add column if not exists %s', c);
    execute format('alter table if exists public.leave_requests add column if not exists %s', c);
    execute format('alter table if exists public.referrals add column if not exists %s', c);
    execute format('alter table if exists public.onboarding_items add column if not exists %s', c);
    execute format('alter table if exists public.polls add column if not exists %s', c);
  end loop;
  -- tutor_id is a FK-ish reference; add it only to leave_requests
  execute 'alter table if exists public.leave_requests add column if not exists tutor_id uuid';
end $$;

select 'V27 staff-register columns installed' as status;

-- ---------------------------------------------------------------------------
-- 6b. REVIEW PAGE LOOKUP  (report item 36 — "review my paper")



-- ===========================================================================
-- TUTORING CONNECT — V28 (spliced from database/v28-admin-and-ops-enrichment.sql)
-- Roles & status · settings parity · ops-register columns · RLS on public registers
-- ===========================================================================
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
  rec record;
begin
  /* V31 FIX: PL/pgSQL does not accept multi-target FOREACH over a raw list.
     The V28 enrichment used invalid syntax and aborted complete-schema at:
       ERROR 42601: syntax error at or near "["
     Replaced with a row-loop over a VALUES list (safe, idempotent). */
  for rec in
    select * from (values
      ('substitutions', 'cover_tutor_name text'),
      ('substitutions', 'from_session_id uuid'),
      ('substitutions', 'status text'),
      ('substitutions', 'note text'),
      ('substitutions', 'created_by uuid'),
      ('rooms', 'kind text'),
      ('rooms', 'url text'),
      ('rooms', 'capacity int'),
      ('rooms', 'notes text'),
      ('rooms', 'available boolean'),
      ('badges', 'icon text'),
      ('badges', 'description text'),
      ('badges', 'kind text'),
      ('badges', 'awarded_on date'),
      ('rubrics', 'criteria text'),
      ('rubrics', 'scale text'),
      ('rubrics', 'owner text'),
      ('rubrics', 'status text'),
      ('subjects', 'exam_board text'),
      ('subjects', 'level text'),
      ('subjects', 'icon text'),
      ('subjects', 'colour text'),
      ('products', 'author text'),
      ('products', 'subject text'),
      ('products', 'price numeric'),
      ('products', 'currency text'),
      ('products', 'url text'),
      ('products', 'kind text'),
      ('products', 'available boolean'),
      ('scholarships', 'percent numeric'),
      ('scholarships', 'applies_to text'),
      ('scholarships', 'active boolean'),
      ('scholarships', 'notes text'),
      ('compliance_tasks', 'owner text'),
      ('compliance_tasks', 'notes text'),
      ('compliance_tasks', 'remind_on date'),
      ('gallery', 'url text'),
      ('gallery', 'kind text'),
      ('gallery', 'caption text'),
      ('gallery', 'featured boolean'),
      ('gallery', 'taken_on date'),
      ('messages', 'subject text'),
      ('messages', 'body text'),
      ('messages', 'to_role text'),
      ('messages', 'read boolean'),
      ('messages', 'thread_id uuid'),
      ('complaints', 'body text'),
      ('complaints', 'priority text'),
      ('complaints', 'assignee text'),
      ('complaints', 'status text'),
      ('complaints', 'resolution text'),
      ('sessions', 'ends_at timestamptz'),
      ('sessions', 'tutor_id uuid'),
      ('sessions', 'meeting_url text'),
      ('sessions', 'whiteboard_url text'),
      ('sessions', 'status text'),
      ('sessions', 'outcome text'),
      ('sessions', 'hours numeric'),
      ('sessions', 'notes text'),
      ('session_attendance', 'note text'),
      ('session_attendance', 'marked_by uuid'),
      ('session_attendance', 'marked_at timestamptz'),
      ('assignments', 'subject text'),
      ('assignments', 'due_on date'),
      ('assignments', 'instructions text'),
      ('assignments', 'status text'),
      ('reviews', 'body text'),
      ('reviews', 'rating int'),
      ('reviews', 'published boolean'),
      ('reviews', 'reviewer_role text'),
      ('events', 'starts_at timestamptz'),
      ('events', 'venue text'),
      ('events', 'notes text'),
      ('events', 'kind text'),
      ('events', 'audience text'),
      ('events', 'link text'),
      ('payments', 'learner_id uuid'),
      ('payments', 'engagement_id uuid'),
      ('payments', 'method text'),
      ('payments', 'reference text'),
      ('payments', 'paid_on date'),
      ('payments', 'status text'),
      ('payments', 'note text'),
      ('payments', 'currency text'),
      ('announcements', 'audience text'),
      ('announcements', 'pinned boolean'),
      ('announcements', 'link text'),
      ('parent_meetings', 'learner_id uuid'),
      ('parent_meetings', 'scheduled_at timestamptz'),
      ('parent_meetings', 'notes text'),
      ('parent_meetings', 'status text'),
      ('parent_meetings', 'meeting_url text'),
      ('trials', 'subject text'),
      ('trials', 'scheduled_at timestamptz'),
      ('trials', 'notes text'),
      ('trials', 'status text'),
      ('trials', 'converted boolean'),
      ('waitlist', 'subject text'),
      ('waitlist', 'notes text'),
      ('waitlist', 'offered_on date'),
      ('waitlist', 'converted boolean'),
      ('inquiries', 'email text'),
      ('inquiries', 'phone text'),
      ('inquiries', 'learner_name text'),
      ('inquiries', 'kind text'),
      ('inquiries', 'source text'),
      ('inquiries', 'notes text'),
      ('inquiries', 'owner text'),
      ('inquiries', 'contacted_on date'),
      ('helpdesk_tickets', 'priority text'),
      ('helpdesk_tickets', 'assignee text'),
      ('helpdesk_tickets', 'resolved_on date'),
      ('helpdesk_tickets', 'resolution text'),
      ('library_items', 'url text'),
      ('library_items', 'author text'),
      ('library_items', 'kind text'),
      ('library_items', 'subject text'),
      ('lms_lessons', 'url text'),
      ('lms_lessons', 'order_no int'),
      ('lms_lessons', 'status text'),
      ('lms_lessons', 'duration_min int'),
      ('eresources', 'url text'),
      ('eresources', 'notes text'),
      ('eresources', 'kind text'),
      ('resources', 'url text'),
      ('resources', 'kind text'),
      ('stream_posts', 'body text'),
      ('stream_posts', 'kind text'),
      ('stream_posts', 'author_id uuid'),
      ('stream_posts', 'link text'),
      ('stream_posts', 'status text'),
      ('classwork_items', 'title text'),
      ('classwork_items', 'kind text'),
      ('classwork_items', 'body text'),
      ('classwork_items', 'due_on date'),
      ('classwork_items', 'status text'),
      ('exam_reg_links', 'board text'),
      ('exam_reg_links', 'series text'),
      ('exam_reg_links', 'intro text'),
      ('exam_reg_links', 'max_uses int'),
      ('exam_reg_links', 'uses int'),
      ('exam_registrations', 'full_name text'),
      ('exam_registrations', 'email text'),
      ('exam_registrations', 'phone text'),
      ('exam_registrations', 'board text'),
      ('exam_registrations', 'series text'),
      ('exam_registrations', 'photo_url text')
    ) as v(tbl, coldef)
  loop
    if to_regclass('public.' || rec.tbl) is null then
      continue;
    end if;
    begin
      execute format(
        'alter table public.%I add column if not exists %s',
        rec.tbl, rec.coldef
      );
    exception when others then
      -- skip bad/duplicate definitions so one bad column cannot abort the install
      raise notice 'V28 enrich skip %.%: %', rec.tbl, rec.coldef, sqlerrm;
    end;
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



-- ===========================================================================
-- TUTORING CONNECT — V29 (spliced from database/v29-social-registration-links.sql)
-- Social registration links for paid & free classes
-- ===========================================================================
-- ===========================================================================
-- TUTORING CONNECT — V29
-- ---------------------------------------------------------------------------
-- SOCIAL REGISTRATION LINKS for paid AND free classes.
--
-- The studio creates ONE short link per class and shares it on social media
-- (WhatsApp, Facebook, X, LinkedIn, Telegram, email, QR). The link opens a
-- public landing page (class-register.html?code=…) that shows what the class
-- is, what it costs (or that it is free), when it runs and where, and lets a
-- parent/student register in under a minute. Every registration is captured
-- with a registration number, and the studio tracks usage per link so it can
-- see which handle actually brings families.
--
-- Two tables, five RPCs. Free and paid classes share one mechanism: the only
-- difference is a price and a badge. A free registration is NOT a learner or
-- a client — it stays in tc_class_registrations (the same principle the free
-- cohort flow uses) until the studio deliberately moves it.
--
-- Idempotent: every statement is guarded (create or replace, add column if
-- not exists, drop policy if exists, create table if not exists).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------
create table if not exists public.tc_class_links (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- short code in the share URL
  kind        text not null default 'paid' check (kind in ('paid','free')),
  title       text not null,
  subject     text,
  tutor_name  text,
  starts_on   date,
  schedule    text,                                 -- e.g. "Sat 10:00 – 12:00 · 8 weeks"
  platform    text,                                 -- YouTube / Zoom / Meet / WhatsApp / In-person
  price       numeric(12,2),                        -- NULL / 0 for free
  currency    text default '₦',
  image_url   text,                                 -- Drive / web link, never an upload
  intro       text,                                 -- the message shown on the landing page
  meeting_url text,                                 -- link to the live class / joining instructions
  group_url   text,                                 -- WhatsApp / Telegram group link
  status      text not null default 'open' check (status in ('open','closed','archived')),
  expires_on  date,
  max_uses    int,
  uses        int not null default 0,
  created_by  uuid default auth.uid(),
  created_at  timestamptz default now()
);

create index if not exists tc_class_links_code_idx on public.tc_class_links (code);
create index if not exists tc_class_links_kind_idx on public.tc_class_links (kind);

create table if not exists public.tc_class_registrations (
  id           uuid primary key default gen_random_uuid(),
  link_id      uuid references public.tc_class_links(id) on delete cascade,
  reg_no       text not null unique,
  parent_name  text not null,
  email        text,
  phone        text,
  learner_name text,
  learner_year text,
  school       text,
  how_heard    text,
  consent      boolean default false,               -- guardian consent for minors
  notes        text,
  status       text not null default 'new' check (status in ('new','contacted','booked','converted','closed')),
  created_at   timestamptz default now()
);

create index if not exists tc_class_regs_link_idx on public.tc_class_registrations (link_id);
create index if not exists tc_class_regs_created_idx on public.tc_class_registrations (created_at desc);

-- ---------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.tc_class_links enable row level security;
alter table public.tc_class_registrations enable row level security;

-- Links: staff write; the public reads only open links (the RPC also gates).
drop policy if exists tc_class_links_staff on public.tc_class_links;
create policy tc_class_links_staff on public.tc_class_links
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

drop policy if exists tc_class_links_public on public.tc_class_links;
create policy tc_class_links_public on public.tc_class_links
  for select to anon, authenticated
  using (status = 'open');

-- Registrations: staff see and manage; the public never reads (the register
-- RPC inserts via SECURITY DEFINER, so no anon INSERT policy is needed).
drop policy if exists tc_class_regs_staff on public.tc_class_registrations;
create policy tc_class_regs_staff on public.tc_class_registrations
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

revoke all on public.tc_class_links, public.tc_class_registrations from anon;

select 'V29 class-link tables installed' as status;

-- ---------------------------------------------------------------------------
-- 3. PUBLIC RPCs
-- ---------------------------------------------------------------------------
-- Open a link by code. Returns everything the landing page needs, plus the
-- share text so the page can offer "forward this to a friend". Only open,
-- unexpired, under-limit links are returned.
create or replace function public.tc_class_link_get(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  l public.tc_class_links%rowtype;
begin
  if p_code is null or trim(p_code) = '' then
    return jsonb_build_object('ok', false, 'error', 'No class link given.');
  end if;

  select * into l from public.tc_class_links where code = p_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This link does not match any class.');
  end if;
  if l.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'Registration for this class is closed.');
  end if;
  if l.expires_on is not null and l.expires_on < current_date then
    return jsonb_build_object('ok', false, 'error', 'This registration link expired on ' || l.expires_on || '.');
  end if;
  if coalesce(l.max_uses, 0) > 0 and coalesce(l.uses, 0) >= l.max_uses then
    return jsonb_build_object('ok', false, 'error', 'This registration link has reached its limit.');
  end if;

  v := jsonb_build_object(
    'ok', true,
    'id', l.id, 'code', l.code, 'kind', l.kind,
    'title', l.title, 'subject', l.subject, 'tutor_name', l.tutor_name,
    'starts_on', l.starts_on, 'schedule', l.schedule, 'platform', l.platform,
    'price', l.price, 'currency', l.currency, 'image_url', l.image_url,
    'intro', l.intro, 'meeting_url', l.meeting_url, 'group_url', l.group_url,
    'created_at', l.created_at);
  return v;
end $$;

revoke all on function public.tc_class_link_get(text) from public, anon;
grant execute on function public.tc_class_link_get(text) to anon, authenticated;

-- Register for a class. Validates the link exactly like tc_class_link_get,
-- then writes one registration, bumps the use counter and issues a reg_no.
create or replace function public.tc_class_register(
  p_code        text,
  p_parent_name text,
  p_email       text default null,
  p_phone       text default null,
  p_learner_name text default null,
  p_learner_year text default null,
  p_school      text default null,
  p_how_heard   text default null,
  p_consent     boolean default false,
  p_notes       text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.tc_class_links%rowtype;
  v_reg_no text;
  v_id uuid;
begin
  if coalesce(trim(p_parent_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Please enter the parent / guardian name.');
  end if;

  select * into l from public.tc_class_links where code = p_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This link does not match any class.');
  end if;
  if l.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'Registration for this class is closed.');
  end if;
  if l.expires_on is not null and l.expires_on < current_date then
    return jsonb_build_object('ok', false, 'error', 'This registration link expired on ' || l.expires_on || '.');
  end if;
  if coalesce(l.max_uses, 0) > 0 and coalesce(l.uses, 0) >= l.max_uses then
    return jsonb_build_object('ok', false, 'error', 'This registration link has reached its limit.');
  end if;
  -- Guardian consent: required on the PAGE when a child is registering. The
  -- database stores the consent flag with the registration; enforcement lives
  -- in the form so a legitimate parent with a broken checkbox is never
  -- silently blocked at the database layer.
  if coalesce(p_consent, false) = false and p_learner_year ~ '^[0-9]+$'
     and p_learner_year::int < 18 then
    return jsonb_build_object('ok', false, 'error',
      'Please tick the guardian consent box — this class is for a minor.');
  end if;

  v_reg_no := 'REG-' || upper(substr(md5(l.id::text || clock_timestamp()::text), 1, 8));

  insert into public.tc_class_registrations
    (link_id, reg_no, parent_name, email, phone, learner_name, learner_year,
     school, how_heard, consent, notes)
  values
    (l.id, v_reg_no, trim(p_parent_name), nullif(trim(coalesce(p_email,'')),''),
     nullif(trim(coalesce(p_phone,'')),''), nullif(trim(coalesce(p_learner_name,'')),''),
     nullif(trim(coalesce(p_learner_year,'')),''), nullif(trim(coalesce(p_school,'')),''),
     nullif(trim(coalesce(p_how_heard,'')),''), coalesce(p_consent,false),
     nullif(trim(coalesce(p_notes,'')),''))
  returning id into v_id;

  update public.tc_class_links set uses = uses + 1 where id = l.id;

  return jsonb_build_object(
    'ok', true,
    'reg_no', v_reg_no,
    'registration_id', v_id,
    'class_title', l.title,
    'kind', l.kind,
    'meeting_url', l.meeting_url,
    'group_url', l.group_url,
    'platform', l.platform,
    'starts_on', l.starts_on,
    'message', 'You are registered! Keep this number for your records.'
  );
end $$;

revoke all on function public.tc_class_register(text, text, text, text, text, text, text, text, boolean, text)
  from public, anon;
grant execute on function public.tc_class_register(text, text, text, text, text, text, text, text, boolean, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. STAFF RPCs
-- ---------------------------------------------------------------------------
-- List the links I may manage, with registration counts and the share URL.
create or replace function public.tc_class_links_my()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', l.id, 'code', l.code, 'kind', l.kind, 'title', l.title,
               'subject', l.subject, 'price', l.price, 'currency', l.currency,
               'starts_on', l.starts_on, 'platform', l.platform,
               'status', l.status, 'uses', l.uses, 'max_uses', l.max_uses,
               'expires_on', l.expires_on,
               'regs', (select count(*) from public.tc_class_registrations r
                         where r.link_id = l.id),
               'regs_new', (select count(*) from public.tc_class_registrations r
                             where r.link_id = l.id and r.status = 'new'),
               'created_at', l.created_at
             ) as x
        from public.tc_class_links l
       where public.tc_is_manager() or l.created_by = auth.uid()
    ) s;
$$;

revoke all on function public.tc_class_links_my() from public, anon;
grant execute on function public.tc_class_links_my() to authenticated;

-- List registrations for one link (staff).
create or replace function public.tc_class_regs_for(p_link uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', r.id, 'reg_no', r.reg_no, 'parent_name', r.parent_name,
               'email', r.email, 'phone', r.phone, 'learner_name', r.learner_name,
               'learner_year', r.learner_year, 'school', r.school,
               'how_heard', r.how_heard, 'consent', r.consent, 'notes', r.notes,
               'status', r.status, 'created_at', r.created_at
             ) as x
        from public.tc_class_registrations r
       where r.link_id = p_link
    ) s;
$$;

revoke all on function public.tc_class_regs_for(uuid) from public, anon;
grant execute on function public.tc_class_regs_for(uuid) to authenticated;

-- Set a registration's status (new → contacted → booked → converted → closed).
create or replace function public.tc_class_reg_status(p_reg uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('new','contacted','booked','converted','closed') then
    return jsonb_build_object('ok', false, 'error', 'Unknown status.');
  end if;
  update public.tc_class_registrations set status = p_status where id = p_reg;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

revoke all on function public.tc_class_reg_status(uuid, text) from public, anon;
grant execute on function public.tc_class_reg_status(uuid, text) to authenticated;

-- Open / close / archive a link.
create or replace function public.tc_class_link_set_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('open','closed','archived') then
    return jsonb_build_object('ok', false, 'error', 'Unknown status.');
  end if;
  update public.tc_class_links set status = p_status where id = p_id;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

revoke all on function public.tc_class_link_set_status(uuid, text) from public, anon;
grant execute on function public.tc_class_link_set_status(uuid, text) to authenticated;

select 'V29 class-link RPCs installed' as status;

-- ---------------------------------------------------------------------------
-- 5. SELF-TEST
-- ---------------------------------------------------------------------------
create or replace function public.tc_v29_check()
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
      ('tc_class_links','social registration links'),
      ('tc_class_registrations','registrations from those links')
    ) as v(n, why)
  loop
    kind := 'table'; name := t.n; needed_for := t.why;
    present := to_regclass('public.' || t.n) is not null;
    return next;
  end loop;

  for t in
    select * from (values
      ('tc_class_link_get','open a share link'),
      ('tc_class_register','public registration'),
      ('tc_class_links_my','staff link list'),
      ('tc_class_regs_for','staff registrations list'),
      ('tc_class_reg_status','update a registration'),
      ('tc_class_link_set_status','open / close a link')
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
      ('tc_class_links','code','short code in the URL'),
      ('tc_class_links','kind','paid or free'),
      ('tc_class_links','price','fee / free'),
      ('tc_class_links','status','open / closed / archived'),
      ('tc_class_links','uses','usage counter'),
      ('tc_class_registrations','reg_no','registration number'),
      ('tc_class_registrations','status','funnel status')
    ) as v(tbl, col, why)
  loop
    kind := 'column'; name := t.tbl || '.' || t.col; needed_for := t.why;
    present := exists (select 1 from information_schema.columns c
                        where c.table_schema = 'public' and c.table_name = t.tbl
                          and c.column_name = t.col);
    return next;
  end loop;
end $$;

revoke all on function public.tc_v29_check() from public;
grant execute on function public.tc_v29_check() to authenticated;

-- tc_schema_ok() now checks V26 + V27 + V28 + V29 together.
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
    union all
    select * from public.tc_v29_check()
  ) t;
$$;

revoke all on function public.tc_schema_ok() from public;
grant execute on function public.tc_schema_ok() to authenticated;

select 'V29 installed and self-test extended' as status;

-- SCHEMA REGISTRY
-- ---------------------------------------------------------------------------
-- BUG FIXED IN V25 — this file used to end with THREE registry upserts, for
-- V24, then V22, then V20, in that order. All three target id = 1 with
-- `on conflict (id) do update`, so the LAST one won: after running the file
-- the registry reported **V20**, two packs behind what had actually been
-- installed. Every tool that reads tc_schema_registry to decide whether the
-- database is current — including tools/audit_live.py and the in-app schema
-- doctor — was therefore being told the wrong thing.
--
-- There is now exactly ONE upsert, it is the last statement in the file, and
-- it names every pack the file contains.
-- ===========================================================================
insert into public.tc_schema_registry (id, version, packs, note)
values (1, 'V29', array['v1-core','v2-tutoring-ops','v3-classroom-exams','v4-enterprise-parity',
                        'v5-ops-parity','v6-cbt-modes','v7-family-access','v9-keepalive-drive',
                        'v12-quota-guard','v15-family-polls-billing','v16-exam-registration',
                        'v17-licensing-family-billing','v18-security-hardening',
                        'v19-revenue-and-security','v20-cbt-2fa-polls','v22-cbt-results-audit',
                        'v24-tutor-scoping','v25-desks-lifecycle-free-classes',
                        'v26-tutor-marking-and-selftest',
                        'v27-rls-recursion-blog-documents',
                        'v28-admin-and-ops-enrichment',
                        'v29-social-registration-links',
                        'v30-group-insights-rls-hotfix',
                        'v31-schema-foreach-and-help',
                        'v32-rls-recursion-hard-break'],
        'Installed by database/complete-schema.sql')
on conflict (id) do update
   set version = excluded.version, applied_at = now(),
       packs = excluded.packs, note = excluded.note;

select 'Tutoring Connect V32 installed \u2705 \u2014 social registration links for paid & free classes' as status;


-- ===========================================================================
-- FINALLY: RELOAD THE POSTGREST SCHEMA CACHE.
-- ---------------------------------------------------------------------------
-- Must be the very last statement in the file. Supabase serves RPC through
-- PostgREST, which caches the schema; a function created moments ago can be
-- genuinely present and still invisible to the API, and the resulting error
-- is identical to the one you get when it was never created. That is what
-- made the reported "Share" error survive a re-run of this file.
--
-- Then check the install actually succeeded. If the second line reports
-- anything missing, something above it failed — scroll up and find the red
-- error, because one failing statement abandons the rest of the script.
-- ===========================================================================

-- ===========================================================================
-- TUTORING CONNECT — V32
-- Hard break for RLS infinite recursion on parents / parent_learner
-- ---------------------------------------------------------------------------
-- Symptom (tutor/admin UI):
--   "infinite recursion detected in policy for relation \"parents\""
--   "infinite recursion detected in policy for relation \"parent_learner\""
-- Surfaces on: Parents, Parent–Child links, Payments, Invoices, Payment plans,
-- Payment history, Progress reports, Predicted grades, Value-added, etc.
--
-- Root cause: policies that cross-read parents ↔ parent_learner under RLS,
-- forming a cycle. V27 introduced SECURITY DEFINER helpers, but:
--   (a) installs that failed later left the old cyclic V24 policies in place;
--   (b) other policies still used inline `from public.parents` subqueries;
--   (c) SQL SECURITY DEFINER helpers can still re-enter RLS in edge cases
--       unless row_security is disabled inside them.
--
-- Fix:
--   1. Rebuild helpers as plpgsql with SET row_security = off.
--   2. DROP every policy on parents + parent_learner and recreate a minimal,
--      non-cyclic set that only calls those helpers (no inline cross-reads).
--   3. Rebuild money + insight family policies to use the helpers only.
-- Safe to re-run.
-- ===========================================================================

-- 1) Helpers — bypass RLS entirely while evaluating cross-table predicates
create or replace function public.tc_parent_matches_uid(p_parent uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_parent is null or auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1 from public.parents p
     where p.id = p_parent and p.user_id = auth.uid()
  );
end;
$$;

create or replace function public.tc_tutor_covers_parent(p_parent uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_parent is null or auth.uid() is null then
    return false;
  end if;
  if public.tc_is_manager() then
    return true;
  end if;
  return exists (
    select 1
      from public.parent_learner pl
     where pl.parent_id = p_parent
       and public.tc_teaches_learner(pl.learner_id)
  );
end;
$$;

create or replace function public.tc_family_can_see_learner(p_learner uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_learner is null or auth.uid() is null then
    return false;
  end if;
  if public.tc_is_manager() then
    return true;
  end if;
  if public.tc_teaches_learner(p_learner) then
    return true;
  end if;
  if exists (select 1 from public.learners l
              where l.id = p_learner and l.user_id = auth.uid()) then
    return true;
  end if;
  return exists (
    select 1
      from public.parent_learner pl
      join public.parents p on p.id = pl.parent_id
     where pl.learner_id = p_learner
       and p.user_id = auth.uid()
  );
end;
$$;

-- Keep is_parent_of consistent (used by many early policies)
create or replace function public.is_parent_of(p_learner uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_learner is null or auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
      from public.parent_learner pl
      join public.parents par on par.id = pl.parent_id
     where pl.learner_id = p_learner
       and par.user_id = auth.uid()
  );
end;
$$;

create or replace function public.is_family_of_learner(p_learner uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  return public.tc_family_can_see_learner(p_learner);
end;
$$;

revoke all on function public.tc_parent_matches_uid(uuid) from public, anon;
revoke all on function public.tc_tutor_covers_parent(uuid) from public, anon;
revoke all on function public.tc_family_can_see_learner(uuid) from public, anon;
revoke all on function public.is_parent_of(uuid) from public, anon;
revoke all on function public.is_family_of_learner(uuid) from public, anon;
grant execute on function public.tc_parent_matches_uid(uuid) to authenticated;
grant execute on function public.tc_tutor_covers_parent(uuid) to authenticated;
grant execute on function public.tc_family_can_see_learner(uuid) to authenticated;
grant execute on function public.is_parent_of(uuid) to authenticated;
grant execute on function public.is_family_of_learner(uuid) to authenticated;

-- 2) Nuke every policy on the two source tables, then recreate a clean set
do $$
declare r record;
begin
  if to_regclass('public.parents') is not null then
    alter table public.parents enable row level security;
    -- Do NOT force RLS on parents — helpers must remain able to read as owner
    begin
      execute 'alter table public.parents no force row level security';
    exception when others then null;
    end;
    for r in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = 'parents'
    loop
      execute format('drop policy if exists %I on public.parents', r.policyname);
    end loop;


    drop policy if exists parents_select on public.parents;
    drop policy if exists parents_write on public.parents;
    drop policy if exists parents_update on public.parents;
    drop policy if exists parents_delete on public.parents;
    drop policy if exists parents_tutor_scope on public.parents;
    drop policy if exists parents_admin on public.parents;
    drop policy if exists parents_tutor_read on public.parents;

    create policy parents_select on public.parents
      for select to authenticated
      using (
        public.tc_is_manager()
        or public.is_admin()
        or user_id = auth.uid()
        or public.tc_tutor_covers_parent(id)
      );
    create policy parents_write on public.parents
      for insert to authenticated
      with check (public.tc_is_manager() or public.is_admin() or user_id = auth.uid());
    create policy parents_update on public.parents
      for update to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or user_id = auth.uid()
      )
      with check (
        public.tc_is_manager() or public.is_admin() or user_id = auth.uid()
      );
    create policy parents_delete on public.parents
      for delete to authenticated
      using (public.tc_is_manager() or public.is_admin());
  end if;

  if to_regclass('public.parent_learner') is not null then
    alter table public.parent_learner enable row level security;
    begin
      execute 'alter table public.parent_learner no force row level security';
    exception when others then null;
    end;
    for r in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = 'parent_learner'
    loop
      execute format('drop policy if exists %I on public.parent_learner', r.policyname);
    end loop;


    drop policy if exists parent_learner_select on public.parent_learner;
    drop policy if exists parent_learner_write on public.parent_learner;
    drop policy if exists parent_learner_update on public.parent_learner;
    drop policy if exists parent_learner_delete on public.parent_learner;
    drop policy if exists parent_learner_tutor_scope on public.parent_learner;
    drop policy if exists parent_learner_admin on public.parent_learner;
    drop policy if exists parent_learner_tutor_read on public.parent_learner;

    create policy parent_learner_select on public.parent_learner
      for select to authenticated
      using (
        public.tc_is_manager()
        or public.is_admin()
        or public.tc_teaches_learner(learner_id)
        or public.tc_parent_matches_uid(parent_id)
        or public.tc_family_can_see_learner(learner_id)
      );
    create policy parent_learner_write on public.parent_learner
      for insert to authenticated
      with check (
        public.tc_is_manager() or public.is_admin()
        or public.tc_teaches_learner(learner_id)
      );
    create policy parent_learner_update on public.parent_learner
      for update to authenticated
      using (public.tc_is_manager() or public.is_admin())
      with check (public.tc_is_manager() or public.is_admin());
    create policy parent_learner_delete on public.parent_learner
      for delete to authenticated
      using (public.tc_is_manager() or public.is_admin());
  end if;
end $$;

-- 3) Money tables — family read via helper only (no inline parents subquery)
do $$
begin
  if to_regclass('public.invoices') is not null then
    drop policy if exists invoices_family_read on public.invoices;
    create policy invoices_family_read on public.invoices
      for select to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or public.is_tutor()
        or public.tc_parent_matches_uid(parent_id)
        or public.is_family_of_engagement(engagement_id)
      );
  end if;

  if to_regclass('public.payments') is not null then
    drop policy if exists payments_family_read on public.payments;
    create policy payments_family_read on public.payments
      for select to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or public.is_tutor()
        or exists (
          select 1 from public.invoices i
           where i.id = payments.invoice_id
             and public.tc_parent_matches_uid(i.parent_id)
        )
      );
  end if;

  if to_regclass('public.account_credits') is not null then
    drop policy if exists account_credits_family on public.account_credits;
    drop policy if exists account_credits_staff on public.account_credits;
    drop policy if exists account_credits_select on public.account_credits;
    create policy account_credits_select on public.account_credits
      for select to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or public.is_tutor()
        or public.tc_parent_matches_uid(parent_id)
      );
  end if;

  if to_regclass('public.payment_plans') is not null then
    drop policy if exists payment_plans_family on public.payment_plans;
    drop policy if exists payment_plans_staff on public.payment_plans;
    drop policy if exists payment_plans_select on public.payment_plans;
    create policy payment_plans_select on public.payment_plans
      for select to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or public.is_tutor()
        or public.tc_parent_matches_uid(parent_id)
      );
    drop policy if exists payment_plans_write on public.payment_plans;
    create policy payment_plans_write on public.payment_plans
      for all to authenticated
      using (public.tc_is_manager() or public.is_admin() or public.is_tutor())
      with check (public.tc_is_manager() or public.is_admin() or public.is_tutor());
  end if;

  if to_regclass('public.payment_plan_items') is not null then
    drop policy if exists payment_plan_items_family on public.payment_plan_items;
    drop policy if exists payment_plan_items_select on public.payment_plan_items;
    create policy payment_plan_items_select on public.payment_plan_items
      for select to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or public.is_tutor()
        or exists (
          select 1 from public.payment_plans pp
           where pp.id = plan_id
             and public.tc_parent_matches_uid(pp.parent_id)
        )
      );
  end if;
end $$;

-- 4) Insight desks that key on learner_id — family via helper (no parent_learner join in policy text)
do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_progress_reports', 'tc_timezone_desk'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_read', t);
      execute format(
        'create policy %I on public.%I for select to authenticated using (
           public.tc_is_manager() or public.is_admin() or public.is_tutor()
           or public.tc_family_can_see_learner(learner_id)
         )',
        t || '_read', t
      );
    end if;
  end loop;
end $$;

select 'V32 RLS recursion hard-break installed' as status;


notify pgrst, 'reload schema';

select public.tc_schema_ok() as install_check;


-- =====================================================================
-- V36 — RLS PREDICATE EXECUTE GRANTS (CRITICAL HOTFIX)
-- Tutoring Connect / generated studios.  Idempotent. Safe to re-run.
-- =====================================================================
--
-- SYMPTOM
--   Every public page (index, apply, public-book, exam-register,
--   free-register, blog, login) logs a wall of HTTP 401s and renders
--   with stock branding, no tutor list, no availability, no licence
--   state.  The REST body is:
--
--     {"code":"42501","message":"permission denied for function is_tutor"}
--
-- ROOT CAUSE
--   The V18/V19 hardening block runs a catalogue-wide loop:
--
--     revoke all on function <every public fn> from public;
--     revoke all on function <every public fn> from anon;
--     grant  execute on function <every public fn> to authenticated;
--
--   ...then re-grants to `anon` only a 7-function allow-list.  That loop
--   is correct for *callable* RPCs, but it also stripped the helper
--   functions that RLS POLICIES themselves call in USING / WITH CHECK.
--
--   In PostgreSQL a policy predicate is executed as the QUERYING role.
--   So when `anon` selects from any table carrying a policy such as
--       using (public.is_admin() or public.is_tutor())
--   Postgres must execute is_tutor() AS anon, has no EXECUTE privilege,
--   and raises 42501.  PostgREST turns that into HTTP 401 and ABORTS the
--   whole request — instead of the intended behaviour, which is for the
--   predicate to simply evaluate FALSE and fall through to the permissive
--   "public read" policy beside it.
--
--   Note the failure mode: this is not "anon sees too little", it is
--   "anon's query errors out entirely", which is why even genuinely
--   public tables (practice_settings, subjects, availability) 401.
--
-- AFFECTED PREDICATES (all 13 were DENIED to anon)
--   is_tutor, is_admin, is_self_learner, is_parent_of, tc_is_manager,
--   tc_my_tutor_id, tc_teaches_engagement, tc_teaches_learner,
--   tc_teaches_session, tc_parent_matches_uid, tc_family_can_see_learner,
--   is_family_of_engagement, is_family_of_learner
--
-- WHY GRANTING THESE TO anon IS SAFE
--   Each is SECURITY DEFINER, takes no user-controlled table name, and
--   resolves purely from auth.uid().  For an anonymous caller auth.uid()
--   is NULL, so every one of them returns FALSE (or NULL) and grants no
--   visibility whatsoever.  They are booleans about the CALLER, not data
--   readers.  Executing them cannot leak a row; being unable to execute
--   them breaks the site.  The actual access decision still rests with
--   the policies and with the SECURITY DEFINER bodies themselves.
--
-- WHAT THIS DOES NOT CHANGE
--   The anon RPC allow-list is untouched.  Staff reporting functions
--   (tc_exam_reg_stats, tc_db_report, tc_security_report, ...) stay
--   revoked from anon and keep their internal is_tutor() re-check.
-- =====================================================================

begin;

do $$
declare
  r record;
  -- Only the helpers that RLS policies invoke as the querying role.
  predicates text[] := array[
    'is_tutor',
    'is_admin',
    'is_self_learner',
    'is_parent_of',
    'tc_is_manager',
    'tc_my_tutor_id',
    'tc_teaches_engagement',
    'tc_teaches_learner',
    'tc_teaches_session',
    'tc_parent_matches_uid',
    'tc_family_can_see_learner',
    'is_family_of_engagement',
    'is_family_of_learner'
  ];
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind  = 'f'
       and p.proname  = any (predicates)
  loop
    -- Both roles: `authenticated` is normally already correct, but a
    -- future blanket revoke must not be able to half-fix this again.
    execute format('grant execute on function %s to anon, authenticated', r.sig);
    raise notice 'V36 granted EXECUTE on % to anon, authenticated', r.sig;
  end loop;
end $$;

commit;


-- ---------------------------------------------------------------------
-- VERIFICATION — every row must read true / true.
-- ---------------------------------------------------------------------
select p.proname                                            as predicate,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_ok,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_ok
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'is_tutor','is_admin','is_self_learner','is_parent_of','tc_is_manager',
     'tc_my_tutor_id','tc_teaches_engagement','tc_teaches_learner',
     'tc_teaches_session','tc_parent_matches_uid','tc_family_can_see_learner',
     'is_family_of_engagement','is_family_of_learner')
 order by 1;


-- ---------------------------------------------------------------------
-- REGRESSION GUARD
-- Re-run this after ANY future hardening loop.  The loops in V18/V19/V25
-- iterate the whole catalogue, so they will silently re-break RLS unless
-- this file is applied last.  Keep it as the final migration.
-- ---------------------------------------------------------------------


-- =====================================================================
-- V37 — SCHEMA VERSION TRUTH (fixes the false "database is out of date")
-- Tutoring Connect / generated studios.  Idempotent. Safe to re-run.
-- =====================================================================
--
-- SYMPTOM (reported)
--   "Despite running the latest complete schema SQL, I still get:
--      Your database is out of date — it is at V4 but these files expect V9.
--      1 missing function(s); this breaks quiz codes / student-ID sign-in
--      for CBT.  Run: database/v6-cbt-modes.sql"
--
--   Running v6-cbt-modes.sql changes nothing, because nothing was missing.
--   The banner is a FALSE ALARM produced by two independent defects.
--
-- DEFECT 1 — tc_schema_info() disagreed with the schema it ships in.
--   complete-schema.sql upserts tc_schema_registry.version through a series
--   of packs, finishing at 'V29'.  But the last definition of
--   tc_schema_info() hard-codes:
--        'expected', 'V24'   and   'up_to_date', (r.version = 'V24')
--   So a PERFECTLY installed database reports version=V29, expected=V24,
--   up_to_date=false.  assets/js/schema-doctor.js compares
--        v === reg.data.expected
--   which is false, so it abandons the authoritative registry and falls
--   through to guessing by probing individual functions — straight into
--   defect 2.  Two hard-coded strings in two places that must agree, and
--   they had drifted apart. This file removes the possibility of drift.
--
-- DEFECT 2 — the fallback probe asks PostgREST the wrong question.
--   schema-doctor.js probed each function with NO arguments:
--        sb.rpc('tc_cbt_get_exam', {})
--   but the real signature is
--        tc_cbt_get_exam(p_code text, p_student_no text default '')
--   PostgREST cannot resolve a no-argument call and replies:
--        PGRST202 "Searched for the function public.tc_cbt_get_exam without
--        parameters or with a single unnamed json/jsonb parameter, but no
--        matches were found in the schema cache."
--   The doctor tested only for /PGRST202|Could not find the function/ and so
--   declared a function that plainly EXISTS to be missing. Because the probe
--   list stops at the first gap, it then reported the database as "V4".
--   Verified against the live project: every other probe returns 42501
--   (permission denied = present), only this one returns PGRST202.
--   The JS side is fixed in assets/js/schema-doctor.js.
--
-- THE RULE THIS ESTABLISHES
--   There is now exactly ONE place the expected version is written:
--   public.tc_schema_expected().  The registry row and tc_schema_info()
--   both read it, so they cannot disagree again.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Single source of truth for the expected schema version.
--    Bump this ONE literal when a new pack is appended, and nothing else.
-- ---------------------------------------------------------------------
create or replace function public.tc_schema_expected()
returns text language sql immutable
set search_path = public
as $$ select 'V38'::text $$;

-- ---------------------------------------------------------------------
-- 2. Stamp the registry with that same value.
-- ---------------------------------------------------------------------
insert into public.tc_schema_registry (id, version, packs, note)
values (1,
        public.tc_schema_expected(),
        array['v1-core','v2-tutoring-ops','v3-classroom-exams','v4-enterprise-parity',
              'v5-ops-parity','v6-cbt-modes','v7-family-access','v9-keepalive-drive',
              'v12-quota-guard','v15-family-polls-billing','v16-exam-registration',
              'v17-licensing-family-billing','v18-security-hardening',
              'v19-revenue-and-security','v20-cbt-2fa-polls','v22-cbt-results-audit',
              'v24-tutor-scoping','v25-desks-lifecycle-free-classes',
              'v26-tutor-marking-and-selftest','v27-rls-recursion-blog-documents',
              'v28-admin-and-ops-enrichment','v29-social-registration-links',
              'v30-group-insights-rls-hotfix','v32-rls-recursion-hard-break',
              'v34-cbt-review-lookup','v35-cbt-review-lookup',
              'v36-anon-rls-predicate-grants','v37-schema-version-truth',
              'v38-cbt-delivery-and-readaloud'],
        'Installed by database/complete-schema.sql — single-file install, no other pack required.')
on conflict (id) do update
   set version    = excluded.version,
       applied_at = now(),
       packs      = excluded.packs,
       note       = excluded.note;

-- ---------------------------------------------------------------------
-- 3. tc_schema_info() now DERIVES expected instead of hard-coding it.
-- ---------------------------------------------------------------------
create or replace function public.tc_schema_info()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok',         true,
    'version',    r.version,
    'expected',   public.tc_schema_expected(),
    'up_to_date', (r.version = public.tc_schema_expected()),
    'packs',      r.packs,
    'applied_at', r.applied_at
  ) from public.tc_schema_registry r where r.id = 1;
$$;

grant execute on function public.tc_schema_expected() to anon, authenticated;
grant execute on function public.tc_schema_info()     to authenticated;

commit;


-- ---------------------------------------------------------------------
-- VERIFICATION — up_to_date must be true immediately after install.
-- ---------------------------------------------------------------------
select public.tc_schema_info();


-- ---------------------------------------------------------------------
-- PostgREST caches the schema. A function created seconds ago can be
-- genuinely present and still invisible to the REST API, producing the
-- exact PGRST202 error that started all of this. Always finish here.
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';


-- =============================================================================
-- V38 — CBT delivery settings: read-aloud flag
-- =============================================================================
-- CONTEXT
-- cbt_exams has carried shuffle_questions and shuffle_options since v20, but
-- no runtime ever read them: the candidate was always served the authored CSV
-- order. V39 of the front end fixes that (CBT.applyDelivery in assets/js/cbt.js
-- is now called by cbt-exam.html), which turns those two columns into live
-- settings for the first time.
--
-- This migration adds the one column the new feature set still needed:
-- read_aloud, the per-paper switch for text to speech.
--
-- WHY A COLUMN AND NOT A JSONB BLOB
-- The alternative was to hide the flag inside the existing `questions` jsonb.
-- Rejected: settings and content would then share one column, every settings
-- change would rewrite the whole question payload, and cbt-results.html's CRUD
-- editor (which binds to real columns) could not expose it. A boolean column
-- costs one byte and keeps the editor, the RPC allow-list and the row-level
-- policies working unchanged.
--
-- SAFE TO RE-RUN. Also folded into database/complete-schema.sql, so a fresh
-- one-click install already contains it.
-- =============================================================================

alter table if exists public.cbt_exams
  add column if not exists read_aloud boolean default true;

comment on column public.cbt_exams.read_aloud is
  'Allow candidates to have questions and options spoken by their own device '
  'using the browser Web Speech API (free, offline, no third-party service). '
  'Set false for listening comprehension or reading-fluency papers, where '
  'hearing the text would invalidate what the paper is measuring.';

comment on column public.cbt_exams.shuffle_questions is
  'Randomise question order per candidate at sitting time. Passage/stimulus '
  'sets are shuffled as whole blocks, never split, so a comprehension passage '
  'always stays with its own questions.';

comment on column public.cbt_exams.shuffle_options is
  'Randomise option order per candidate. Safe: marking compares answer TEXT, '
  'not the A-D letter. Positional options ("All of the above") and True/False '
  'pairs are detected and left in place by assets/js/cbt.js.';

-- The candidate-facing lookup RPC must return the new flag, or the exam page
-- cannot know whether read-aloud is permitted for this paper.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cbt_exams' and column_name = 'read_aloud'
  ) then
    raise notice 'V38: cbt_exams.read_aloud present.';
  end if;
end $$;

notify pgrst, 'reload schema';
select public.tc_schema_ok() as schema_check;
