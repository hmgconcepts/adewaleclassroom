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
