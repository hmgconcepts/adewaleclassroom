
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

notify pgrst, 'reload schema';
select 'V35 review lookup installed (duration_sec)' as status;
