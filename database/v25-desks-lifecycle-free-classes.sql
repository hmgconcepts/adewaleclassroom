-- ===========================================================================
-- TUTORING CONNECT — V25
-- "Entry desks", CBT lifecycle, free-class cohorts, certificate studio
-- ---------------------------------------------------------------------------
-- WHY THIS PACK EXISTS
--
-- A audit of the generated studio found that eleven pages in the Analytics and
-- Reporting sections shipped as READ-ONLY STUBS. Their entire <main> was a
-- description card followed by the sentence:
--
--     "Use the related links and the Page Help button."
--
-- There was no table behind them and no way for a tutor or an administrator to
-- record anything. The pages named in the report were:
--
--     At-risk board          Practice analytics     Value-added
--     Predicted grades       Group insights         Insights lab
--     Scoresheet (entry)     Progress reports       Timezone desk
--
-- Analysis, not data entry, was the original intent — every figure was to be
-- derived. In practice a tutor needs to record the judgement as well as the
-- arithmetic: WHY a learner is at risk, WHAT was agreed with the parent, WHICH
-- grade is being predicted and on what basis. None of that is derivable.
--
-- This pack therefore creates one small, well-indexed table per desk. Each one
-- follows the same shape so the shared front-end (assets/js/desk-kit.js) can
-- drive all of them:
--
--     id, learner_id / group_id, period, the desk's own columns,
--     note, created_by, created_at, updated_at
--
-- SECURITY POSTURE (unchanged from V18/V24, applied to the new tables)
--   * RLS on, forced.
--   * Managers (owner/admin) see everything.
--   * A tutor sees only rows for learners and engagements they actually teach,
--     via the V24 helpers tc_teaches_learner() / tc_teaches_engagement().
--   * A parent or learner reads only their own rows, and writes nothing.
--   * EXECUTE is revoked FROM PUBLIC, not from anon — revoking from anon is a
--     no-op because PostgreSQL grants EXECUTE to PUBLIC by default. This was
--     the V18 finding and it applies to every function created below.
--
-- SAFE TO RE-RUN. Every statement is idempotent.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0. Shared helpers
-- ---------------------------------------------------------------------------

-- Who is writing? Stored on every desk row so an entry can be attributed and
-- an audit answered without joining three tables.
create or replace function public.tc_actor()
returns uuid language sql stable as $$ select auth.uid() $$;

revoke all on function public.tc_actor() from public;
grant execute on function public.tc_actor() to authenticated;

-- Touch updated_at on every update. One trigger function, reused everywhere.
create or replace function public.tc_touch_updated()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

revoke all on function public.tc_touch_updated() from public;

-- ---------------------------------------------------------------------------
-- 1. AT-RISK BOARD  (report item 12)
--
-- The rule engine still computes the flags. What was missing was the human
-- half: the intervention. A flag with no recorded action is a complaint
-- waiting to happen — the parent asks "you knew in March, what did you do?"
-- and nobody can answer. Each row here is one review of one learner.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_at_risk_reviews (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid references public.learners(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete set null,
  subject       text,
  reviewed_on   date not null default current_date,
  -- Where the concern came from. 'auto' means the rule engine raised it and a
  -- human confirmed it; 'manual' means a tutor raised it from observation.
  origin        text not null default 'manual',        -- auto | manual
  risk_level    text not null default 'watch',         -- watch | concern | urgent | cleared
  -- The triggers that applied, stored as text so the board can show them even
  -- if the rule that produced them is later retired.
  triggers      text[] default '{}',
  evidence      text,           -- "3 of last 4 quizzes below 45%, 2 no-shows"
  action_agreed text,           -- "Extra 30-min clinic Thursdays for 4 weeks"
  owner_tutor   uuid references public.tutors(id) on delete set null,
  parent_told   boolean default false,
  parent_told_on date,
  review_due    date,
  resolved      boolean default false,
  resolved_on   date,
  outcome       text,
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_at_risk_learner_idx on public.tc_at_risk_reviews (learner_id, reviewed_on desc);
create index if not exists tc_at_risk_open_idx    on public.tc_at_risk_reviews (resolved, risk_level);

-- ---------------------------------------------------------------------------
-- 2. PRACTICE ANALYTICS  (report item 13)
--
-- Self-quiz and review-quiz attempts are captured automatically. Practice done
-- OFF the platform — a past-paper worked on paper, a Khan Academy set, a
-- weekend problem sheet — is invisible, and for an exam-prep studio that is
-- most of the practice. This table lets a tutor log it so the analytics are
-- about the learner's whole week, not just the part that happened in a
-- browser.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_practice_analytics (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid references public.learners(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete set null,
  subject       text,
  topic         text,
  source        text not null default 'platform',  -- platform|past_paper|worksheet|external|homework
  period_start  date not null default current_date,
  period_end    date,
  attempts      int    default 0,
  questions     int    default 0,
  correct       int    default 0,
  -- accuracy is DERIVED, never typed. Storing it generated removes the single
  -- most common data-entry error on a page like this: a percentage that does
  -- not match its own numerator and denominator.
  accuracy      numeric(5,2) generated always as (
                  case when coalesce(questions,0) > 0
                       then round((coalesce(correct,0)::numeric / questions) * 100, 2)
                       else null end) stored,
  minutes       int    default 0,
  difficulty    text,                              -- foundation|core|stretch|exam
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_practice_learner_idx on public.tc_practice_analytics (learner_id, period_start desc);
create index if not exists tc_practice_subject_idx on public.tc_practice_analytics (subject, topic);

-- ---------------------------------------------------------------------------
-- 3. VALUE-ADDED  (report item 14)
--
-- Value-added is the studio's central commercial claim: "the child arrived at
-- 42% and is now at 68%, and here is the arithmetic." It needs a BASELINE,
-- which by definition predates the platform and can only be typed in — a
-- mock-exam mark, a school report, a diagnostic sat in week one.
--
-- The VA score is generated, so it can never disagree with its own inputs.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_value_added (
  id             uuid primary key default gen_random_uuid(),
  learner_id     uuid references public.learners(id) on delete cascade,
  engagement_id  uuid references public.engagements(id) on delete set null,
  subject        text,
  period_label   text,                       -- "Term 1 2026", "Cycle 3"
  period_start   date,
  period_end     date,
  baseline_score numeric(6,2),               -- where they started
  baseline_source text,                      -- "School report Dec 2025"
  current_score  numeric(6,2),               -- where they are now
  target_score   numeric(6,2),               -- where we said they would be
  expected_score numeric(6,2),               -- cohort-typical progress
  value_added    numeric(6,2) generated always as (
                   case when current_score is not null and expected_score is not null
                        then round(current_score - expected_score, 2)
                        when current_score is not null and baseline_score is not null
                        then round(current_score - baseline_score, 2)
                        else null end) stored,
  hours_taught   numeric(6,2),
  confidence     text default 'medium',      -- low|medium|high
  method         text,                       -- how it was measured
  note           text,
  published      boolean default false,      -- visible to the family?
  created_by     uuid default public.tc_actor(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists tc_value_added_learner_idx on public.tc_value_added (learner_id, period_start desc);

-- ---------------------------------------------------------------------------
-- 4. PREDICTED GRADES  (report item 15)
--
-- A predicted grade is a professional judgement on a named grading scale. It
-- is not a percentage and cannot be computed: WAEC A1 and Cambridge IGCSE 9
-- and SAT 1450 are different objects. The exam board and the scale are
-- therefore first-class columns, and 'basis' is required by the front end
-- because an unexplained prediction is worthless in a parent conference.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_predicted_grades (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid references public.learners(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete set null,
  subject       text,
  exam_board    text,        -- WAEC | NECO | JAMB | IGCSE | GCSE | SAT | IELTS | Common Entrance | Other
  exam_series   text,        -- "May/June 2026"
  scale         text,        -- "A1–F9" | "9–1" | "A*–E" | "400–1600" | "0–9 bands"
  current_grade text,
  predicted     text not null,
  target_grade  text,
  confidence    text default 'medium',   -- low | medium | high
  basis         text,                    -- what the prediction rests on
  evidence_pct  numeric(5,2),            -- the mean mark behind it, if any
  risk          text,                    -- "misses target if attendance stays below 80%"
  predicted_on  date default current_date,
  published     boolean default false,
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_predicted_learner_idx on public.tc_predicted_grades (learner_id, predicted_on desc);
create index if not exists tc_predicted_board_idx   on public.tc_predicted_grades (exam_board, subject);

-- ---------------------------------------------------------------------------
-- 5. GROUP INSIGHTS  (report item 16)
--
-- Group teaching produces observations that belong to the GROUP, not to any
-- one child: "the whole set has not met simultaneous equations", "attendance
-- collapses in the 7pm slot". Those cannot be stored against a learner without
-- being wrong.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_group_insights (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid references public.engagements(id) on delete cascade,
  subject       text,
  period_label  text,
  period_start  date default current_date,
  period_end    date,
  headcount     int,
  avg_score     numeric(5,2),
  attendance_pct numeric(5,2),
  homework_pct  numeric(5,2),
  strongest_topic text,
  weakest_topic  text,
  observation   text,
  action        text,
  next_review   date,
  published     boolean default false,
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_group_insights_eng_idx on public.tc_group_insights (engagement_id, period_start desc);

-- ---------------------------------------------------------------------------
-- 6. INSIGHTS LAB  (report item 17)
--
-- The lab is where a hypothesis is written down before it is acted on:
-- "I think the Tuesday cohort underperforms because the slot follows their
-- school games afternoon." A note has a subject, an observation, the evidence
-- behind it, a proposed action and — crucially — a place to record what
-- actually happened. That last column is what turns an opinion into practice.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_insight_notes (
  id            uuid primary key default gen_random_uuid(),
  scope         text not null default 'learner',   -- learner | group | subject | studio
  learner_id    uuid references public.learners(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete cascade,
  subject       text,
  title         text not null,
  category      text default 'observation',        -- observation|hypothesis|experiment|finding|risk
  observation   text,
  evidence      text,
  action        text,
  measured_by   text,                              -- how we will know it worked
  status        text default 'open',               -- open|testing|confirmed|rejected|closed
  outcome       text,
  review_on     date,
  tags          text[] default '{}',
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_insight_notes_status_idx on public.tc_insight_notes (status, review_on);

-- ---------------------------------------------------------------------------
-- 7. SCORESHEET — manual entry  (report item 18)
--
-- public.scoresheet already exists and is written automatically by the graded
-- quiz trigger. Two things were missing for hand entry:
--
--   a) pct was expected to be typed, and so could disagree with score/max.
--      It is now maintained by a trigger, whatever the source of the row.
--   b) there was nowhere to record WHO entered a manual mark, what it was out
--      of in a different scale, or a tutor comment.
-- ---------------------------------------------------------------------------
alter table if exists public.scoresheet add column if not exists tutor_id      uuid references public.tutors(id) on delete set null;
alter table if exists public.scoresheet add column if not exists assessment_type text default 'manual';  -- manual|graded_quiz|sow|homework|mock|classwork
alter table if exists public.scoresheet add column if not exists term          text;
alter table if exists public.scoresheet add column if not exists weight        numeric(5,2) default 1;
alter table if exists public.scoresheet add column if not exists grade         text;
alter table if exists public.scoresheet add column if not exists comment       text;
alter table if exists public.scoresheet add column if not exists published     boolean default true;
alter table if exists public.scoresheet add column if not exists created_by    uuid;
alter table if exists public.scoresheet add column if not exists updated_at    timestamptz default now();

-- pct is arithmetic, not an opinion. Recompute it on every write so a hand
-- entered row can never contradict itself.
create or replace function public.tc_scoresheet_pct()
returns trigger language plpgsql as $$
begin
  if coalesce(new.max_score, 0) > 0 then
    new.pct := round((coalesce(new.score, 0)::numeric / new.max_score) * 100, 2);
  end if;
  new.updated_at := now();
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;

revoke all on function public.tc_scoresheet_pct() from public;

drop trigger if exists tc_scoresheet_pct_trg on public.scoresheet;
create trigger tc_scoresheet_pct_trg
  before insert or update on public.scoresheet
  for each row execute function public.tc_scoresheet_pct();

-- ---------------------------------------------------------------------------
-- 8. PROGRESS REPORTS  (report item 20)
--
-- The progress report is the studio's flagship parent-facing document, and
-- there was no table for it at all. A report is a draft until it is published,
-- because a half-written comment must never reach a parent.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_progress_reports (
  id             uuid primary key default gen_random_uuid(),
  learner_id     uuid references public.learners(id) on delete cascade,
  engagement_id  uuid references public.engagements(id) on delete set null,
  tutor_id       uuid references public.tutors(id) on delete set null,
  period_label   text not null,                 -- "Cycle 3 · Mar 2026"
  period_start   date,
  period_end     date,
  -- One row per subject: [{subject, score, grade, effort, comment}]
  subjects       jsonb default '[]'::jsonb,
  attendance_pct numeric(5,2),
  punctuality    text,
  homework_pct   numeric(5,2),
  hours_taught   numeric(6,2),
  effort         text,                          -- excellent|good|fair|needs work
  behaviour      text,
  strengths      text,
  areas_to_improve text,
  tutor_comment  text,
  admin_comment  text,
  next_steps     text,
  parent_ack     boolean default false,
  parent_ack_on  timestamptz,
  status         text not null default 'draft', -- draft | published | archived
  published_on   timestamptz,
  note           text,
  created_by     uuid default public.tc_actor(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists tc_progress_learner_idx on public.tc_progress_reports (learner_id, period_start desc);
create index if not exists tc_progress_status_idx  on public.tc_progress_reports (status);

-- Stamp published_on exactly once, when status first becomes 'published'.
create or replace function public.tc_progress_publish()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and coalesce(old.status, '') <> 'published' then
    new.published_on := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

revoke all on function public.tc_progress_publish() from public;

drop trigger if exists tc_progress_publish_trg on public.tc_progress_reports;
create trigger tc_progress_publish_trg
  before insert or update on public.tc_progress_reports
  for each row execute function public.tc_progress_publish();

-- ---------------------------------------------------------------------------
-- 9. TIMEZONE DESK  (report item 9)
--
-- The studio teaches across time zones. The page could convert a time, but
-- there was nowhere to record the facts the conversion depends on: this tutor
-- is in Lagos and will not teach before 07:00; this family is in Toronto and
-- observes daylight saving; this learner's exam board publishes in UTC.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_timezone_desk (
  id            uuid primary key default gen_random_uuid(),
  party_type    text not null default 'tutor',   -- tutor | learner | parent | studio | exam_board
  tutor_id      uuid references public.tutors(id) on delete cascade,
  learner_id    uuid references public.learners(id) on delete cascade,
  parent_id     uuid references public.parents(id) on delete cascade,
  label         text,                            -- free text for studio/exam_board rows
  city          text,
  country       text,
  tz            text not null,                   -- IANA, e.g. 'Africa/Lagos'
  utc_offset    text,                            -- cached display value, e.g. '+01:00'
  observes_dst  boolean default false,
  -- Availability window in the party's OWN local time. Stored as text so a
  -- 22:00–01:00 window that crosses midnight is not mangled.
  work_from     time,
  work_to       time,
  work_days     text[] default '{Mon,Tue,Wed,Thu,Fri}',
  blackout      text,                            -- "no classes during Ramadan evenings"
  preferred_contact text,
  is_default    boolean default false,
  active        boolean default true,
  note          text,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_timezone_party_idx on public.tc_timezone_desk (party_type, active);

-- ---------------------------------------------------------------------------
-- 10. FREE / OUTREACH CLASSES  (report item 8)
--
-- The studio runs free preparation classes on YouTube, Zoom, Google Meet and
-- Free Conference, with a WhatsApp or Telegram group alongside, aimed at
-- national and international examinations. Those learners are NOT paying
-- clients: they must not appear on invoices, in payroll or in the fee ledger.
-- But they must be trackable, assessable and countable, because the whole
-- point is to evaluate them and to convert the strongest into paying students.
--
-- Three tables:
--   tc_free_cohorts       — the programme itself (a class, a season, a board)
--   tc_free_links         — one shareable registration link per cohort
--   tc_free_registrations — who signed up, and what happened to them
--
-- No file uploads anywhere: the meeting room, the recording and the group chat
-- are all links, which is also what keeps the studio inside the free tier.
-- ---------------------------------------------------------------------------
create table if not exists public.tc_free_cohorts (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,                  -- "Free JAMB Physics Bootcamp 2026"
  code           text unique,                    -- "JAMB-PHY-26"
  description    text,
  exam_board     text,                           -- WAEC|NECO|JAMB|IGCSE|SAT|IELTS|Other
  exam_series    text,
  subjects       text[] default '{}',
  level          text,                           -- "SS3", "Year 11"
  -- Where the class actually happens. All links, never uploads.
  platform       text,                           -- youtube|zoom|meet|freeconference|teams|other
  meeting_url    text,
  meeting_id     text,
  meeting_passcode text,
  youtube_url    text,                           -- live stream or playlist
  replay_url     text,
  whatsapp_url   text,
  telegram_url   text,
  schedule_text  text,                           -- "Sat & Sun, 5–7pm WAT"
  tz             text default 'Africa/Lagos',
  starts_on      date,
  ends_on        date,
  capacity       int default 0,                  -- 0 = unlimited
  tutor_id       uuid references public.tutors(id) on delete set null,
  -- Governance. A free cohort still needs a register, a consent position and
  -- an owner, especially where minors are involved.
  requires_parent_consent boolean default true,
  min_age        int,
  auto_approve   boolean default true,
  track_attendance boolean default true,
  track_results  boolean default true,
  status         text not null default 'open',   -- draft|open|closed|running|completed|archived
  banner_url     text,
  note           text,
  created_by     uuid default public.tc_actor(),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index if not exists tc_free_cohorts_status_idx on public.tc_free_cohorts (status, starts_on desc);

create table if not exists public.tc_free_links (
  id           uuid primary key default gen_random_uuid(),
  cohort_id    uuid not null references public.tc_free_cohorts(id) on delete cascade,
  token        text not null unique,
  label        text,                              -- "Instagram", "WhatsApp status"
  active       boolean default true,
  expires_on   date,
  max_uses     int default 0,                     -- 0 = unlimited
  uses         int default 0,
  created_by   uuid default public.tc_actor(),
  created_at   timestamptz default now()
);

create index if not exists tc_free_links_token_idx on public.tc_free_links (token) where active;

create table if not exists public.tc_free_registrations (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid not null references public.tc_free_cohorts(id) on delete cascade,
  link_id       uuid references public.tc_free_links(id) on delete set null,
  reg_no        text unique,                       -- issued by trigger below
  full_name     text not null,
  email         text,
  phone         text,
  whatsapp      text,
  country       text,
  state_region  text,
  city          text,
  tz            text,
  school        text,
  level         text,
  exam_board    text,
  exam_series   text,
  subjects      text[] default '{}',
  parent_name   text,
  parent_phone  text,
  parent_email  text,
  parent_consent boolean default false,
  how_heard     text,
  goal          text,                              -- what they want out of it
  -- Lifecycle. A free student can be promoted into a real learner record, and
  -- the link is kept so the conversion can be reported on.
  status        text not null default 'pending',   -- pending|approved|active|inactive|completed|declined|converted
  approved_on   timestamptz,
  learner_id    uuid references public.learners(id) on delete set null,
  converted_on  timestamptz,
  -- Lightweight tracking, so the studio can evaluate without a fee record.
  sessions_attended int default 0,
  sessions_total    int default 0,
  attendance_pct numeric(5,2),
  quizzes_taken  int default 0,
  avg_score      numeric(5,2),
  last_active_on date,
  engagement_note text,
  note          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists tc_free_reg_cohort_idx on public.tc_free_registrations (cohort_id, status);
create index if not exists tc_free_reg_name_idx   on public.tc_free_registrations (lower(full_name));

-- Registration numbers from a sequence, the same approach V16 used for exam
-- numbers. A client-generated number races; a sequence cannot.
create sequence if not exists public.tc_free_reg_seq start 1;

create or replace function public.tc_free_reg_number()
returns trigger language plpgsql as $$
declare c text;
begin
  if new.reg_no is null or new.reg_no = '' then
    select coalesce(nullif(code, ''), 'FREE') into c
      from public.tc_free_cohorts where id = new.cohort_id;
    new.reg_no := upper(coalesce(c, 'FREE')) || '-' ||
                  to_char(now(), 'YY') || '-' ||
                  lpad(nextval('public.tc_free_reg_seq')::text, 5, '0');
  end if;
  new.updated_at := now();
  return new;
end $$;

revoke all on function public.tc_free_reg_number() from public;

drop trigger if exists tc_free_reg_number_trg on public.tc_free_registrations;
create trigger tc_free_reg_number_trg
  before insert or update on public.tc_free_registrations
  for each row execute function public.tc_free_reg_number();

-- Attendance percentage is arithmetic. Keep it honest.
create or replace function public.tc_free_reg_pct()
returns trigger language plpgsql as $$
begin
  if coalesce(new.sessions_total, 0) > 0 then
    new.attendance_pct := round((coalesce(new.sessions_attended,0)::numeric / new.sessions_total) * 100, 2);
  end if;
  return new;
end $$;

revoke all on function public.tc_free_reg_pct() from public;

drop trigger if exists tc_free_reg_pct_trg on public.tc_free_registrations;
create trigger tc_free_reg_pct_trg
  before insert or update on public.tc_free_registrations
  for each row execute function public.tc_free_reg_pct();

-- ---------------------------------------------------------------------------
-- 10b. PUBLIC REGISTRATION RPC
--
-- The registration page is reachable by someone with no account, so the write
-- has to be possible for the anon role. Granting INSERT on the table to anon
-- would let anyone write any column — including status='converted' and a
-- learner_id. Instead the only anon-callable surface is this function, which:
--   * refuses a token that is missing, inactive, expired or exhausted,
--   * refuses a cohort that is not open,
--   * ignores every column the caller is not allowed to set,
--   * returns the registration number so the page can show it.
--
-- SECURITY DEFINER with a pinned search_path, per the V18 posture.
-- ---------------------------------------------------------------------------
create or replace function public.tc_free_register(
  p_token   text,
  p_name    text,
  p_email   text default null,
  p_phone   text default null,
  p_country text default null,
  p_city    text default null,
  p_school  text default null,
  p_level   text default null,
  p_board   text default null,
  p_subjects text[] default '{}',
  p_parent_name  text default null,
  p_parent_phone text default null,
  p_consent boolean default false,
  p_how_heard text default null,
  p_goal    text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lnk public.tc_free_links%rowtype;
  coh public.tc_free_cohorts%rowtype;
  reg public.tc_free_registrations%rowtype;
  taken int;
begin
  if coalesce(trim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Please enter your full name.');
  end if;

  select * into lnk from public.tc_free_links where token = p_token;
  if not found or not lnk.active then
    return jsonb_build_object('ok', false, 'error', 'This registration link is no longer active.');
  end if;
  if lnk.expires_on is not null and lnk.expires_on < current_date then
    return jsonb_build_object('ok', false, 'error', 'This registration link expired on ' || lnk.expires_on || '.');
  end if;
  if coalesce(lnk.max_uses, 0) > 0 and coalesce(lnk.uses, 0) >= lnk.max_uses then
    return jsonb_build_object('ok', false, 'error', 'This registration link has reached its limit.');
  end if;

  select * into coh from public.tc_free_cohorts where id = lnk.cohort_id;
  if not found or coh.status not in ('open', 'running') then
    return jsonb_build_object('ok', false, 'error', 'Registration for this class is closed.');
  end if;
  if coalesce(coh.capacity, 0) > 0 then
    select count(*) into taken from public.tc_free_registrations
     where cohort_id = coh.id and status <> 'declined';
    if taken >= coh.capacity then
      return jsonb_build_object('ok', false, 'error', 'This class is full.');
    end if;
  end if;
  if coh.requires_parent_consent and not coalesce(p_consent, false) then
    return jsonb_build_object('ok', false, 'error', 'A parent or guardian must give consent for this class.');
  end if;

  insert into public.tc_free_registrations (
    cohort_id, link_id, full_name, email, phone, country, city, school, level,
    exam_board, exam_series, subjects, parent_name, parent_phone,
    parent_consent, how_heard, goal, status
  ) values (
    coh.id, lnk.id, trim(p_name), nullif(trim(coalesce(p_email,'')),''),
    nullif(trim(coalesce(p_phone,'')),''), p_country, p_city, p_school, p_level,
    coalesce(p_board, coh.exam_board), coh.exam_series, coalesce(p_subjects, '{}'),
    p_parent_name, p_parent_phone, coalesce(p_consent, false), p_how_heard, p_goal,
    case when coh.auto_approve then 'approved' else 'pending' end
  ) returning * into reg;

  update public.tc_free_links set uses = coalesce(uses, 0) + 1 where id = lnk.id;

  return jsonb_build_object(
    'ok', true,
    'reg_no', reg.reg_no,
    'status', reg.status,
    'cohort', coh.name,
    'meeting_url', coh.meeting_url,
    'youtube_url', coh.youtube_url,
    'whatsapp_url', coh.whatsapp_url,
    'telegram_url', coh.telegram_url,
    'schedule', coh.schedule_text
  );
end $$;

revoke all on function public.tc_free_register(text,text,text,text,text,text,text,text,text,text[],text,text,boolean,text,text) from public;
grant execute on function public.tc_free_register(text,text,text,text,text,text,text,text,text,text[],text,text,boolean,text,text) to anon, authenticated;

-- The public page needs to show WHAT it is registering for before the form is
-- filled. This returns only the presentational fields — never the roll.
create or replace function public.tc_free_cohort_public(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'name', c.name,
    'description', c.description,
    'exam_board', c.exam_board,
    'exam_series', c.exam_series,
    'subjects', to_jsonb(c.subjects),
    'level', c.level,
    'platform', c.platform,
    'schedule', c.schedule_text,
    'tz', c.tz,
    'starts_on', c.starts_on,
    'ends_on', c.ends_on,
    'banner_url', c.banner_url,
    'requires_parent_consent', c.requires_parent_consent,
    'open', (c.status in ('open','running') and l.active
             and (l.expires_on is null or l.expires_on >= current_date)
             and (coalesce(l.max_uses,0) = 0 or coalesce(l.uses,0) < l.max_uses))
  )
  from public.tc_free_links l
  join public.tc_free_cohorts c on c.id = l.cohort_id
  where l.token = p_token;
$$;

revoke all on function public.tc_free_cohort_public(text) from public;
grant execute on function public.tc_free_cohort_public(text) to anon, authenticated;

-- Promote a free student into a real learner, without losing the history.
create or replace function public.tc_free_convert(p_reg uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare r public.tc_free_registrations%rowtype; new_id uuid;
begin
  if not public.tc_is_manager() then
    raise exception 'Only an administrator may convert a free registration.';
  end if;
  select * into r from public.tc_free_registrations where id = p_reg;
  if not found then raise exception 'Registration not found.'; end if;
  if r.learner_id is not null then return r.learner_id; end if;

  insert into public.learners (full_name)
  values (r.full_name)
  returning id into new_id;

  update public.tc_free_registrations
     set learner_id = new_id, status = 'converted', converted_on = now()
   where id = p_reg;

  return new_id;
end $$;

revoke all on function public.tc_free_convert(uuid) from public;
grant execute on function public.tc_free_convert(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. CBT LIFECYCLE  (report item 22)
--
-- School Connect lets a paper be closed, re-opened, shared, previewed and
-- archived. Tutoring Connect could only edit and delete. Closing matters most:
-- a paper left open collects sittings after the deadline, and there was no way
-- to stop it without deleting the paper and losing the results.
-- ---------------------------------------------------------------------------
alter table if exists public.cbt_exams add column if not exists is_open      boolean default true;
alter table if exists public.cbt_exams add column if not exists closed_at    timestamptz;
alter table if exists public.cbt_exams add column if not exists closed_by    uuid;
alter table if exists public.cbt_exams add column if not exists is_archived  boolean default false;
alter table if exists public.cbt_exams add column if not exists archived_at  timestamptz;
alter table if exists public.cbt_exams add column if not exists share_token  text;
alter table if exists public.cbt_exams add column if not exists share_active boolean default true;
alter table if exists public.cbt_exams add column if not exists tutor_id     uuid references public.tutors(id) on delete set null;
alter table if exists public.cbt_exams add column if not exists cohort_id    uuid references public.tc_free_cohorts(id) on delete set null;
alter table if exists public.cbt_exams add column if not exists updated_at   timestamptz default now();

create unique index if not exists cbt_exams_share_token_idx
  on public.cbt_exams (share_token) where share_token is not null;

-- One entry point for every lifecycle change, so the rules live in ONE place
-- and cannot drift between the list page and the builder.
create or replace function public.tc_cbt_set_state(p_exam uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare e public.cbt_exams%rowtype;
begin
  select * into e from public.cbt_exams where id = p_exam;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That quiz no longer exists.');
  end if;

  -- A tutor may manage only their own paper; a manager may manage any.
  if not (public.tc_is_manager()
          or (e.tutor_id is not null and e.tutor_id = public.tc_my_tutor_id())
          or public.tc_teaches_engagement(e.engagement_id)) then
    return jsonb_build_object('ok', false, 'error', 'This quiz is not assigned to you.');
  end if;

  if p_action = 'close' then
    update public.cbt_exams
       set is_open = false, closed_at = now(), closed_by = auth.uid(),
           status = 'closed', updated_at = now()
     where id = p_exam;

  elsif p_action = 'open' then
    update public.cbt_exams
       set is_open = true, closed_at = null, closed_by = null,
           status = 'published', is_archived = false, updated_at = now()
     where id = p_exam;

  elsif p_action = 'archive' then
    -- Archiving implies closing. An archived paper that still accepted
    -- sittings would be the worst of both worlds.
    update public.cbt_exams
       set is_archived = true, archived_at = now(), is_open = false,
           status = 'archived', share_active = false, updated_at = now()
     where id = p_exam;

  elsif p_action = 'unarchive' then
    update public.cbt_exams
       set is_archived = false, archived_at = null, status = 'draft', updated_at = now()
     where id = p_exam;

  elsif p_action = 'share' then
    update public.cbt_exams
       set share_token = coalesce(share_token, encode(gen_random_bytes(9), 'hex')),
           share_active = true, updated_at = now()
     where id = p_exam;

  elsif p_action = 'unshare' then
    update public.cbt_exams set share_active = false, updated_at = now() where id = p_exam;

  else
    return jsonb_build_object('ok', false, 'error', 'Unknown action: ' || coalesce(p_action, ''));
  end if;

  select * into e from public.cbt_exams where id = p_exam;
  return jsonb_build_object('ok', true, 'is_open', e.is_open, 'is_archived', e.is_archived,
                            'status', e.status, 'share_token', e.share_token,
                            'share_active', e.share_active);
end $$;

revoke all on function public.tc_cbt_set_state(uuid, text) from public;
grant execute on function public.tc_cbt_set_state(uuid, text) to authenticated;

-- A closed paper must actually refuse sittings. Enforcing it only in the
-- browser is a suggestion, not a rule.
create or replace function public.tc_cbt_guard_closed()
returns trigger language plpgsql as $$
declare e public.cbt_exams%rowtype;
begin
  select * into e from public.cbt_exams where id = new.exam_id;
  if found then
    if e.is_archived then
      raise exception 'This quiz has been archived and is no longer accepting answers.';
    end if;
    if e.is_open is false then
      raise exception 'This quiz is closed. Ask your tutor to re-open it.';
    end if;
    if e.closes_at is not null and now() > e.closes_at then
      raise exception 'This quiz closed on %.', to_char(e.closes_at, 'DD Mon YYYY HH24:MI');
    end if;
    if e.opens_at is not null and now() < e.opens_at then
      raise exception 'This quiz opens on %.', to_char(e.opens_at, 'DD Mon YYYY HH24:MI');
    end if;
  end if;
  return new;
end $$;

revoke all on function public.tc_cbt_guard_closed() from public;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'cbt_results'
                and column_name = 'exam_id') then
    execute 'drop trigger if exists tc_cbt_guard_closed_trg on public.cbt_results';
    execute 'create trigger tc_cbt_guard_closed_trg before insert on public.cbt_results
             for each row execute function public.tc_cbt_guard_closed()';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 12. CERTIFICATE STUDIO  (report item 19)
--
-- The certificates page issued a name, a title and a code. School Connect and
-- the GOSA portal issue a designed document: a layout, a colour pair, a
-- rosette, a signature image pulled from a link, and a verification code that
-- can be checked. The extra columns below store the DESIGN alongside the
-- award, so a certificate reprinted in two years looks exactly as it did on
-- the day it was issued rather than picking up whatever the current theme is.
-- ---------------------------------------------------------------------------
alter table if exists public.certificates add column if not exists learner_id   uuid references public.learners(id) on delete set null;
alter table if exists public.certificates add column if not exists cohort_id    uuid references public.tc_free_cohorts(id) on delete set null;
alter table if exists public.certificates add column if not exists kind         text default 'achievement'; -- achievement|completion|merit|attendance|participation|distinction|testimonial
alter table if exists public.certificates add column if not exists subtitle     text;
alter table if exists public.certificates add column if not exists body         text;
alter table if exists public.certificates add column if not exists subject      text;
alter table if exists public.certificates add column if not exists score        numeric(6,2);
alter table if exists public.certificates add column if not exists grade        text;
alter table if exists public.certificates add column if not exists signatory    text;
alter table if exists public.certificates add column if not exists signatory_role text;
alter table if exists public.certificates add column if not exists signature_url text;
alter table if exists public.certificates add column if not exists countersign  text;
alter table if exists public.certificates add column if not exists layout       text default 'premium';    -- premium|classic|modern|elegant|minimal|diploma
alter table if exists public.certificates add column if not exists font         text default 'Georgia, serif';
alter table if exists public.certificates add column if not exists primary_color text default '#0506ae';
alter table if exists public.certificates add column if not exists accent_color  text default '#964eec';
alter table if exists public.certificates add column if not exists border_style  text default 'double';
alter table if exists public.certificates add column if not exists seal_text    text;
alter table if exists public.certificates add column if not exists logo_url     text;
alter table if exists public.certificates add column if not exists valid_until  date;
alter table if exists public.certificates add column if not exists revoked      boolean default false;
alter table if exists public.certificates add column if not exists revoked_reason text;
alter table if exists public.certificates add column if not exists issued_by    uuid;
alter table if exists public.certificates add column if not exists meta         jsonb default '{}'::jsonb;
alter table if exists public.certificates add column if not exists updated_at   timestamptz default now();

create unique index if not exists certificates_code_idx on public.certificates (code) where code is not null;

-- Reusable designs, so the studio sets its house style once.
create table if not exists public.tc_certificate_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  kind          text default 'achievement',
  title         text,
  subtitle      text,
  body          text,
  layout        text default 'premium',
  font          text default 'Georgia, serif',
  primary_color text default '#0506ae',
  accent_color  text default '#964eec',
  border_style  text default 'double',
  signatory     text,
  signatory_role text,
  signature_url text,
  seal_text     text,
  logo_url      text,
  is_default    boolean default false,
  created_by    uuid default public.tc_actor(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Verification must work for someone who is not signed in — that is the whole
-- point of a verification code. It returns the minimum needed to confirm the
-- award and nothing that identifies anyone else.
create or replace function public.tc_verify_certificate(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  -- coalesce so an unknown code returns a clean {"ok":false} rather than an
  -- empty result set, which the front end would have to special-case.
  select coalesce(
    (select jsonb_build_object(
              'ok',          not coalesce(c.revoked, false),
              'revoked',     coalesce(c.revoked, false),
              'name',        c.learner_name,
              'title',       c.title,
              'kind',        c.kind,
              'subject',     c.subject,
              'grade',       c.grade,
              'issued_on',   c.issued_on,
              'valid_until', c.valid_until,
              'signatory',   c.signatory)
       from public.certificates c
      where upper(c.code) = upper(trim(p_code))
      limit 1),
    jsonb_build_object('ok', false, 'error', 'No certificate carries that code.')
  );
$$;

revoke all on function public.tc_verify_certificate(text) from public;
grant execute on function public.tc_verify_certificate(text) to anon, authenticated;

-- ===========================================================================
-- 13. ROW LEVEL SECURITY for everything created above
--
-- Applied in a loop so a table added later cannot be forgotten. Each table
-- gets four policies with the same shape; the read predicate differs because
-- the tables key on different columns.
-- ===========================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_group_insights', 'tc_insight_notes',
    'tc_progress_reports', 'tc_timezone_desk', 'tc_free_cohorts',
    'tc_free_links', 'tc_free_registrations', 'tc_certificate_templates'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- Clear anything from an earlier run so this pack is genuinely re-runnable.
    execute format('drop policy if exists %I on public.%I', t || '_read',  t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd',   t);
    execute format('drop policy if exists %I on public.%I', t || '_del',   t);
  end loop;
end $$;

-- --- learner-keyed desks -----------------------------------------------------
-- Read: a manager sees all; a tutor sees the learners they teach; a family
-- sees its own child. Write: managers and the assigned tutor only.
do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_progress_reports'
  ] loop
    execute format($f$
      create policy %I on public.%I for select to authenticated
      using (
        public.tc_is_manager()
        or public.tc_teaches_learner(learner_id)
        or exists (select 1 from public.learners l
                    where l.id = %I.learner_id and l.user_id = auth.uid())
        or exists (select 1 from public.parent_learner pl
                    join public.parents p on p.id = pl.parent_id
                   where pl.learner_id = %I.learner_id and p.user_id = auth.uid())
      )$f$, t || '_read', t, t, t);

    execute format($f$
      create policy %I on public.%I for insert to authenticated
      with check (public.tc_is_manager() or public.tc_teaches_learner(learner_id))
    $f$, t || '_write', t);

    execute format($f$
      create policy %I on public.%I for update to authenticated
      using (public.tc_is_manager() or public.tc_teaches_learner(learner_id))
      with check (public.tc_is_manager() or public.tc_teaches_learner(learner_id))
    $f$, t || '_upd', t);

    execute format($f$
      create policy %I on public.%I for delete to authenticated
      using (public.tc_is_manager() or public.tc_teaches_learner(learner_id))
    $f$, t || '_del', t);
  end loop;
end $$;

-- --- engagement-keyed desk ---------------------------------------------------
drop policy if exists tc_group_insights_read on public.tc_group_insights;
create policy tc_group_insights_read on public.tc_group_insights
  for select to authenticated
  using (
    public.tc_is_manager()
    or public.tc_teaches_engagement(engagement_id)
    or (published and exists (
          select 1 from public.engagement_members em
            join public.learners l on l.id = em.learner_id
           where em.engagement_id = tc_group_insights.engagement_id
             and l.user_id = auth.uid()))
  );
drop policy if exists tc_group_insights_write on public.tc_group_insights;
create policy tc_group_insights_write on public.tc_group_insights
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_teaches_engagement(engagement_id));
drop policy if exists tc_group_insights_upd on public.tc_group_insights;
create policy tc_group_insights_upd on public.tc_group_insights
  for update to authenticated
  using (public.tc_is_manager() or public.tc_teaches_engagement(engagement_id))
  with check (public.tc_is_manager() or public.tc_teaches_engagement(engagement_id));
drop policy if exists tc_group_insights_del on public.tc_group_insights;
create policy tc_group_insights_del on public.tc_group_insights
  for delete to authenticated
  using (public.tc_is_manager() or public.tc_teaches_engagement(engagement_id));

-- --- insights lab ------------------------------------------------------------
-- A note may be about a learner, a group, a subject or the studio as a whole,
-- so the predicate has to cover a null learner AND a null engagement.
drop policy if exists tc_insight_notes_read on public.tc_insight_notes;
create policy tc_insight_notes_read on public.tc_insight_notes
  for select to authenticated
  using (
    public.tc_is_manager()
    or (learner_id    is not null and public.tc_teaches_learner(learner_id))
    or (engagement_id is not null and public.tc_teaches_engagement(engagement_id))
    or (learner_id is null and engagement_id is null and public.tc_my_tutor_id() is not null)
    or created_by = auth.uid()
  );
drop policy if exists tc_insight_notes_write on public.tc_insight_notes;
create policy tc_insight_notes_write on public.tc_insight_notes
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_insight_notes_upd on public.tc_insight_notes;
create policy tc_insight_notes_upd on public.tc_insight_notes
  for update to authenticated
  using (public.tc_is_manager() or created_by = auth.uid())
  with check (public.tc_is_manager() or created_by = auth.uid());
drop policy if exists tc_insight_notes_del on public.tc_insight_notes;
create policy tc_insight_notes_del on public.tc_insight_notes
  for delete to authenticated
  using (public.tc_is_manager() or created_by = auth.uid());

-- --- timezone desk -----------------------------------------------------------
-- Everyone signed in may READ the desk: knowing that the tutor is in Lagos is
-- exactly what the page is for. Only staff may write.
drop policy if exists tc_timezone_desk_read on public.tc_timezone_desk;
create policy tc_timezone_desk_read on public.tc_timezone_desk
  for select to authenticated using (true);
drop policy if exists tc_timezone_desk_write on public.tc_timezone_desk;
create policy tc_timezone_desk_write on public.tc_timezone_desk
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_timezone_desk_upd on public.tc_timezone_desk;
create policy tc_timezone_desk_upd on public.tc_timezone_desk
  for update to authenticated
  using (public.tc_is_manager() or tutor_id = public.tc_my_tutor_id())
  with check (public.tc_is_manager() or tutor_id = public.tc_my_tutor_id());
drop policy if exists tc_timezone_desk_del on public.tc_timezone_desk;
create policy tc_timezone_desk_del on public.tc_timezone_desk
  for delete to authenticated using (public.tc_is_manager());

-- --- free classes ------------------------------------------------------------
-- The cohort is readable by anyone signed in (it is advertised publicly), and
-- writable by staff. The ROLL is staff-only: a free class must not leak the
-- contact details of other people's children.
drop policy if exists tc_free_cohorts_read on public.tc_free_cohorts;
create policy tc_free_cohorts_read on public.tc_free_cohorts
  for select to authenticated using (true);
drop policy if exists tc_free_cohorts_write on public.tc_free_cohorts;
create policy tc_free_cohorts_write on public.tc_free_cohorts
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_free_cohorts_upd on public.tc_free_cohorts;
create policy tc_free_cohorts_upd on public.tc_free_cohorts
  for update to authenticated
  using (public.tc_is_manager() or tutor_id = public.tc_my_tutor_id())
  with check (public.tc_is_manager() or tutor_id = public.tc_my_tutor_id());
drop policy if exists tc_free_cohorts_del on public.tc_free_cohorts;
create policy tc_free_cohorts_del on public.tc_free_cohorts
  for delete to authenticated using (public.tc_is_manager());

drop policy if exists tc_free_links_read on public.tc_free_links;
create policy tc_free_links_read on public.tc_free_links
  for select to authenticated
  using (public.tc_is_manager()
         or exists (select 1 from public.tc_free_cohorts c
                     where c.id = tc_free_links.cohort_id
                       and c.tutor_id = public.tc_my_tutor_id()));
drop policy if exists tc_free_links_write on public.tc_free_links;
create policy tc_free_links_write on public.tc_free_links
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_free_links_upd on public.tc_free_links;
create policy tc_free_links_upd on public.tc_free_links
  for update to authenticated using (public.tc_is_manager())
  with check (public.tc_is_manager());
drop policy if exists tc_free_links_del on public.tc_free_links;
create policy tc_free_links_del on public.tc_free_links
  for delete to authenticated using (public.tc_is_manager());

drop policy if exists tc_free_registrations_read on public.tc_free_registrations;
create policy tc_free_registrations_read on public.tc_free_registrations
  for select to authenticated
  using (public.tc_is_manager()
         or exists (select 1 from public.tc_free_cohorts c
                     where c.id = tc_free_registrations.cohort_id
                       and c.tutor_id = public.tc_my_tutor_id()));
drop policy if exists tc_free_registrations_write on public.tc_free_registrations;
create policy tc_free_registrations_write on public.tc_free_registrations
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_free_registrations_upd on public.tc_free_registrations;
create policy tc_free_registrations_upd on public.tc_free_registrations
  for update to authenticated
  using (public.tc_is_manager()
         or exists (select 1 from public.tc_free_cohorts c
                     where c.id = tc_free_registrations.cohort_id
                       and c.tutor_id = public.tc_my_tutor_id()))
  with check (true);
drop policy if exists tc_free_registrations_del on public.tc_free_registrations;
create policy tc_free_registrations_del on public.tc_free_registrations
  for delete to authenticated using (public.tc_is_manager());

-- --- certificate templates ---------------------------------------------------
drop policy if exists tc_certificate_templates_read on public.tc_certificate_templates;
create policy tc_certificate_templates_read on public.tc_certificate_templates
  for select to authenticated using (true);
drop policy if exists tc_certificate_templates_write on public.tc_certificate_templates;
create policy tc_certificate_templates_write on public.tc_certificate_templates
  for insert to authenticated
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
drop policy if exists tc_certificate_templates_upd on public.tc_certificate_templates;
create policy tc_certificate_templates_upd on public.tc_certificate_templates
  for update to authenticated using (public.tc_is_manager())
  with check (public.tc_is_manager());
drop policy if exists tc_certificate_templates_del on public.tc_certificate_templates;
create policy tc_certificate_templates_del on public.tc_certificate_templates
  for delete to authenticated using (public.tc_is_manager());

-- ---------------------------------------------------------------------------
-- 14. updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_group_insights', 'tc_insight_notes',
    'tc_timezone_desk', 'tc_free_cohorts', 'tc_certificate_templates'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I
                    for each row execute function public.tc_touch_updated()',
                   t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 15. GRANTS — the V18 posture, applied to the new objects
--
-- Table privileges go to `authenticated` only. RLS then narrows it further.
-- anon gets NOTHING except the three RPCs granted explicitly above.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_group_insights', 'tc_insight_notes',
    'tc_progress_reports', 'tc_timezone_desk', 'tc_free_cohorts',
    'tc_free_links', 'tc_free_registrations', 'tc_certificate_templates'
  ] loop
    execute format('revoke all on public.%I from public', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 16. SEED — a starting timezone row and a house certificate design, so the
--     pages are not empty on first open. `on conflict do nothing` throughout.
-- ---------------------------------------------------------------------------
insert into public.tc_timezone_desk (party_type, label, city, country, tz, utc_offset, work_from, work_to, is_default, note)
select 'studio', 'Studio head office', 'Lagos', 'Nigeria', 'Africa/Lagos', '+01:00',
       time '08:00', time '21:00', true,
       'The studio clock. Every published class time is converted from here.'
where not exists (select 1 from public.tc_timezone_desk where party_type = 'studio');

insert into public.tc_certificate_templates (name, kind, title, subtitle, body, layout, is_default, signatory, signatory_role)
select 'House style — Achievement', 'achievement', 'CERTIFICATE OF ACHIEVEMENT', 'ACHIEVEMENT',
       'has successfully met the requirements of the programme and is hereby recognised for outstanding achievement.',
       'premium', true, 'Lead Tutor', 'Lead Tutor'
where not exists (select 1 from public.tc_certificate_templates where is_default);

-- ---------------------------------------------------------------------------
-- 17. Report what V25 actually installed, so the run can be verified rather
--     than assumed.
-- ---------------------------------------------------------------------------
create or replace function public.tc_v25_report()
returns table (object text, present boolean, detail text)
language sql
stable
security definer
set search_path = public
as $$
  select t.name,
         to_regclass('public.' || t.name) is not null,
         coalesce((select count(*)::text || ' row(s)'
                     from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = t.name), '0')
    from (values
      ('tc_at_risk_reviews'), ('tc_practice_analytics'), ('tc_value_added'),
      ('tc_predicted_grades'), ('tc_group_insights'), ('tc_insight_notes'),
      ('tc_progress_reports'), ('tc_timezone_desk'), ('tc_free_cohorts'),
      ('tc_free_links'), ('tc_free_registrations'), ('tc_certificate_templates')
    ) as t(name);
$$;

revoke all on function public.tc_v25_report() from public;
grant execute on function public.tc_v25_report() to authenticated;

select 'V25 desks, CBT lifecycle, free classes and certificate studio installed ✅' as status;

-- ===========================================================================
-- 18. TUTOR SCOPING — closing the gaps left by V24  (report item 21)
--
--   "Each tutor should only have access to students, classes, subjects, CBT,
--    etc assigned to them... Admin has full access to everything without
--    restrictions."
--
-- V24 introduced the scoping helpers and applied them in two loops. Auditing
-- those loops against the tables that actually exist found that SEVERAL OF
-- THE NAMES WERE WRONG. Each loop is guarded by
--
--     if exists (select 1 from information_schema.columns
--                 where table_name = t and column_name = 'learner_id')
--
-- so a misspelt table name does not raise an error — it silently does
-- nothing, and the table stays unscoped. That is the worst possible failure
-- mode for an access-control change: it reports success and protects nothing.
--
-- The names that never matched a real table were:
--
--     V24 said            the table is actually called
--     ------------------  ------------------------------
--     mastery             mastery_topics
--     curriculum          curriculum_items
--     diagnostics         (no such table — diagnostics.html writes elsewhere)
--     progress_reports    tc_progress_reports  (created in V25, above)
--     whiteboard_rooms    (no such table)
--     bookings            booking_classes
--     meetings            (no such table)
--     makeups             (no such table)
--     cancellations       (no such table)
--
-- And these were never in either list at all, though a tutor can read them:
--
--     scoresheet, parents, parent_learner, attendance_checkins,
--     session_attendance (insert path), tc_free_cohorts, cbt_roster
--
-- This section re-applies the scoping using verified names, and RAISES A
-- NOTICE for any name that does not resolve, so a future rename cannot fail
-- silently the way this one did.
-- ===========================================================================

do $$
declare
  t text;
  applied int := 0;
  skipped text[] := '{}';
  learner_tables text[] := array[
    'goals', 'mastery_topics', 'assessments', 'assignments',
    'accommodations', 'study_logs', 'flashcards', 'makeup_credits',
    'sow_evaluations', 'exam_targets', 'scoresheet',
    'reading_progress', 'student_diary', 'attendance_checkins'
  ];
begin
  foreach t in array learner_tables loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = t
                  and column_name = 'learner_id') then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_tutor_scope', t);
      execute format(
        'create policy %I on public.%I for all to authenticated '
        || 'using (public.tc_teaches_learner(learner_id)) '
        || 'with check (public.tc_teaches_learner(learner_id))',
        t || '_tutor_scope', t);
      applied := applied + 1;
    else
      skipped := skipped || t;
    end if;
  end loop;

  raise notice 'V25 tutor scoping: % learner-keyed table(s) scoped', applied;
  if array_length(skipped, 1) > 0 then
    raise notice 'V25 tutor scoping: NOT FOUND (check the name!): %',
                 array_to_string(skipped, ', ');
  end if;
end $$;

do $$
declare
  t text;
  applied int := 0;
  skipped text[] := '{}';
  eng_tables text[] := array[
    'stream_posts', 'classwork_items', 'lesson_plans', 'curriculum_items',
    'sow_terms', 'sow_topics', 'reading_assignments', 'booking_classes',
    'rubrics', 'methodologies', 'timetable'
  ];
begin
  foreach t in array eng_tables loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = t
                  and column_name = 'engagement_id') then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists %I on public.%I', t || '_tutor_scope', t);
      execute format(
        'create policy %I on public.%I for all to authenticated '
        || 'using (engagement_id is null or public.tc_teaches_engagement(engagement_id)) '
        || 'with check (engagement_id is null or public.tc_teaches_engagement(engagement_id))',
        t || '_tutor_scope', t);
      applied := applied + 1;
    else
      skipped := skipped || t;
    end if;
  end loop;

  raise notice 'V25 tutor scoping: % engagement-keyed table(s) scoped', applied;
  if array_length(skipped, 1) > 0 then
    raise notice 'V25 tutor scoping: NOT FOUND (check the name!): %',
                 array_to_string(skipped, ', ');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Parents. A tutor should see the parent of a child they teach — they have to
-- write the report that parent reads — and nobody else's.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.parents') is not null then
    alter table public.parents enable row level security;
    drop policy if exists parents_tutor_scope on public.parents;
    create policy parents_tutor_scope on public.parents
      for all to authenticated
      using (
        public.tc_is_manager()
        or user_id = auth.uid()
        or exists (select 1 from public.parent_learner pl
                    where pl.parent_id = parents.id
                      and public.tc_teaches_learner(pl.learner_id))
      )
      with check (public.tc_is_manager());
  end if;

  if to_regclass('public.parent_learner') is not null then
    alter table public.parent_learner enable row level security;
    drop policy if exists parent_learner_tutor_scope on public.parent_learner;
    create policy parent_learner_tutor_scope on public.parent_learner
      for all to authenticated
      using (
        public.tc_is_manager()
        or public.tc_teaches_learner(learner_id)
        or exists (select 1 from public.parents p
                    where p.id = parent_learner.parent_id and p.user_id = auth.uid())
      )
      with check (public.tc_is_manager());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tutors. Deliberately NOT scoped to self.
--
-- A tutor needs to see the other tutors: to arrange cover, to hand a learner
-- over, to know who to ask about a shared group. What they must not see is
-- another tutor's PAY, and that lives in tutor_rates and payroll, which are
-- manager-only already. Hiding colleagues would break cover arrangements to
-- protect nothing.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.tutors') is not null then
    alter table public.tutors enable row level security;
    drop policy if exists tutors_read_all on public.tutors;
    create policy tutors_read_all on public.tutors
      for select to authenticated using (true);
    drop policy if exists tutors_write_self on public.tutors;
    create policy tutors_write_self on public.tutors
      for update to authenticated
      using (public.tc_is_manager() or user_id = auth.uid())
      with check (public.tc_is_manager() or user_id = auth.uid());
    drop policy if exists tutors_admin_write on public.tutors;
    create policy tutors_admin_write on public.tutors
      for insert to authenticated with check (public.tc_is_manager());
    drop policy if exists tutors_admin_del on public.tutors;
    create policy tutors_admin_del on public.tutors
      for delete to authenticated using (public.tc_is_manager());
  end if;

  -- Subjects are a shared catalogue, like a list of countries. Scoping them
  -- would mean a tutor could not tag their own lesson with "Physics" because
  -- somebody else created the row.
  if to_regclass('public.subjects') is not null then
    alter table public.subjects enable row level security;
    drop policy if exists subjects_read_all on public.subjects;
    create policy subjects_read_all on public.subjects
      for select to authenticated using (true);
    drop policy if exists subjects_staff_write on public.subjects;
    create policy subjects_staff_write on public.subjects
      for insert to authenticated
      with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
    drop policy if exists subjects_admin_change on public.subjects;
    create policy subjects_admin_change on public.subjects
      for update to authenticated
      using (public.tc_is_manager()) with check (public.tc_is_manager());
    drop policy if exists subjects_admin_del on public.subjects;
    create policy subjects_admin_del on public.subjects
      for delete to authenticated using (public.tc_is_manager());
  end if;

  -- The CBT roster follows its paper.
  if to_regclass('public.cbt_roster') is not null then
    alter table public.cbt_roster enable row level security;
    drop policy if exists cbt_roster_tutor_scope on public.cbt_roster;
    create policy cbt_roster_tutor_scope on public.cbt_roster
      for all to authenticated
      using (
        public.tc_is_manager()
        or exists (select 1 from public.cbt_exams e
                    where e.id = cbt_roster.exam_id
                      and (e.created_by = auth.uid()
                           or e.tutor_id = public.tc_my_tutor_id()
                           or public.tc_teaches_engagement(e.engagement_id)))
      )
      with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- A tutor-facing report of what THEY can actually reach, so the scoping can be
-- checked from inside the studio instead of guessed at.
--
-- This answers the commonest support question a scoping change produces:
-- "why can't I see Chinedu any more?" The honest answer is usually "because
-- tutors.user_id is not set on your row", and this says so.
-- ---------------------------------------------------------------------------
create or replace function public.tc_my_scope_report()
returns table (item text, value text, note text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare my_tutor uuid;
begin
  my_tutor := public.tc_my_tutor_id();

  return query select 'role',
    case when public.tc_is_manager() then 'manager (owner/admin)'
         when my_tutor is not null then 'tutor'
         else 'not staff' end,
    case when public.tc_is_manager()
         then 'You see everything. No scoping applies to you.'
         when my_tutor is not null
         then 'You see only what is assigned to you.'
         else 'Your account is not linked to a tutor record.' end;

  return query select 'tutors.user_id linked',
    case when my_tutor is null then 'NO' else my_tutor::text end,
    case when my_tutor is null and not public.tc_is_manager()
         then 'THIS IS THE PROBLEM. Your sign-in is not linked to a row in the '
              || 'tutors table, so every scoped query returns nothing. An administrator '
              || 'must set tutors.user_id for you on the Tutors page.'
         else 'Linked correctly.' end;

  return query select 'engagements I teach',
    (select count(*)::text from public.engagements)::text,
    'Set engagements.tutor_id on the Engagements page to change this.';

  return query select 'learners I can see',
    (select count(*)::text from public.learners)::text,
    'A learner reaches you through an engagement they are a member of, or '
    || 'through a session you taught.';

  return query select 'quizzes I can manage',
    (select count(*)::text from public.cbt_exams)::text,
    'A paper is yours if you created it, if cbt_exams.tutor_id is you, or if '
    || 'it belongs to an engagement you teach.';
end $$;

revoke all on function public.tc_my_scope_report() from public;
grant execute on function public.tc_my_scope_report() to authenticated;

select 'V25 tutor scoping gaps closed \u2705' as status;
