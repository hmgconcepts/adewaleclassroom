-- ============================================================================
-- Tutoring Connect V15 — FAMILY PORTAL · RICH POLLS · COMBINED INVOICING
-- ============================================================================
-- Three additions, all idempotent and safe to re-run.
--
--  A. FAMILY PORTAL SUPPORT (item 16)
--     parent_learner already existed but had no page, so nothing ever wrote to
--     it and every parent portal was empty. Beyond the new UI, a parent needs
--     two safe read paths that RLS can grant without exposing anyone else:
--       * tc_my_children()      — the learners this signed-in parent may see
--       * tc_child_summary(id)  — one child's headline numbers in a single call
--     Both are SECURITY DEFINER and filter by the caller, so a parent cannot
--     pass someone else's learner id and get data back.
--
--  B. RICH POLLS (item 27)
--     polls had only (title, options, anonymous, status). Real voting needs a
--     closing time, multiple-choice limits, an audience, a quorum and a rule
--     for when results become visible. Added as nullable columns so existing
--     polls keep working untouched.
--
--  C. COMBINED FAMILY INVOICING (the gap found in competitor research)
--     TutorBird/Teachworks bill per student. A Nigerian parent with three
--     children wants ONE invoice. tc_family_invoice() gathers every unpaid
--     invoice for a parent into a single consolidated statement.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A · FAMILY PORTAL
-- ---------------------------------------------------------------------------
create index if not exists parent_learner_parent_idx  on public.parent_learner (parent_id);
create index if not exists parent_learner_learner_idx on public.parent_learner (learner_id);
create index if not exists parents_user_idx           on public.parents (user_id);

-- Which children may the signed-in user see? Staff see all; a parent sees only
-- their own; a learner sees only themselves.
create or replace function public.tc_my_children()
returns table (
  id uuid, full_name text, student_no text, year_group text, relationship text
)
language sql stable security definer set search_path = public
as $$
  select l.id, l.full_name, l.student_no, l.year_group,
         coalesce(pl.relationship, case when l.user_id = auth.uid() then 'self' else 'staff' end)
    from public.learners l
    left join public.parent_learner pl on pl.learner_id = l.id
    left join public.parents p on p.id = pl.parent_id and p.user_id = auth.uid()
   where public.is_tutor()
      or l.user_id = auth.uid()
      or p.id is not null
   group by l.id, l.full_name, l.student_no, l.year_group, pl.relationship, l.user_id
   order by l.full_name;
$$;
grant execute on function public.tc_my_children() to authenticated;

-- One child's headline numbers, in a single round trip.
create or replace function public.tc_child_summary(p_learner uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_avg numeric; v_count int; v_att numeric; v_next timestamptz; v_hours numeric;
begin
  -- Authorisation is enforced here, not by the caller.
  if not (public.is_tutor() or public.is_family_of_learner(p_learner)) then
    return jsonb_build_object('ok', false, 'error', 'not_permitted');
  end if;

  select round(avg(pct), 1), count(*) into v_avg, v_count
    from public.scoresheet where learner_id = p_learner;

  select round(100.0 * count(*) filter (where lower(status) in ('present','late'))
               / nullif(count(*), 0), 0)
    into v_att
    from public.session_attendance where learner_id = p_learner;

  select min(s.starts_at) into v_next
    from public.sessions s
    join public.engagement_members em on em.engagement_id = s.engagement_id
   where em.learner_id = p_learner and s.starts_at > now();

  select coalesce(sum(e.hours_prepaid - e.hours_used), 0) into v_hours
    from public.engagements e
    join public.engagement_members em on em.engagement_id = e.id
   where em.learner_id = p_learner;

  return jsonb_build_object(
    'ok', true, 'learner_id', p_learner,
    'average_pct', v_avg, 'assessments', coalesce(v_count, 0),
    'attendance_pct', v_att, 'next_class', v_next,
    'hours_left', v_hours, 'checked_at', now());
end $$;
grant execute on function public.tc_child_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- B · RICH POLLS
-- ---------------------------------------------------------------------------
alter table if exists public.polls add column if not exists description     text;
alter table if exists public.polls add column if not exists audience        text default 'all';
alter table if exists public.polls add column if not exists engagement_id   uuid references public.engagements(id) on delete set null;
alter table if exists public.polls add column if not exists opens_at        timestamptz default now();
alter table if exists public.polls add column if not exists closes_at       timestamptz;
alter table if exists public.polls add column if not exists multi_choice    boolean not null default false;
alter table if exists public.polls add column if not exists max_choices     int default 1;
alter table if exists public.polls add column if not exists quorum          int default 0;
alter table if exists public.polls add column if not exists results_visible text default 'always';  -- always | after_vote | after_close
alter table if exists public.polls add column if not exists created_by      uuid;

alter table if exists public.poll_votes add column if not exists created_at timestamptz default now();
alter table if exists public.poll_votes add column if not exists comment    text;

-- One vote per person per poll (a multi-choice poll stores its picks joined
-- with "|" in a single row, so this constraint holds for both modes).
create unique index if not exists poll_votes_one_per_voter
  on public.poll_votes (poll_id, voter) where voter is not null;
create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);

-- Tally a poll without exposing who voted for what on an anonymous poll.
create or replace function public.tc_poll_results(p_poll uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_poll record; v_total int; v_rows jsonb; v_closed boolean; v_voted boolean;
begin
  select * into v_poll from public.polls where id = p_poll;
  if v_poll is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  v_closed := (v_poll.closes_at is not null and v_poll.closes_at < now())
              or lower(coalesce(v_poll.status, 'open')) <> 'open';
  select exists (select 1 from public.poll_votes where poll_id = p_poll and voter = auth.uid())
    into v_voted;

  -- Respect the poll's disclosure rule.
  if coalesce(v_poll.results_visible, 'always') = 'after_close' and not v_closed
     and not public.is_tutor() then
    return jsonb_build_object('ok', true, 'hidden', true,
                              'reason', 'Results are published when the poll closes.',
                              'closes_at', v_poll.closes_at);
  end if;
  if coalesce(v_poll.results_visible, 'always') = 'after_vote' and not v_voted
     and not public.is_tutor() then
    return jsonb_build_object('ok', true, 'hidden', true,
                              'reason', 'Cast your vote to see the results.');
  end if;

  select count(*) into v_total from public.poll_votes where poll_id = p_poll;

  -- Split multi-choice picks so each option is counted individually.
  select jsonb_agg(jsonb_build_object('choice', choice, 'votes', n)
                   order by n desc)
    into v_rows
    from (
      select trim(unnest(string_to_array(coalesce(choice, ''), '|'))) as choice, count(*) as n
        from public.poll_votes
       where poll_id = p_poll
       group by 1
       having trim(coalesce(choice, '')) <> ''
    ) t;

  return jsonb_build_object(
    'ok', true, 'poll_id', p_poll, 'title', v_poll.title,
    'closed', v_closed, 'closes_at', v_poll.closes_at,
    'anonymous', coalesce(v_poll.anonymous, true),
    'multi_choice', coalesce(v_poll.multi_choice, false),
    'total_voters', v_total,
    'quorum', coalesce(v_poll.quorum, 0),
    'quorum_met', coalesce(v_poll.quorum, 0) = 0 or v_total >= v_poll.quorum,
    'you_voted', v_voted,
    'results', coalesce(v_rows, '[]'::jsonb));
end $$;
grant execute on function public.tc_poll_results(uuid) to authenticated;

-- Everyone signed in may read an open poll and cast exactly one vote.
grant select on public.polls to authenticated;
grant select, insert, update, delete on public.poll_votes to authenticated;

drop policy if exists polls_read_all on public.polls;
create policy polls_read_all on public.polls for select using (true);

drop policy if exists poll_votes_own on public.poll_votes;
create policy poll_votes_own on public.poll_votes
  for all using (voter = auth.uid() or public.is_tutor())
  with check (voter = auth.uid() or public.is_tutor());

-- ---------------------------------------------------------------------------
-- C · COMBINED FAMILY INVOICING
--     One statement per PARENT covering every child, instead of one invoice
--     per child. This is the single feature the commercial tutoring platforms
--     charge for that this product lacked.
-- ---------------------------------------------------------------------------
create or replace function public.tc_family_statement(p_parent uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_parent uuid; v_rows jsonb; v_total numeric; v_paid numeric; v_name text;
begin
  -- A parent may only ever pull their own statement; staff may pull any.
  if p_parent is null then
    select id into v_parent from public.parents where user_id = auth.uid() limit 1;
  else
    if public.is_tutor() then v_parent := p_parent;
    else
      select id into v_parent from public.parents
       where id = p_parent and user_id = auth.uid() limit 1;
    end if;
  end if;
  if v_parent is null then
    return jsonb_build_object('ok', false, 'error', 'no_parent_record');
  end if;

  select full_name into v_name from public.parents where id = v_parent;

  select jsonb_agg(x order by x->>'issued_on'), sum((x->>'total')::numeric), sum((x->>'paid')::numeric)
    into v_rows, v_total, v_paid
    from (
      select jsonb_build_object(
               'invoice_id', i.id,
               'learner', coalesce(l.full_name, '—'),
               'engagement', coalesce(e.name, '—'),
               'issued_on', i.created_at::date,
               'due_on', i.due_on,
               'status', i.status,
               'total', coalesce(i.amount, 0),
               'paid', coalesce((select sum(p.amount) from public.payments p where p.invoice_id = i.id), 0)
             ) as x
        from public.invoices i
        left join public.engagements e on e.id = i.engagement_id
        left join public.engagement_members em on em.engagement_id = e.id
        left join public.learners l on l.id = em.learner_id
       where i.parent_id = v_parent
    ) s;

  return jsonb_build_object(
    'ok', true,
    'parent_id', v_parent,
    'parent_name', v_name,
    'currency', (select currency from public.practice_settings where id = 1),
    'invoices', coalesce(v_rows, '[]'::jsonb),
    'total_billed', coalesce(v_total, 0),
    'total_paid', coalesce(v_paid, 0),
    'balance', coalesce(v_total, 0) - coalesce(v_paid, 0),
    'generated_at', now());
end $$;
grant execute on function public.tc_family_statement(uuid) to authenticated;

-- Keep the registry honest about what is installed.
insert into public.tc_schema_registry (id, version, packs, note)
values (1, 'V15', array['v1-core','v2-tutoring-ops','v3-classroom-exams','v4-enterprise-parity',
                        'v5-ops-parity','v6-cbt-modes','v7-family-access','v9-keepalive-drive',
                        'v12-quota-guard','v15-family-polls-billing'],
        'Installed by database/complete-schema.sql')
on conflict (id) do update
   set version = excluded.version, applied_at = now(),
       packs = excluded.packs, note = excluded.note;

select 'Tutoring Connect V15 family portal + rich polls + combined invoicing installed ✅' as status;
