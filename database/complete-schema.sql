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

create extension if not exists pgcrypto;

create or replace function public.tc_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','owner','director','lead_tutor','super_admin')
      and p.status in ('approved','active')
  );
$$;

create or replace function public.is_tutor()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','owner','director','lead_tutor','super_admin','tutor','staff')
      and p.status in ('approved','active')
  );
$$;

create or replace function public.is_parent_of(p_learner uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.parent_learner pl
    join public.parents par on par.id = pl.parent_id
    where pl.learner_id = p_learner and par.user_id = auth.uid()
  );
$$;

create or replace function public.is_self_learner(p_learner uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.learners l
    where l.id = p_learner and l.user_id = auth.uid()
  );
$$;

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
grant execute on function public.tc_keep_alive() to anon, authenticated;
grant execute on function public.lookup_login_email(text) to anon, authenticated;

insert into public.practice_settings(id, name, motto) values (1, 'Lumen Tutoring Studio', 'Independent progress. Visible to parents.')
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

create or replace function public.lookup_login_email(p_identifier text)
returns text language sql stable security definer as $$
  select public.lookup_login_email(p_identifier);
$$;

-- alias already exists as p_ident; provide p_identifier wrapper without recursion
drop function if exists public.lookup_login_email(p_identifier text);
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
      if lower(subj) in ('overall','general') and jsonb_object_keys(new.subject_scores) is not null then
        -- still write named subjects; skip only empty
        null;
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
