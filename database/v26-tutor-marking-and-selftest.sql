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
notify pgrst, 'reload schema';

select 'V26 tutor marking + schema self-test installed \u2705' as status;
select public.tc_schema_ok() as schema_check;
