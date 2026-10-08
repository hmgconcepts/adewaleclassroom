-- Behavioral assertions for V49 (round 13). Every expectation runs AS the
-- authenticated role with jwt claims (RLS proven, not assumed). Any broken
-- expectation RAISES, which the harness counts as an error.

-- fixtures
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-1111111111a1', 'v49admin@test.local'),
  ('11111111-1111-4111-8111-1111111111a2', 'v49tutor@test.local'),
  ('11111111-1111-4111-8111-1111111111a3', 'v49learner@test.local'),
  ('11111111-1111-4111-8111-1111111111a4', 'v49parent@test.local'),
  ('11111111-1111-4111-8111-1111111111a6', 'v49other@test.local')
on conflict (id) do nothing;

update public.profiles set role='admin',   status='approved' where id='11111111-1111-4111-8111-1111111111a1';
update public.profiles set role='tutor',   status=null       where id='11111111-1111-4111-8111-1111111111a2';   -- legacy NULL status (the "Unlinked" cause)
update public.profiles set role='learner', status='approved' where id='11111111-1111-4111-8111-1111111111a3';
update public.profiles set role='parent',  status='approved' where id='11111111-1111-4111-8111-1111111111a4';
update public.profiles set role='learner', status='approved' where id='11111111-1111-4111-8111-1111111111a6';

insert into public.tutors (id, user_id, full_name) values
  ('22222222-2222-4222-8222-2222222222a2', '11111111-1111-4111-8111-1111111111a2', 'V49 Tutor')
on conflict (id) do nothing;
insert into public.learners (id, user_id, full_name) values
  ('33333333-3333-4333-8333-3333333333a3', '11111111-1111-4111-8111-1111111111a3', 'V49 Learner'),
  ('33333333-3333-4333-8333-3333333333a6', '11111111-1111-4111-8111-1111111111a6', 'V49 Other Learner')
on conflict (id) do nothing;
insert into public.parents (id, user_id, full_name) values
  ('44444444-4444-4444-8444-4444444444a4', '11111111-1111-4111-8111-1111111111a4', 'V49 Parent')
on conflict (id) do nothing;
insert into public.parent_learner (parent_id, learner_id, relationship)
select '44444444-4444-4444-8444-4444444444a4', '33333333-3333-4333-8333-3333333333a3', 'mother'
where not exists (select 1 from public.parent_learner
                   where parent_id='44444444-4444-4444-8444-4444444444a4'
                     and learner_id='33333333-3333-4333-8333-3333333333a3');
insert into public.engagements (id, name, tutor_id) values
  ('55555555-5555-4555-8555-5555555555a5', 'V49 Maths cluster', '22222222-2222-4222-8222-2222222222a2')
on conflict (id) do nothing;
insert into public.engagement_members (engagement_id, learner_id) values
  ('55555555-5555-4555-8555-5555555555a5', '33333333-3333-4333-8333-3333333333a3')
on conflict do nothing;

insert into public.eresources (id, title, url, engagement_id)
values ('77777777-7777-4777-8777-7777777777a1', 'V49 notes for MY class', 'https://example.com/a', '55555555-5555-4555-8555-5555555555a5'),
       ('77777777-7777-4777-8777-7777777777a2', 'V49 shared notes', 'https://example.com/b', null)
on conflict (id) do nothing;
insert into public.lms_lessons (id, engagement_id, title, url, status)
values ('88888888-8888-4888-8888-8888888888a1', '55555555-5555-4555-8555-5555555555a5', 'V49 published lesson', 'https://example.com/l1', 'published'),
       ('88888888-8888-4888-8888-8888888888a2', '55555555-5555-4555-8555-5555555555a5', 'V49 draft lesson', 'https://example.com/l2', 'draft')
on conflict (id) do nothing;
insert into public.resources (id, engagement_id, title, url, kind)
values ('99999999-9999-4999-8999-9999999999a1', '55555555-5555-4555-8555-5555555555a5', 'V49 class resource', 'https://example.com/r1', 'link')
on conflict (id) do nothing;
insert into public.reading_assignments (id, engagement_id, title)
values ('1aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '55555555-5555-4555-8555-5555555555a5', 'V49 reading: fractions')
on conflict (id) do nothing;
insert into public.reading_items (id, assignment_id, kind, title, url)
values ('1bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb10', '1aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'video', 'V49 intro video', 'https://example.com/watch')
on conflict (id) do nothing;

-- ── 1. the "Unlinked" cause: NULL-status staff could not read engagements
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if not public.is_tutor() then
      raise exception 'V49 assert 1 failed: a NULL-status staff account must still count as a tutor (legacy rows)'; end if;
    if (select count(*) from public.engagements) < 1 then
      raise exception 'V49 assert 2 failed: the tutor still cannot read engagements — the class-name lookup stays broken'; end if;
  end $$;
commit;

-- ── 2. assigned student sees the class shelf (items 6–9) ───────────────
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if not exists (select 1 from public.eresources where id = '77777777-7777-4777-8777-7777777777a1') then
      raise exception 'V49 assert 3 failed: student cannot read their own class e-resource'; end if;
    if not exists (select 1 from public.eresources where id = '77777777-7777-4777-8777-7777777777a2') then
      raise exception 'V49 assert 4 failed: student cannot read the shared shelf'; end if;
    if not exists (select 1 from public.lms_lessons where id = '88888888-8888-4888-8888-8888888888a1') then
      raise exception 'V49 assert 5 failed: student cannot see a PUBLISHED lesson for their class'; end if;
    if exists (select 1 from public.lms_lessons where id = '88888888-8888-4888-8888-8888888888a2') then
      raise exception 'V49 assert 6 failed: a DRAFT lesson leaked to a student'; end if;
    if not exists (select 1 from public.resources where id = '99999999-9999-4999-8999-9999999999a1') then
      raise exception 'V49 assert 7 failed: student cannot read their class resource-library item'; end if;
    if not exists (select 1 from public.reading_items where id = '1bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb10') then
      raise exception 'V49 assert 8 failed: the student cannot read the reading LINK (the item-11 bug)'; end if;
    -- the learner can tick their own progress…
    insert into public.reading_progress (item_id, learner_id, done, done_at)
    values ('1bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb10', '33333333-3333-4333-8333-3333333333a3', true, now())
    on conflict (item_id, learner_id) do update set done = true, done_at = now();
    if not exists (select 1 from public.reading_progress where done) then
      raise exception 'V49 assert 9 failed: learner could not tick a reading item done'; end if;
  end $$;
commit;

-- ── 3. another learner (NOT in that class) must see nothing of it ──────
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a6', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if exists (select 1 from public.eresources where id = '77777777-7777-4777-8777-7777777777a1') then
      raise exception 'V49 assert 10 failed: a learner from another class can read a class-scoped e-resource'; end if;
    if exists (select 1 from public.lms_lessons where id = '88888888-8888-4888-8888-8888888888a1') then
      raise exception 'V49 assert 11 failed: a learner from another class can read a class lesson'; end if;
    if not exists (select 1 from public.eresources where id = '77777777-7777-4777-8777-7777777777a2') then
      raise exception 'V49 assert 12 failed: the shared shelf must stay visible to everyone signed in'; end if;
  end $$;
commit;

-- ── 4. the parent sees what the child sees (GOSA parity) ──────────────
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a4', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if not exists (select 1 from public.eresources where id = '77777777-7777-4777-8777-7777777777a1') then
      raise exception 'V49 assert 13 failed: the parent cannot study with their child (e-resources)'; end if;
    if not exists (select 1 from public.reading_items where id = '1bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb10') then
      raise exception 'V49 assert 14 failed: the parent cannot see the reading links'; end if;
    if not exists (select 1 from public.reading_progress where done) then
      raise exception 'V49 assert 15 failed: the parent cannot see the child''s reading progress'; end if;
  end $$;
commit;

-- ── 5. notifications: the owner can clear their own (item 10) ─────────
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.notifications (user_id, title, body, url)
  values ('11111111-1111-4111-8111-1111111111a3', 'V49 mine', 'clear me', 'messages.html');
commit;
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    delete from public.notifications where user_id = '11111111-1111-4111-8111-1111111111a3' and title = 'V49 mine';
    if exists (select 1 from public.notifications where title = 'V49 mine') then
      raise exception 'V49 assert 16 failed: could not clear my own notification'; end if;
  end $$;
commit;

-- ── 6. notifications v2: app-style inserts + shared-row clearing ──────
-- The app writes recipient_id/created_by (never user_id): those inserts
-- must pass the own-insert policy (they would have been REJECTED by a
-- user_id-only policy). A shared broadcast is never deleted for everyone:
-- notif_clear() hides it per user via cleared_by.
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  -- app shape: Notifications.create() with created_by = sender
  insert into public.notifications (title, body, url, audience, created_by, read_by)
  values ('V49 app broadcast', 'from the app', 'dashboard.html', 'all',
          '11111111-1111-4111-8111-1111111111a1', '{}');
  -- app shape: direct notification with recipient_id
  insert into public.notifications (title, body, url, audience, recipient_id, read_by)
  values ('V49 direct to learner', 'just for you', 'reading.html', 'private',
          '11111111-1111-4111-8111-1111111111a3', '{}');
commit;
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    -- the learner sees both rows…
    if not exists (select 1 from public.notifications where title = 'V49 app broadcast') then
      raise exception 'V49 assert 17 failed: learner cannot see the broadcast'; end if;
    if not exists (select 1 from public.notifications where title = 'V49 direct to learner') then
      raise exception 'V49 assert 18 failed: learner cannot see their direct notification'; end if;
    -- clear ALL: the direct row (mine) disappears, the shared one hides
    if public.notif_clear() is null then
      raise exception 'V49 assert 19 failed: notif_clear returned nothing'; end if;
    if exists (select 1 from public.notifications where title = 'V49 direct to learner') then
      raise exception 'V49 assert 20 failed: my own direct notification was not deleted'; end if;
    if exists (select 1 from public.notifications
                where title = 'V49 app broadcast'
                  and not ('11111111-1111-4111-8111-1111111111a3' = any(coalesce(cleared_by, '{}')))) then
      raise exception 'V49 assert 21 failed: the shared broadcast was not marked cleared for me'; end if;
  end $$;
commit;
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a6', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    -- the other learner never cleared anything: the broadcast is still
    -- fully visible to them and not marked cleared for their uid.
    if not exists (select 1 from public.notifications where title = 'V49 app broadcast') then
      raise exception 'V49 assert 22 failed: one user clearing a shared broadcast removed it for everyone'; end if;
    if exists (select 1 from public.notifications
                where title = 'V49 app broadcast'
                  and '11111111-1111-4111-8111-1111111111a6' = any(coalesce(cleared_by, '{}'))) then
      raise exception 'V49 assert 23 failed: clearing leaked into another user''s view'; end if;
  end $$;
commit;

-- ── 7. My Work board v2: shelves + published-only LMS (items 7 & 9) ───
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $j$ declare v jsonb; begin
    v := public.tc_my_work();
    if not coalesce((v->>'ok')::boolean, false) then
      raise exception 'V49 assert 24 failed: tc_my_work not ok for the learner'; end if;
    if jsonb_array_length(coalesce(v->'eresources', '[]'::jsonb)) < 1 then
      raise exception 'V49 assert 25 failed: work board returns no e-resources shelf'; end if;
    if jsonb_array_length(coalesce(v->'resources', '[]'::jsonb)) < 1 then
      raise exception 'V49 assert 26 failed: work board returns no resource-library shelf'; end if;
    if jsonb_array_length(coalesce(v->'lms', '[]'::jsonb)) < 1 then
      raise exception 'V49 assert 27 failed: work board returns no LMS lessons'; end if;
    if exists (select 1 from jsonb_array_elements(v->'lms') l where l->>'title' = 'V49 draft lesson') then
      raise exception 'V49 assert 28 failed: a DRAFT lesson leaked onto the work board'; end if;
    if not exists (select 1 from jsonb_array_elements(v->'lms') l where l->>'title' = 'V49 published lesson') then
      raise exception 'V49 assert 29 failed: the published lesson is missing from the work board'; end if;
  end $j$;
commit;

select 'V49 behavioral assertions passed ✅' as status;
