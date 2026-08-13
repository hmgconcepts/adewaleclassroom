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
