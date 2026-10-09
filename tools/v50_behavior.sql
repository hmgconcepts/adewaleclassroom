-- Behavioral assertions for V50 (round 14). Every expectation runs AS the
-- authenticated role with jwt claims (RLS proven, not assumed). Any broken
-- expectation RAISES, which the harness counts as an error.

-- fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('21111111-1111-4111-8111-1111111111b1', 'v50owner@test.local'),
  ('21111111-1111-4111-8111-1111111111b2', 'v50tutlegacy@test.local'),
  ('21111111-1111-4111-8111-1111111111b3', 'v50learner@test.local'),
  ('21111111-1111-4111-8111-1111111111b4', 'v50tutpending@test.local')
on conflict (id) do nothing;

-- THE ROUND-14 FIELD REPORT: the OWNER whose profile still has the signup
-- default status 'pending' — could write shelf items but could not even
-- read the engagements table (silent zero rows → "linked · name unavailable").
update public.profiles set role='owner',  status='pending' where id='21111111-1111-4111-8111-1111111111b1';
update public.profiles set role='tutor',  status=null       where id='21111111-1111-4111-8111-1111111111b2';
update public.profiles set role='learner',status='approved' where id='21111111-1111-4111-8111-1111111111b3';
update public.profiles set role='tutor',  status='pending'  where id='21111111-1111-4111-8111-1111111111b4';

insert into public.tutors (id, user_id, full_name) values
  ('22222222-2222-4222-8222-2222222222b2', '21111111-1111-4111-8111-1111111111b2', 'V50 Legacy Tutor')
on conflict (id) do nothing;
insert into public.learners (id, user_id, full_name) values
  ('33333333-3333-4333-8333-3333333333b3', '21111111-1111-4111-8111-1111111111b3', 'V50 Learner')
on conflict (id) do nothing;
insert into public.engagements (id, name, tutor_id) values
  ('55555555-5555-4555-8555-5555555555b5', 'V50 Science club', '22222222-2222-4222-8222-2222222222b2')
on conflict (id) do nothing;
insert into public.engagement_members (engagement_id, learner_id) values
  ('55555555-5555-4555-8555-5555555555b5', '33333333-3333-4333-8333-3333333333b3')
on conflict do nothing;

-- ── 1. the owner with the DEFAULT 'pending' status ────────────────────
begin;
  select set_config('request.jwt.claim.sub', '21111111-1111-4111-8111-1111111111b1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if not public.is_tutor() then
      raise exception 'V50 assert 1 failed: a pending-status OWNER must never be status-gated'; end if;
    if not public.is_admin() then
      raise exception 'V50 assert 2 failed: owner must be admin'; end if;
    if not public.tc_is_manager() then
      raise exception 'V50 assert 3 failed: a pending-status owner must still be a manager'; end if;
    if not exists (select 1 from public.engagements where id = '55555555-5555-4555-8555-5555555555b5') then
      raise exception 'V50 assert 4 failed: THE ROUND-14 BUG — the owner still cannot read engagements (empty link map → "linked · name unavailable")'; end if;
    if (public.tc_ref_labels('engagements') ->> '55555555-5555-4555-8555-5555555555b5') is null then
      raise exception 'V50 assert 5 failed: tc_ref_labels must return the engagement name for staff'; end if;
    if (select count(*) from jsonb_object_keys(public.tc_ref_labels('nope'))) <> 0 then
      raise exception 'V50 assert 6 failed: tc_ref_labels must return {} for an unknown table'; end if;
  end $$;
commit;

-- ── 2. operational staff: the approval workflow still means something ─
begin;
  select set_config('request.jwt.claim.sub', '21111111-1111-4111-8111-1111111111b2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if not public.is_tutor() then
      raise exception 'V50 assert 7 failed: a NULL-status tutor (legacy) must count as staff'; end if;
    if not exists (select 1 from public.engagements where id = '55555555-5555-4555-8555-5555555555b5') then
      raise exception 'V50 assert 8 failed: the legacy tutor must be able to read engagements'; end if;
  end $$;
commit;

begin;
  select set_config('request.jwt.claim.sub', '21111111-1111-4111-8111-1111111111b4', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if public.is_tutor() then
      raise exception 'V50 assert 9 failed: a PENDING tutor must stay blocked until approved (the workflow is real)'; end if;
    if exists (select 1 from public.engagement_members) then
      raise exception 'V50 assert 10 failed: a pending tutor must not read class membership'; end if;
  end $$;
commit;

-- ── 3. tc_ref_labels is staff-only ────────────────────────────────────
begin;
  select set_config('request.jwt.claim.sub', '21111111-1111-4111-8111-1111111111b3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if (select count(*) from jsonb_object_keys(public.tc_ref_labels('engagements'))) <> 0 then
      raise exception 'V50 assert 11 failed: a learner must get NO link labels from the RPC'; end if;
  end $$;
commit;

-- ── 4. Mini LMS publish-by-default (item 5's root cause) ──────────────
begin;
  select set_config('request.jwt.claim.sub', '21111111-1111-4111-8111-1111111111b2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.lms_lessons (engagement_id, title, url)
  values ('55555555-5555-4555-8555-5555555555b5', 'V50 default lesson (no status given)', 'https://example.com/d1');
  insert into public.lms_lessons (engagement_id, title, url, status)
  values ('55555555-5555-4555-8555-5555555555b5', 'V50 explicit draft', 'https://example.com/d2', 'draft');
commit;
begin;
  select set_config('request.jwt.claim.sub', '21111111-1111-4111-8111-1111111111b3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if not exists (select 1 from public.lms_lessons where title = 'V50 default lesson (no status given)') then
      raise exception 'V50 assert 12 failed: a lesson added WITHOUT a status must be visible to the assigned student (publish-by-default)'; end if;
    if exists (select 1 from public.lms_lessons where title = 'V50 explicit draft') then
      raise exception 'V50 assert 13 failed: an explicit draft must stay hidden from students'; end if;
  end $$;
commit;

select 'V50 behavioral assertions passed ✅' as status;
