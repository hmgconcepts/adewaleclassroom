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
