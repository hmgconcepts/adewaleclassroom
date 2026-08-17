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
