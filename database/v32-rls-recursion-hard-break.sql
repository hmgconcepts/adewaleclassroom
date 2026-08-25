
-- ===========================================================================
-- TUTORING CONNECT — V32
-- Hard break for RLS infinite recursion on parents / parent_learner
-- ---------------------------------------------------------------------------
-- Symptom (tutor/admin UI):
--   "infinite recursion detected in policy for relation \"parents\""
--   "infinite recursion detected in policy for relation \"parent_learner\""
-- Surfaces on: Parents, Parent–Child links, Payments, Invoices, Payment plans,
-- Payment history, Progress reports, Predicted grades, Value-added, etc.
--
-- Root cause: policies that cross-read parents ↔ parent_learner under RLS,
-- forming a cycle. V27 introduced SECURITY DEFINER helpers, but:
--   (a) installs that failed later left the old cyclic V24 policies in place;
--   (b) other policies still used inline `from public.parents` subqueries;
--   (c) SQL SECURITY DEFINER helpers can still re-enter RLS in edge cases
--       unless row_security is disabled inside them.
--
-- Fix:
--   1. Rebuild helpers as plpgsql with SET row_security = off.
--   2. DROP every policy on parents + parent_learner and recreate a minimal,
--      non-cyclic set that only calls those helpers (no inline cross-reads).
--   3. Rebuild money + insight family policies to use the helpers only.
-- Safe to re-run.
-- ===========================================================================

-- 1) Helpers — bypass RLS entirely while evaluating cross-table predicates
create or replace function public.tc_parent_matches_uid(p_parent uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_parent is null or auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1 from public.parents p
     where p.id = p_parent and p.user_id = auth.uid()
  );
end;
$$;

create or replace function public.tc_tutor_covers_parent(p_parent uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_parent is null or auth.uid() is null then
    return false;
  end if;
  if public.tc_is_manager() then
    return true;
  end if;
  return exists (
    select 1
      from public.parent_learner pl
     where pl.parent_id = p_parent
       and public.tc_teaches_learner(pl.learner_id)
  );
end;
$$;

create or replace function public.tc_family_can_see_learner(p_learner uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_learner is null or auth.uid() is null then
    return false;
  end if;
  if public.tc_is_manager() then
    return true;
  end if;
  if public.tc_teaches_learner(p_learner) then
    return true;
  end if;
  if exists (select 1 from public.learners l
              where l.id = p_learner and l.user_id = auth.uid()) then
    return true;
  end if;
  return exists (
    select 1
      from public.parent_learner pl
      join public.parents p on p.id = pl.parent_id
     where pl.learner_id = p_learner
       and p.user_id = auth.uid()
  );
end;
$$;

-- Keep is_parent_of consistent (used by many early policies)
create or replace function public.is_parent_of(p_learner uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_learner is null or auth.uid() is null then
    return false;
  end if;
  return exists (
    select 1
      from public.parent_learner pl
      join public.parents par on par.id = pl.parent_id
     where pl.learner_id = p_learner
       and par.user_id = auth.uid()
  );
end;
$$;

create or replace function public.is_family_of_learner(p_learner uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  return public.tc_family_can_see_learner(p_learner);
end;
$$;

revoke all on function public.tc_parent_matches_uid(uuid) from public, anon;
revoke all on function public.tc_tutor_covers_parent(uuid) from public, anon;
revoke all on function public.tc_family_can_see_learner(uuid) from public, anon;
revoke all on function public.is_parent_of(uuid) from public, anon;
revoke all on function public.is_family_of_learner(uuid) from public, anon;
grant execute on function public.tc_parent_matches_uid(uuid) to authenticated;
grant execute on function public.tc_tutor_covers_parent(uuid) to authenticated;
grant execute on function public.tc_family_can_see_learner(uuid) to authenticated;
grant execute on function public.is_parent_of(uuid) to authenticated;
grant execute on function public.is_family_of_learner(uuid) to authenticated;

-- 2) Nuke every policy on the two source tables, then recreate a clean set
do $$
declare r record;
begin
  if to_regclass('public.parents') is not null then
    alter table public.parents enable row level security;
    -- Do NOT force RLS on parents — helpers must remain able to read as owner
    begin
      execute 'alter table public.parents no force row level security';
    exception when others then null;
    end;
    for r in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = 'parents'
    loop
      execute format('drop policy if exists %I on public.parents', r.policyname);
    end loop;


    drop policy if exists parents_select on public.parents;
    drop policy if exists parents_write on public.parents;
    drop policy if exists parents_update on public.parents;
    drop policy if exists parents_delete on public.parents;
    drop policy if exists parents_tutor_scope on public.parents;
    drop policy if exists parents_admin on public.parents;
    drop policy if exists parents_tutor_read on public.parents;

    create policy parents_select on public.parents
      for select to authenticated
      using (
        public.tc_is_manager()
        or public.is_admin()
        or user_id = auth.uid()
        or public.tc_tutor_covers_parent(id)
      );
    create policy parents_write on public.parents
      for insert to authenticated
      with check (public.tc_is_manager() or public.is_admin() or user_id = auth.uid());
    create policy parents_update on public.parents
      for update to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or user_id = auth.uid()
      )
      with check (
        public.tc_is_manager() or public.is_admin() or user_id = auth.uid()
      );
    create policy parents_delete on public.parents
      for delete to authenticated
      using (public.tc_is_manager() or public.is_admin());
  end if;

  if to_regclass('public.parent_learner') is not null then
    alter table public.parent_learner enable row level security;
    begin
      execute 'alter table public.parent_learner no force row level security';
    exception when others then null;
    end;
    for r in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = 'parent_learner'
    loop
      execute format('drop policy if exists %I on public.parent_learner', r.policyname);
    end loop;


    drop policy if exists parent_learner_select on public.parent_learner;
    drop policy if exists parent_learner_write on public.parent_learner;
    drop policy if exists parent_learner_update on public.parent_learner;
    drop policy if exists parent_learner_delete on public.parent_learner;
    drop policy if exists parent_learner_tutor_scope on public.parent_learner;
    drop policy if exists parent_learner_admin on public.parent_learner;
    drop policy if exists parent_learner_tutor_read on public.parent_learner;

    create policy parent_learner_select on public.parent_learner
      for select to authenticated
      using (
        public.tc_is_manager()
        or public.is_admin()
        or public.tc_teaches_learner(learner_id)
        or public.tc_parent_matches_uid(parent_id)
        or public.tc_family_can_see_learner(learner_id)
      );
    create policy parent_learner_write on public.parent_learner
      for insert to authenticated
      with check (
        public.tc_is_manager() or public.is_admin()
        or public.tc_teaches_learner(learner_id)
      );
    create policy parent_learner_update on public.parent_learner
      for update to authenticated
      using (public.tc_is_manager() or public.is_admin())
      with check (public.tc_is_manager() or public.is_admin());
    create policy parent_learner_delete on public.parent_learner
      for delete to authenticated
      using (public.tc_is_manager() or public.is_admin());
  end if;
end $$;

-- 3) Money tables — family read via helper only (no inline parents subquery)
do $$
begin
  if to_regclass('public.invoices') is not null then
    drop policy if exists invoices_family_read on public.invoices;
    create policy invoices_family_read on public.invoices
      for select to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or public.is_tutor()
        or public.tc_parent_matches_uid(parent_id)
        or public.is_family_of_engagement(engagement_id)
      );
  end if;

  if to_regclass('public.payments') is not null then
    drop policy if exists payments_family_read on public.payments;
    create policy payments_family_read on public.payments
      for select to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or public.is_tutor()
        or exists (
          select 1 from public.invoices i
           where i.id = payments.invoice_id
             and public.tc_parent_matches_uid(i.parent_id)
        )
      );
  end if;

  if to_regclass('public.account_credits') is not null then
    drop policy if exists account_credits_family on public.account_credits;
    drop policy if exists account_credits_staff on public.account_credits;
    drop policy if exists account_credits_select on public.account_credits;
    create policy account_credits_select on public.account_credits
      for select to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or public.is_tutor()
        or public.tc_parent_matches_uid(parent_id)
      );
  end if;

  if to_regclass('public.payment_plans') is not null then
    drop policy if exists payment_plans_family on public.payment_plans;
    drop policy if exists payment_plans_staff on public.payment_plans;
    drop policy if exists payment_plans_select on public.payment_plans;
    create policy payment_plans_select on public.payment_plans
      for select to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or public.is_tutor()
        or public.tc_parent_matches_uid(parent_id)
      );
    drop policy if exists payment_plans_write on public.payment_plans;
    create policy payment_plans_write on public.payment_plans
      for all to authenticated
      using (public.tc_is_manager() or public.is_admin() or public.is_tutor())
      with check (public.tc_is_manager() or public.is_admin() or public.is_tutor());
  end if;

  if to_regclass('public.payment_plan_items') is not null then
    drop policy if exists payment_plan_items_family on public.payment_plan_items;
    drop policy if exists payment_plan_items_select on public.payment_plan_items;
    create policy payment_plan_items_select on public.payment_plan_items
      for select to authenticated
      using (
        public.tc_is_manager() or public.is_admin() or public.is_tutor()
        or exists (
          select 1 from public.payment_plans pp
           where pp.id = plan_id
             and public.tc_parent_matches_uid(pp.parent_id)
        )
      );
  end if;
end $$;

-- 4) Insight desks that key on learner_id — family via helper (no parent_learner join in policy text)
do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_progress_reports', 'tc_timezone_desk'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_read', t);
      execute format(
        'create policy %I on public.%I for select to authenticated using (
           public.tc_is_manager() or public.is_admin() or public.is_tutor()
           or public.tc_family_can_see_learner(learner_id)
         )',
        t || '_read', t
      );
    end if;
  end loop;
end $$;

select 'V32 RLS recursion hard-break installed' as status;


notify pgrst, 'reload schema';
select 'V32 hotfix applied — parents/parent_learner recursion cleared' as status;
