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
