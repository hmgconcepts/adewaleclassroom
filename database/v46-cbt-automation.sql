-- ═══════════════════════════════════════════════════════════════════════
-- V46 — SEAMLESS CBT → ASSIGNMENT AUTOMATION (round 10, item 4)
--
-- Field benchmark: on the GOSA / School Connect portal, a CBT created for a
-- class appears on the Assignments page instantly, carries a working
-- sit-link, follows every later change to the paper, and disappears when
-- the paper is withdrawn. Tutoring Connect's V45 trigger did the first
-- part only: it created the mirror row on publish and updated title/due/
-- max on edit — but DELETING the exam orphaned the assignment, ARCHIVING
-- the exam kept pushing it at students as due homework, and the row never
-- carried the one-click sit link.
--
-- This migration replaces tc_sync_cbt_assignment() with a full lifecycle
-- sync:
--   INSERT/UPDATE of a published, graded, class-aimed, non-archived paper
--     → upsert the mirror (title, due date, max score, sit link)
--   paper unpublished / unclassed / switched to practice / archived
--     → the homework mirror is REMOVED (archived papers are not homework)
--   DELETE of the paper
--     → the homework mirror is removed with it (no orphans, ever)
--
-- Idempotent: create-or-replace throughout, safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════

-- UPGRADE-ORDER GUARD (round-9 field-fix class): the trigger below lists
-- is_archived in its UPDATE OF clause, which requires the column at CREATE
-- TRIGGER time. Complete-schema.sql adds it in a later section, so a
-- legacy database running THIS migration standalone needs it guaranteed
-- here. The other trigger columns are already guarded by V45 (and base
-- columns are original); these are idempotent no-ops where they exist.
alter table if exists public.cbt_exams add column if not exists is_archived   boolean default false;
alter table if exists public.cbt_exams add column if not exists is_open      boolean default true;
alter table if exists public.cbt_exams add column if not exists engagement_id uuid;
alter table if exists public.cbt_exams add column if not exists quiz_kind    text default 'graded';
alter table if exists public.cbt_exams add column if not exists close_at     timestamptz;

create or replace function public.tc_sync_cbt_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.cbt_exams%rowtype;
  v_pub boolean;
  v_max numeric;
begin
  /* DELETE: the paper is gone — its homework mirror must go with it.
     (The assignments.cbt_exam_id FK is on delete cascade, but the explicit
     delete keeps this correct even if the FK is ever relaxed.) */
  if tg_op = 'DELETE' then
    delete from public.assignments where cbt_exam_id = old.id and kind = 'cbt';
    return old;
  end if;

  v_row := coalesce(new, old);
  v_pub := (lower(coalesce(v_row.status, 'draft')) in ('published','live','open'))
           or coalesce(v_row.is_open, false);

  /* Archived papers are withdrawn work, not homework — GOSA parity: the
     mirror lives exactly as long as the paper is live for the class. */
  if v_pub and v_row.engagement_id is not null
     and coalesce(v_row.quiz_kind, 'graded') = 'graded'
     and not coalesce(v_row.is_archived, false) then

    v_max := (select coalesce(sum(coalesce((q->>'mark')::numeric, 1)), 0)
                from jsonb_array_elements(
                  case when jsonb_typeof(v_row.questions) = 'array' then v_row.questions else '[]'::jsonb end) q);

    insert into public.assignments
      (engagement_id, learner_id, title, due_on, max_score, status, kind, cbt_exam_id, submission_url)
    values
      (v_row.engagement_id, null,
       '🧪 CBT: ' || v_row.title,
       v_row.close_at::date,
       nullif(v_max, 0),
       'set', 'cbt', v_row.id,
       /* V46: the sit link — students click straight into the runner from
          the Homework page, exactly like the GOSA assignment mirror. */
       case when coalesce(v_row.code, '') <> ''
              then 'cbt-exam.html?code=' || v_row.code
            else null end)
    on conflict (cbt_exam_id) where cbt_exam_id is not null do update
      set engagement_id  = excluded.engagement_id,
          title          = excluded.title,
          due_on         = excluded.due_on,
          max_score      = excluded.max_score,
          submission_url = excluded.submission_url;

  else
    -- Unpublished, unclassed, practice or archived papers carry no homework row.
    delete from public.assignments where cbt_exam_id = v_row.id and kind = 'cbt';
  end if;
  return v_row;
end $$;

drop trigger if exists trg_cbt_assignment_sync on public.cbt_exams;
create trigger trg_cbt_assignment_sync
  after insert or update of status, is_open, is_archived, engagement_id, quiz_kind, title, close_at, code, questions or delete
  on public.cbt_exams
  for each row execute function public.tc_sync_cbt_assignment();

select 'V46 seamless CBT→assignment automation installed ✅' as status;

-- ─────────────────────────────────────────────────────────────────────────
-- V46b: tc_my_work upgraded — the learner homework page arranges CBTs BY
-- NATURE (live now / upcoming / closed / practice), which needs windows,
-- the multi-subject flag and negative-marking info in the feed. Archived
-- papers are withdrawn from the feed at the same time (they are no longer
-- homework, mirroring the assignment-sync rule above).
-- ─────────────────────────────────────────────────────────────────────────
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
                    'kind', x.quiz_kind, 'subject', x.subject,
                    /* V46: everything the homework page needs to arrange CBTs
                       BY NATURE — windows, multi-subject flag, negative
                       marking — and archived papers no longer appear. */
                    'multi', coalesce(x.multi_subject, false) or jsonb_array_length(coalesce(x.subjects, '[]'::jsonb)) > 1,
                    'negative_mark', coalesce(x.negative_mark, 0),
                    'opens', x.start_at,
                    'closes', x.close_at
                  ) order by x.created_at desc), '[]'::jsonb)
                  from public.cbt_exams x
                 where x.engagement_id = any(v_eng_ids)
                   and not coalesce(x.is_archived, false)
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

grant execute on function public.tc_my_work(uuid) to authenticated;
revoke execute on function public.tc_my_work(uuid) from public, anon;

select 'V46b tc_my_work upgraded for the homework page ✅' as status;
