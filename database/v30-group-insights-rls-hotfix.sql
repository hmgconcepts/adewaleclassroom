-- V30 hotfix: complete-schema failed with
--   ERROR 42703: column "learner_id" does not exist
-- on policy tc_group_insights_read because tc_group_insights has no learner_id.
-- Safe to re-run. Apply in Supabase SQL editor after a failed complete-schema.

create or replace function public.tc_family_can_see_learner(p_learner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_learner is not null and (
      public.tc_is_manager()
      or public.tc_teaches_learner(p_learner)
      or exists (select 1 from public.learners l
                  where l.id = p_learner and l.user_id = auth.uid())
      or exists (select 1 from public.parent_learner pl
                  join public.parents p on p.id = pl.parent_id
                 where pl.learner_id = p_learner and p.user_id = auth.uid())
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_progress_reports', 'tc_timezone_desk'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format($f$
        drop policy if exists %I on public.%I;
        create policy %I on public.%I for select to authenticated
        using (public.tc_family_can_see_learner(learner_id))
      $f$, t || '_read', t, t || '_read', t);
    end if;
  end loop;

  if to_regclass('public.tc_insight_notes') is not null then
    drop policy if exists tc_insight_notes_read on public.tc_insight_notes;
    create policy tc_insight_notes_read on public.tc_insight_notes
      for select to authenticated
      using (
        public.tc_is_manager()
        or (learner_id is not null and public.tc_family_can_see_learner(learner_id))
        or (engagement_id is not null and public.tc_teaches_engagement(engagement_id))
        or created_by = auth.uid()
      );
  end if;

  if to_regclass('public.tc_group_insights') is not null then
    drop policy if exists tc_group_insights_read on public.tc_group_insights;
    create policy tc_group_insights_read on public.tc_group_insights
      for select to authenticated
      using (
        public.tc_is_manager()
        or public.tc_teaches_engagement(engagement_id)
        or (coalesce(published, false) and exists (
              select 1 from public.engagement_members em
                join public.learners l on l.id = em.learner_id
               where em.engagement_id = tc_group_insights.engagement_id
                 and l.user_id = auth.uid()))
        or (coalesce(published, false) and exists (
              select 1 from public.engagement_members em
                join public.parent_learner pl on pl.learner_id = em.learner_id
                join public.parents p on p.id = pl.parent_id
               where em.engagement_id = tc_group_insights.engagement_id
                 and p.user_id = auth.uid()))
      );
  end if;
end $$;

select 'V30 group_insights learner_id hotfix applied' as status;
