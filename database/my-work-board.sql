-- =====================================================================
-- V_MY_WORK: the learner Work Board.
-- When staff assign homework / reading / a CBT paper to an engagement
-- (group or cohort) or to an individual learner, ONE call returns the
-- learner's full work picture. RLS-equivalent checks run INSIDE the
-- function (security definer), so a parent can only query their own
-- children and a learner only themselves.
-- Safe to re-run.
-- =====================================================================
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

grant execute on function public.tc_my_work(uuid) to authenticated;
revoke all on function public.tc_my_work(uuid) from public, anon;

select 'My Work board installed (tc_my_work)' as status;
