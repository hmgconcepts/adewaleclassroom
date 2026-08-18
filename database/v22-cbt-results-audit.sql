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
    'per_question',coalesce(r.per_question, r.review, r.detail, '[]'::jsonb),
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
    select jsonb_array_elements(coalesce(r.per_question, r.review, r.detail, '[]'::jsonb)) as q
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
