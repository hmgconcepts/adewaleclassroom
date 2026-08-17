-- ============================================================================
-- Tutoring Connect V7 — FAMILY ACCESS + CBT SUBMISSION FIX  (idempotent)
-- ============================================================================
-- WHY THIS PACK EXISTS
--
-- The V1–V6 packs enable RLS on all 101 tables (good) but the per-table
-- policies were only ever completed for THREE family-facing tables:
--   learners (learners_family), engagements (engagements_read), study_logs.
--
-- Every other family table received only the generated loop policies:
--     <t>_admin       for all    using (is_admin())
--     <t>_tutor_read  for select using (is_tutor())
--
-- Consequence: a signed-in PARENT or LEARNER is denied by RLS on scoresheet,
-- assessments, sessions, invoices, messages, notifications, hour_ledger,
-- bookings, reading, goals, mastery — i.e. the entire parent-facing product
-- ("Independent progress. Visible to parents.") returns empty result sets.
--
-- Separately, public CBT submission is rejected: cbt_results has a table-level
-- INSERT grant to anon but NO insert policy, so every learner who finishes a
-- quiz gets 42501 "new row violates row-level security policy" and the score
-- is lost (verified live against a deployed studio).
--
-- This pack adds the missing FAMILY-SCOPED policies. It never widens staff
-- access and never grants anything to anon beyond the CBT submit path that
-- the UI already assumes. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper: is the current user the learner, or a parent of the learner,
--    on a given ENGAGEMENT? (engagement_members is the join table.)
-- ---------------------------------------------------------------------------
create or replace function public.is_family_of_engagement(p_engagement uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_engagement is null then return false; end if;
  return exists (
    select 1 from public.engagement_members em
    where em.engagement_id = p_engagement
      and (public.is_self_learner(em.learner_id) or public.is_parent_of(em.learner_id))
  );
end $$;
grant execute on function public.is_family_of_engagement(uuid) to authenticated;

-- Convenience: learner-or-parent on a learner row.
create or replace function public.is_family_of_learner(p_learner uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if p_learner is null then return false; end if;
  return public.is_self_learner(p_learner) or public.is_parent_of(p_learner);
end $$;
grant execute on function public.is_family_of_learner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. PROFILES — a user must be able to read and edit their OWN profile.
--    Previously admin-only: profile.html, the name chip and password/profile
--    editing were dead for parents, learners and even tutors editing self.
--    (Login itself survived only because tc_current_role() is SECURITY DEFINER.)
-- ---------------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));
-- NOTE: the with-check pins `role` to its existing value so a user can edit
-- their name/phone/photo but can NEVER escalate themselves to admin.

-- ---------------------------------------------------------------------------
-- 2. LEARNER-SCOPED TABLES (have a learner_id column)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'scoresheet','assessments','session_attendance','session_notes',
    'mastery_topics','reading_progress','cbt_results'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_family_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_family_of_learner(learner_id))',
      t||'_family_read', t);
  end loop;
end $$;

-- goals / assignments carry BOTH learner_id and engagement_id; a group
-- assignment has learner_id null and must still reach the whole group.
do $$
declare t text;
begin
  foreach t in array array['goals','assignments'] loop
    execute format('drop policy if exists %I on public.%I', t||'_family_read', t);
    execute format(
      'create policy %I on public.%I for select using ('
      || ' public.is_family_of_learner(learner_id)'
      || ' or (learner_id is null and public.is_family_of_engagement(engagement_id)))',
      t||'_family_read', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. ENGAGEMENT-SCOPED TABLES (have an engagement_id column)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'sessions','hour_ledger','reading_assignments','curriculum_items',
    'sow_terms','stream_posts','classwork_items'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_family_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_family_of_engagement(engagement_id))',
      t||'_family_read', t);
  end loop;
end $$;

-- sow_topics has NO engagement_id of its own — it reaches the engagement
-- through term_id -> sow_terms.engagement_id. (Getting this wrong would make
-- the whole patch fail at runtime with "column engagement_id does not exist".)
drop policy if exists sow_topics_family_read on public.sow_topics;
create policy sow_topics_family_read on public.sow_topics
  for select using (
    exists (
      select 1 from public.sow_terms st
      where st.id = sow_topics.term_id
        and public.is_family_of_engagement(st.engagement_id)
    )
  );

-- engagement_members: a family may see the membership rows of their own-- engagements (needed to resolve group names on the dashboard).
drop policy if exists engagement_members_family_read on public.engagement_members;
create policy engagement_members_family_read on public.engagement_members
  for select using (
    public.is_family_of_learner(learner_id) or public.is_family_of_engagement(engagement_id)
  );

-- ---------------------------------------------------------------------------
-- 4. BOOKINGS — "Every booked class shows on your dashboard with the amount
--    you agreed." booking_classes reaches its engagement through booking_blocks.
-- ---------------------------------------------------------------------------
drop policy if exists booking_blocks_family_read on public.booking_blocks;
create policy booking_blocks_family_read on public.booking_blocks
  for select using (public.is_family_of_engagement(engagement_id));

drop policy if exists booking_classes_family_read on public.booking_classes;
create policy booking_classes_family_read on public.booking_classes
  for select using (
    exists (
      select 1 from public.booking_blocks bb
      where bb.id = booking_classes.block_id
        and public.is_family_of_engagement(bb.engagement_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 5. BILLING — a parent must see their own invoices and the payments on them.
--    invoices.parent_id -> parents.id -> parents.user_id = auth.uid()
-- ---------------------------------------------------------------------------
drop policy if exists invoices_family_read on public.invoices;
create policy invoices_family_read on public.invoices
  for select using (
    exists (select 1 from public.parents p
             where p.id = invoices.parent_id and p.user_id = auth.uid())
    or public.is_family_of_engagement(engagement_id)
  );

drop policy if exists payments_family_read on public.payments;
create policy payments_family_read on public.payments
  for select using (
    exists (
      select 1 from public.invoices i
      join public.parents p on p.id = i.parent_id
      where i.id = payments.invoice_id and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. NOTIFICATIONS + MESSAGES — the bell and the inbox were staff-only, so
--    "Bell for messages and class reminders" never fired for a parent.
-- ---------------------------------------------------------------------------
drop policy if exists notifications_own_read on public.notifications;
create policy notifications_own_read on public.notifications
  for select using (user_id = auth.uid() or user_id is null);  -- null = broadcast

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- messages(sender uuid default auth.uid(), to_role text, ...)
drop policy if exists messages_own_read on public.messages;
create policy messages_own_read on public.messages
  for select using (
    sender = auth.uid()
    or to_role is null
    or lower(to_role) = 'all'
    or lower(to_role) = lower(coalesce((select p.role from public.profiles p where p.id = auth.uid()), ''))
  );

drop policy if exists messages_own_send on public.messages;
create policy messages_own_send on public.messages
  for insert with check (sender = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. PUSH SUBSCRIPTIONS — every signed-in user must be able to register their
--    own device, otherwise web-push silently never enrols a parent.
-- ---------------------------------------------------------------------------
drop policy if exists push_self on public.push_subscriptions;
create policy push_self on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8. LOGIN AUDIT — security-guard.js claims "every sign-in and sign-out is
--    recorded", but only staff could insert. Let any authenticated user append
--    their OWN row; reading stays admin/tutor-only (tamper-evident).
-- ---------------------------------------------------------------------------
drop policy if exists login_audit_self_insert on public.login_audit;
create policy login_audit_self_insert on public.login_audit
  for insert with check (user_id = auth.uid() or user_id is null);

-- ---------------------------------------------------------------------------
-- 9. CBT SUBMISSION (the critical one)
--    cbt-exam.html submits as an ANONYMOUS visitor (quiz code + student ID is
--    the gate, by design). anon holds the INSERT grant but had no policy, so
--    every submission failed with 42501 and the score was lost.
-- ---------------------------------------------------------------------------
drop policy if exists cbt_results_public_insert on public.cbt_results;
create policy cbt_results_public_insert on public.cbt_results
  for insert with check (true);
-- Rationale for `true`: this mirrors the already-shipped and identical
-- exam_reg_ins / inquiries_insert pattern. The row is write-only for anon
-- (no anon SELECT policy exists), so a candidate can submit but can never
-- read anyone's results back. Grading integrity is preserved server-side by
-- the trg_push_cbt trigger, which re-reads the exam row.

-- Let a family read their own results back (review screen + scoresheet).
-- Already covered by cbt_results_family_read in section 2 for signed-in
-- families; anonymous candidates keep their review in-page only.

-- ---------------------------------------------------------------------------
-- 10. TIGHTEN over-permissive V3 policies.
--     stream_posts / classwork_items shipped as:
--         for all using (true) with check (true)
--     Any authenticated user — including a parent or a learner — could READ,
--     EDIT and DELETE the classwork and stream of EVERY engagement. That is
--     the exact opposite of "a sibling's scores never leak".
--     Replaced with: family reads its own engagement (section 3), staff write.
-- ---------------------------------------------------------------------------
drop policy if exists stream_rw on public.stream_posts;
drop policy if exists classwork_rw on public.classwork_items;

do $$
declare t text;
begin
  foreach t in array array['stream_posts','classwork_items'] loop
    execute format('drop policy if exists %I on public.%I', t||'_staff_rw', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_admin() or public.is_tutor())'
      || ' with check (public.is_admin() or public.is_tutor())', t||'_staff_rw', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Grants. RLS is the gate; these only make the gate reachable.
-- ---------------------------------------------------------------------------
grant select on public.booking_blocks, public.booking_classes to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant insert on public.login_audit to authenticated;
grant select, update on public.profiles to authenticated;

select 'Tutoring Connect V7 family-access + CBT submission fix installed ✅' as status;
