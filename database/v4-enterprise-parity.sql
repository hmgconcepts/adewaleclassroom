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

-- V4 lookup: also match learners by student_no. DROP first because
-- CREATE OR REPLACE cannot rename an IN parameter (p_ident -> p_identifier).
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
