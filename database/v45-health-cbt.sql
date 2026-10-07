-- ═══════════════════════════════════════════════════════════════════════
-- V45 — PLATFORM HEALTH MONITORING + ADVANCED CBT (round 9)
--
-- Part A (from School Connect / GOSA Portal + DramaConnect v14.2):
--   per-source keep-alive observability. The portal already HAD ten
--   anti-pause layers (site heartbeat, GitHub Actions, Vercel cron, Apps
--   Script, watchdog, auto-restore, db-backup, edge pings, manual button,
--   pg_cron) but only the LAST ping was ever visible. This installs the
--   14-layer monitoring contract:
--     • tc_keepalive_sources   — one row per layer, with last ping + count
--     • tc_keep_alive(src)     — upgraded: still writes the heartbeat AND
--                                 upserts the per-source row (real DB write)
--     • tc_keepalive_layers()  — the Platform Health feed: every layer with
--                                 hours-since, freshness, quorum detection
--                                 and the 168-hour pause countdown.
--
-- Part B (from HMG Academy CBT System + CBTGen + GOSA multi-subject parity):
--     • cbt_exams.negative_mark / cbt_results.cert_code — negative marking
--       and verifiable submission receipts
--     • trg_cbt_assignment_sync — publishing a GRADED CBT to a class now
--       creates (and keeps in sync) a matching row in public.assignments,
--       so CBT assignments appear on the Homework page and every learner
--       work board automatically, by nature
--     • tc_my_quizzes() — the learner/parent feed for the dedicated
--       "My quizzes" page: every CBT grouped by nature (graded / practice)
--       with windows, attempts, best and last scores
--     • tc_cbt_cumulative() — collates every CBT score per subject
--       (count, average, best, last) for the report-card pull
--
-- Part C (from DramaConnect): complaints become a suggestion box with
--   anonymous submit + triage statuses; tc_absentee_followup() powers the
--   care list on the attendance page.
--
-- Idempotent throughout: create if not exists / create or replace.
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════ PART A — keep-alive observability ═════════════════

create table if not exists public.tc_keepalive_sources (
  source        text primary key,
  last_ping_at  timestamptz not null default now(),
  ping_count    bigint not null default 1,
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.tc_keepalive_sources enable row level security;
revoke all on table public.tc_keepalive_sources from anon, authenticated;

/* Every heartbeat now records WHO sent it, not just that someone did.
   Signature and return value are unchanged (still returns last_ping), so
   app.js, api/keepalive.js, the GitHub workflows and the Apps Script all
   keep working without modification. */
create or replace function public.tc_keep_alive(src text default 'unknown')
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out timestamptz;
begin
  update public.tc_heartbeat
     set last_ping = now(), last_source = coalesce(src, 'unknown'), ping_count = ping_count + 1
   where id = 1
   returning last_ping into v_out;

  insert into public.tc_keepalive_sources (source, last_ping_at, ping_count, first_seen_at, updated_at)
  values (coalesce(src, 'unknown'), now(), 1, now(), now())
  on conflict (source) do update
    set last_ping_at = now(),
        ping_count    = public.tc_keepalive_sources.ping_count + 1,
        updated_at    = now();
  return v_out;
end $$;
grant execute on function public.tc_keep_alive(text) to anon, authenticated;

/* The Platform Health feed: every layer, when it last ran, whether the
   project is protected by a quorum of independent layers, and how long it
   is until the 7-day inactivity pause could bite. */
create or replace function public.tc_keepalive_layers()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok',            true,
    'last_ping',     h.last_ping,
    'last_source',   h.last_source,
    'hours_since',   round(extract(epoch from (now() - h.last_ping)) / 3600.0, 2),
    'days_left',     greatest(0, round(7 - extract(epoch from (now() - h.last_ping)) / 86400.0, 2)),
    'pause_risk_at', h.last_ping + interval '7 days',
    'state', case
               when now() - h.last_ping < interval '3 days' then 'healthy'
               when now() - h.last_ping < interval '5 days' then 'warning'
               else 'critical'
             end,
    'total_pings',   h.ping_count,
    'fresh_count',   (select count(*) from public.tc_keepalive_sources s
                       where now() - s.last_ping_at < interval '72 hours'),
    'quorum',        (select count(*) >= 3 from public.tc_keepalive_sources s
                       where now() - s.last_ping_at < interval '72 hours'),
    'sources',       (select coalesce(jsonb_agg(jsonb_build_object(
                        'source',       s.source,
                        'last_ping_at', s.last_ping_at,
                        'hours_since',  round(extract(epoch from (now() - s.last_ping_at)) / 3600.0, 2),
                        'ping_count',   s.ping_count,
                        'first_seen',   s.first_seen_at
                      ) order by s.last_ping_at desc), '[]'::jsonb)
                      from public.tc_keepalive_sources s)
  )
  from public.tc_heartbeat h
  where h.id = 1;
$$;
grant execute on function public.tc_keepalive_layers() to authenticated;
revoke all on function public.tc_keepalive_layers() from public, anon;

-- ═══════════════════════ PART B — advanced CBT ═══════════════════════

-- Negative marking (HMG Academy CBT System parity: wrong answers deduct a
-- configurable fraction, score clamped at zero — set on the paper).
alter table if exists public.cbt_exams   add column if not exists negative_mark numeric default 0;
-- UPGRADE-ORDER GUARD (round 9 field fix): the assignment-sync trigger below
-- lists status, is_open, engagement_id, quiz_kind, title, close_at and
-- questions in its UPDATE OF clause — every one of them must exist at
-- CREATE TRIGGER time. Complete-schema.sql adds them early, but this
-- migration must be safe to run standalone on an older project too, so it
-- guarantees the version-added ones itself. Types mirror complete-schema.
alter table if exists public.cbt_exams   add column if not exists is_open        boolean default true;
alter table if exists public.cbt_exams   add column if not exists engagement_id  uuid;
alter table if exists public.cbt_exams   add column if not exists quiz_kind      text default 'graded';
alter table if exists public.cbt_exams   add column if not exists close_at       timestamptz;
alter table if exists public.cbt_exams   add column if not exists start_at       timestamptz;
-- Verifiable submission receipt: every graded sitting carries a code the
-- candidate can keep and the studio can check against the results audit.
alter table if exists public.cbt_results add column if not exists cert_code text;
create index if not exists cbt_results_cert_code_idx on public.cbt_results (cert_code);

-- CBT → Homework auto-sync. Publishing a GRADED paper to a class creates
-- the matching assignment row automatically (and keeps it in sync, or
-- removes it when the paper is unpublished). Self / review quizzes are
-- deliberately EXEMPT: by nature they belong on the practice surface, not
-- the homework register.
alter table public.assignments add column if not exists kind text default 'homework';
alter table public.assignments add column if not exists cbt_exam_id uuid references public.cbt_exams(id) on delete cascade;
create unique index if not exists assignments_cbt_exam_uniq
  on public.assignments (cbt_exam_id) where cbt_exam_id is not null;

create or replace function public.tc_sync_cbt_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pub boolean;
  v_max numeric;
begin
  v_pub := (lower(coalesce(new.status, 'draft')) in ('published','live','open'))
           or coalesce(new.is_open, false);

  if v_pub and new.engagement_id is not null
     and coalesce(new.quiz_kind, 'graded') = 'graded' then

    v_max := (select coalesce(sum(coalesce((q->>'mark')::numeric, 1)), 0)
                from jsonb_array_elements(
                  case when jsonb_typeof(new.questions) = 'array' then new.questions else '[]'::jsonb end) q);

    insert into public.assignments
      (engagement_id, learner_id, title, due_on, max_score, status, kind, cbt_exam_id)
    values
      (new.engagement_id, null,
       '🧪 CBT: ' || new.title,
       new.close_at::date,
       nullif(v_max, 0),
       'set', 'cbt', new.id)
    on conflict (cbt_exam_id) where cbt_exam_id is not null do update
      set engagement_id = excluded.engagement_id,
          title         = excluded.title,
          due_on        = excluded.due_on,
          max_score     = excluded.max_score;

  else
    -- Unpublished, unclassed or practice papers carry no homework row.
    delete from public.assignments where cbt_exam_id = new.id and kind = 'cbt';
  end if;
  return new;
end $$;

drop trigger if exists trg_cbt_assignment_sync on public.cbt_exams;
create trigger trg_cbt_assignment_sync
  after insert or update of status, is_open, engagement_id, quiz_kind, title, close_at, questions
  on public.cbt_exams
  for each row execute function public.tc_sync_cbt_assignment();

-- The learner / parent quiz feed (dedicated "My quizzes" page). Every CBT
-- aimed at the learner's classes, grouped by nature, with attempts.
create or replace function public.tc_my_quizzes(p_learner_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_learner public.learners%rowtype;
  v_eng_ids uuid[];
  v_graded jsonb;
  v_practice jsonb;
begin
  if p_learner_id is null then
    select l.* into v_learner from public.learners l where l.user_id = auth.uid() limit 1;
  else
    if not public.is_family_of_learner(p_learner_id) and not public.tc_is_manager() then
      return jsonb_build_object('ok', false, 'reason', 'not_your_child');
    end if;
    select l.* into v_learner from public.learners l where l.id = p_learner_id limit 1;
  end if;
  if v_learner.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_learner_record');
  end if;

  select coalesce(array_agg(em.engagement_id), '{}') into v_eng_ids
    from public.engagement_members em
   where em.learner_id = v_learner.id and coalesce(em.status, 'active') = 'active';

  select coalesce(jsonb_agg(row order by published_at desc), '[]'::jsonb) into v_graded
    from (
      select jsonb_build_object(
               'id', x.id, 'code', x.code, 'title', x.title, 'minutes', x.duration_min,
               'subject', x.subject, 'multi', coalesce(x.multi_subject, false),
               'subjects', coalesce(x.subjects, '[]'::jsonb),
               'negative_mark', coalesce(x.negative_mark, 0),
               'opens', x.start_at, 'closes', x.close_at,
               'engagement', (select e.name from public.engagements e where e.id = x.engagement_id),
               'published_at', x.created_at,
               'attempts', (select count(*) from public.cbt_results r
                             where r.exam_id = x.id
                               and (r.learner_id = v_learner.id
                                    or (v_learner.student_no is not null
                                        and lower(r.student_no) = lower(v_learner.student_no)))),
               'best', (select max(round(r.score / nullif(r.max_score,0) * 100))
                          from public.cbt_results r
                         where r.exam_id = x.id
                           and (r.learner_id = v_learner.id
                                or (v_learner.student_no is not null
                                    and lower(r.student_no) = lower(v_learner.student_no)))),
               'last_score', (select round(r.score / nullif(r.max_score,0) * 100)
                                from public.cbt_results r
                               where r.exam_id = x.id
                                 and (r.learner_id = v_learner.id
                                      or (v_learner.student_no is not null
                                          and lower(r.student_no) = lower(v_learner.student_no)))
                               order by r.created_at desc limit 1)
             ) as row,
             x.created_at as published_at
        from public.cbt_exams x
       where x.engagement_id = any(v_eng_ids)
         and coalesce(x.quiz_kind, 'graded') = 'graded'
         and (lower(coalesce(x.status,'draft')) in ('published','live','open')
              or coalesce(x.is_open, false))
    ) g;

  select coalesce(jsonb_agg(row order by published_at desc), '[]'::jsonb) into v_practice
    from (
      select jsonb_build_object(
               'id', x.id, 'code', x.code, 'title', x.title, 'minutes', x.duration_min,
               'subject', x.subject,
               'opens', x.start_at, 'closes', x.close_at,
               'engagement', (select e.name from public.engagements e where e.id = x.engagement_id),
               'published_at', x.created_at,
               'attempts', (select count(*) from public.cbt_results r
                             where r.exam_id = x.id
                               and (r.learner_id = v_learner.id
                                    or (v_learner.student_no is not null
                                        and lower(r.student_no) = lower(v_learner.student_no))))
             ) as row,
             x.created_at as published_at
        from public.cbt_exams x
       where x.engagement_id = any(v_eng_ids)
         and coalesce(x.quiz_kind, 'graded') not in ('graded')
         and (lower(coalesce(x.status,'draft')) in ('published','live','open')
              or coalesce(x.is_open, false))
    ) p;

  return jsonb_build_object(
    'ok', true,
    'learner', jsonb_build_object('id', v_learner.id, 'name', v_learner.full_name),
    'graded', v_graded,
    'practice', v_practice
  );
end $$;
grant execute on function public.tc_my_quizzes(uuid) to authenticated;
revoke all on function public.tc_my_quizzes(uuid) from public, anon;

-- Cumulative CBT collation for the report card: per subject, how many
-- graded CBTs, average / best / last percentage, latest sitting. Reads the
-- scoresheet (where the database trigger already files every graded CBT,
-- overall AND one row per subject), so multi-subject papers are collated
-- per subject automatically.
create or replace function public.tc_cbt_cumulative(p_learner_id uuid, p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_overall jsonb;
begin
  if p_learner_id is null then
    raise exception 'Pick a learner first.';
  end if;
  if not public.is_family_of_learner(p_learner_id) and not public.tc_is_manager() then
    raise exception 'You can only collate CBT scores for your own children.'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'subject', s.subject,
           'count',   s.n,
           'avg',     round(s.avg_pct, 1),
           'best',    round(s.best_pct, 1),
           'last',    round(s.last_pct, 1),
           'last_on', s.last_on
         ) order by s.subject), '[]'::jsonb)
    into v_rows
    from (
      select sc.subject,
             count(*) as n,
             avg(sc.pct) as avg_pct,
             max(sc.pct) as best_pct,
             (array_agg(sc.pct order by sc.taken_on desc))[1] as last_pct,
             max(sc.taken_on) as last_on
        from public.scoresheet sc
       where sc.learner_id = p_learner_id
         and sc.source in ('graded_quiz', 'graded_quiz_subject')
         and (p_from is null or sc.taken_on >= p_from)
         and (p_to   is null or sc.taken_on <= p_to)
       group by sc.subject
    ) s;

  select jsonb_build_object(
    'count', count(*),
    'avg',   round(avg(sc.pct), 1),
    'best',  round(max(sc.pct), 1)
  ) into v_overall
    from public.scoresheet sc
   where sc.learner_id = p_learner_id
     and sc.source in ('graded_quiz', 'graded_quiz_subject')
     and (p_from is null or sc.taken_on >= p_from)
     and (p_to   is null or sc.taken_on <= p_to);

  return jsonb_build_object('ok', true, 'subjects', v_rows, 'overall', v_overall,
                            'from', p_from, 'to', p_to);
end $$;
grant execute on function public.tc_cbt_cumulative(uuid, date, date) to authenticated;
revoke all on function public.tc_cbt_cumulative(uuid, date, date) from public, anon;

-- ═══════════════════════ PART C — DramaConnect ports ═══════════════════════

-- Suggestion box: complaints gain anonymous submit, an author link and the
-- DramaConnect triage statuses (the CRUD form offers them).
alter table public.complaints add column if not exists anonymous boolean default false;
alter table public.complaints add column if not exists submitted_by uuid references public.profiles(id) on delete set null;
alter table public.complaints add column if not exists category text;

-- Care list: learners with repeated absences / no-shows in the recent
-- window, with the parent to contact. Feeds the follow-up section on the
-- attendance page and links straight into round-8 messaging.
create or replace function public.tc_absentee_followup(p_days int default 30, p_threshold int default 2)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if not public.is_tutor() then
    raise exception 'The care list is for studio staff only.'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'learner_id', a.learner_id,
           'learner',    l.full_name,
           'student_no', l.student_no,
           'missed',     a.n,
           'last_miss',  a.last_miss,
           'engagements', a.engagements,
           'parent',     par.full_name,
           'parent_user', par.user_id,
           'phone',      par.phone
         ) order by a.n desc, a.last_miss desc), '[]'::jsonb)
    into v_out
    from (
      select sa.learner_id,
             count(*) as n,
             max(s.starts_at) as last_miss,
             (select coalesce(jsonb_agg(distinct e.name), '[]'::jsonb)
                from public.session_attendance sa2
                join public.sessions s2 on s2.id = sa2.session_id
                join public.engagements e on e.id = s2.engagement_id
               where sa2.learner_id = sa.learner_id
                 and sa2.status in ('absent','no-show')
                 and s2.starts_at >= now() - make_interval(days => greatest(1, p_days))) as engagements
        from public.session_attendance sa
        join public.sessions s on s.id = sa.session_id
       where sa.status in ('absent','no-show')
         and s.starts_at >= now() - make_interval(days => greatest(1, p_days))
       group by sa.learner_id
      having count(*) >= greatest(1, p_threshold)
    ) a
    join public.learners l on l.id = a.learner_id
    left join public.parent_learner pl on pl.learner_id = a.learner_id
    left join public.parents par on par.id = pl.parent_id;
  return jsonb_build_object('ok', true, 'days', p_days, 'threshold', p_threshold, 'list', v_out);
end $$;
grant execute on function public.tc_absentee_followup(int, int) to authenticated;
revoke all on function public.tc_absentee_followup(int, int) from public, anon;

-- tc_my_work v2: homework rows now carry their nature (kind) and, for CBT
-- rows, the quiz code, so the work board can link straight into the runner.
create or replace function public.tc_my_work(p_learner_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_learner_id uuid := p_learner_id;
  v_me public.learners%rowtype;
  v_eng_ids uuid[];
  v_out jsonb;
begin
  if v_learner_id is null then
    select l.* into v_me from public.learners l where l.user_id = auth.uid() limit 1;
  else
    if not public.is_family_of_learner(v_learner_id) and not public.tc_is_manager() then
      return jsonb_build_object('ok', false, 'reason', 'not_your_child');
    end if;
    select l.* into v_me from public.learners l where l.id = v_learner_id limit 1;
  end if;
  if v_me.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_learner_record');
  end if;

  select coalesce(array_agg(em.engagement_id), '{}') into v_eng_ids
    from public.engagement_members em
   where em.learner_id = v_me.id
     and coalesce(em.status, 'active') = 'active';

  select jsonb_build_object(
    'ok', true,
    'learner', jsonb_build_object('id', v_me.id, 'name', v_me.full_name, 'year', v_me.year_group),
    'engagements', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', e.id, 'name', e.name, 'subject', e.subject, 'kind', e.kind) order by e.name), '[]'::jsonb)
                      from public.engagements e
                     where e.id = any(v_eng_ids) and coalesce(e.status,'active') = 'active'),
    'homework', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', a.id, 'title', a.title, 'due', a.due_on, 'status', a.status,
                    'score', a.score, 'max', a.max_score,
                    'kind', coalesce(a.kind, 'homework'),
                    'code', (select x.code from public.cbt_exams x where x.id = a.cbt_exam_id),
                    'group', a.learner_id is null,
                    'engagement', (select e.name from public.engagements e where e.id = a.engagement_id)
                  ) order by a.due_on nulls last, a.created_at desc), '[]'::jsonb)
                  from public.assignments a
                 where (a.engagement_id = any(v_eng_ids) or a.learner_id = v_me.id)
                   and (a.learner_id is null or a.learner_id = v_me.id)),
    'reading', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', r.id, 'title', r.title, 'due', r.due_on, 'status', r.status,
                    'engagement', (select e.name from public.engagements e where e.id = r.engagement_id)
                  ) order by r.due_on nulls last, r.created_at desc), '[]'::jsonb)
                  from public.reading_assignments r
                 where r.engagement_id = any(v_eng_ids)),
    'exams', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', x.id, 'code', x.code, 'title', x.title, 'minutes', x.duration_min,
                    'kind', x.quiz_kind, 'subject', x.subject
                  ) order by x.created_at desc), '[]'::jsonb)
                  from public.cbt_exams x
                 where x.engagement_id = any(v_eng_ids)
                   and (lower(coalesce(x.status, 'draft')) in ('published','live','open')
                        or coalesce(x.is_open, false))),
    'next_class', (select jsonb_build_object(
                      'starts', s.starts_at,
                      'engagement', (select e.name from public.engagements e where e.id = s.engagement_id),
                      'url', s.meeting_url)
                     from public.sessions s
                    where s.engagement_id = any(v_eng_ids)
                      and s.starts_at >= now()
                      and coalesce(s.status, 'scheduled') = 'scheduled'
                    order by s.starts_at limit 1)
  ) into v_out;
  return v_out;
end $$;


-- Fleet-Console pings arrive through the sc_* compatibility contract
-- (sc_keep_alive), which predates the per-source ledger. Register them in
-- the ledger too so the 14-layer matrix can show when the fleet layer
-- actually did its job. Re-declared here ON PURPOSE after the V45 base:
-- later pack supersedes (see the file header note).
create or replace function public.sc_keep_alive(src text default 'fleet')
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_src text := left(coalesce(src, 'fleet'), 40);
  v_t   timestamptz;
begin
  -- One write, two ledgers: the fleet-visible row AND our richer heartbeat.
  update public.sc_keepalive
     set pinged_at = now(), src = v_src
   where id = 1
  returning pinged_at into v_t;
  if v_t is null then
    insert into public.sc_keepalive (id, pinged_at, src)
    values (1, now(), v_src)
    on conflict (id) do update set pinged_at = now(), src = excluded.src
    returning pinged_at into v_t;
  end if;
  begin
    update public.tc_heartbeat
       set last_ping = now(), last_source = v_src, ping_count = ping_count + 1
     where id = 1;
  exception when others then null;
  end;
  -- V45: also file the per-source row so Platform Health can see the fleet
  -- layer working (aliases are grouped in the UI).
  begin
    insert into public.tc_keepalive_sources (source, last_ping_at, ping_count, first_seen_at, updated_at)
    values (v_src, now(), 1, now(), now())
    on conflict (source) do update
      set last_ping_at = now(),
          ping_count    = public.tc_keepalive_sources.ping_count + 1,
          updated_at    = now();
  exception when others then null;
  end;
  return v_t;
end $$;
grant execute on function public.sc_keep_alive(text) to anon, authenticated;

notify pgrst, 'reload schema';

select 'V45 platform-health monitoring + advanced CBT installed ✅' as status;
