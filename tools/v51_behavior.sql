-- Behavioral assertions for V51 (round 15). Any broken expectation RAISES.

-- fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('31111111-1111-4111-8111-1111111111c1', 'v51owner@test.local'),
  ('31111111-1111-4111-8111-1111111111c2', 'v51learner@test.local'),
  ('31111111-1111-4111-8111-1111111111c3', 'v51parent@test.local')
on conflict (id) do nothing;

update public.profiles set role='owner',   status='pending' where id='31111111-1111-4111-8111-1111111111c1';
update public.profiles set role='learner', status='approved' where id='31111111-1111-4111-8111-1111111111c2';
update public.profiles set role='parent',  status='approved' where id='31111111-1111-4111-8111-1111111111c3';

insert into public.learners (id, user_id, full_name) values
  ('33333333-3333-4333-8333-3333333333c2', '31111111-1111-4111-8111-1111111111c2', 'V51 Learner')
on conflict (id) do nothing;
insert into public.parents (id, user_id, full_name) values
  ('44444444-4444-4444-8444-4444444444c3', '31111111-1111-4111-8111-1111111111c3', 'V51 Parent')
on conflict (id) do nothing;
insert into public.parent_learner (parent_id, learner_id) values
  ('44444444-4444-4444-8444-4444444444c3', '33333333-3333-4333-8333-3333333333c2')
on conflict do nothing;

insert into public.engagements (id, name) values
  ('55555555-5555-4555-8555-5555555555c1', 'V51 My class'),
  ('55555555-5555-4555-8555-5555555555c2', 'V51 Other class')
on conflict (id) do nothing;

insert into public.engagement_members (engagement_id, learner_id) values
  ('55555555-5555-4555-8555-5555555555c1', '33333333-3333-4333-8333-3333333333c2')
on conflict do nothing;

-- ── 1. THE ROUND-15 BUG: the learner resolves the class name ─────────
begin;
  select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-1111111111c2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if (public.tc_ref_labels('engagements') ->> '55555555-5555-4555-8555-5555555555c1') is null then
      raise exception 'V51 assert 1 failed: the LEARNER must get the name of their own engagement — the student-portal "linked · name unavailable" bug'; end if;
    if (public.tc_ref_labels('engagements') ->> '55555555-5555-4555-8555-5555555555c2') is not null then
      raise exception 'V51 assert 2 failed: the learner must NOT receive names of other classes'; end if;
    if (select count(*) from jsonb_object_keys(public.tc_ref_labels('tutors'))) <> 0 then
      raise exception 'V51 assert 3 failed: tutor names are staff-only'; end if;
  end $$;
commit;

-- ── 2. the parent resolves the child's class name ─────────────────────
begin;
  select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-1111111111c3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if (public.tc_ref_labels('engagements') ->> '55555555-5555-4555-8555-5555555555c1') is null then
      raise exception 'V51 assert 4 failed: the PARENT must get the name of their child''s class'; end if;
  end $$;
commit;

-- ── 3. staff still get the full map ───────────────────────────────────
begin;
  select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-1111111111c1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if (public.tc_ref_labels('engagements') ->> '55555555-5555-4555-8555-5555555555c2') is null then
      raise exception 'V51 assert 5 failed: staff must still see every engagement name'; end if;
  end $$;
commit;

-- a studio-wide reading (no engagement): visible to EVERY learner, so the
-- foreign-insert test below inserts a real row instead of zero rows.
insert into public.library_items (title, url, subject, max_score, has_quiz)
values ('V51 studio-wide reading', 'https://example.com/v51w', 'V51 Subject', 10, true)
on conflict do nothing;

-- ── 4. library quiz: authoring, attempt visibility, insert rule ──────
begin;
  select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-1111111111c1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.library_items (title, url, subject, engagement_id, instructions,
                                    due_date, max_score, attempts_allowed, has_quiz, questions)
  values ('V51 reading', 'https://example.com/v51', 'V51 Subject', '55555555-5555-4555-8555-5555555555c1',
          'Read chapters 1-3', current_date + 7, 10, 2, true,
          '[{"type":"mcq","q":"2+2?","options":["3","4"],"answer":"4"}]'::jsonb);
commit;

begin;
  select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-1111111111c2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if not exists (select 1 from public.library_items where title = 'V51 reading') then
      raise exception 'V51 assert 6 failed: the learner must see the class-scoped reading'; end if;
  end $$;
  insert into public.library_quiz_attempts (item_id, learner_id, score, max_score)
  select id, '33333333-3333-4333-8333-3333333333c2', 8, 10 from public.library_items where title = 'V51 reading';
  do $$ begin
    if not exists (select 1 from public.library_quiz_attempts where score = 8) then
      raise exception 'V51 assert 7 failed: the learner''s own attempt must be recorded'; end if;
  end $$;
commit;

-- a DIFFERENT learner's attempt must be invisible, and foreign inserts refused
insert into auth.users (id, email) values ('31111111-1111-4111-8111-1111111111c4', 'v51other@test.local')
on conflict (id) do nothing;
update public.profiles set role='learner', status='approved' where id='31111111-1111-4111-8111-1111111111c4';
insert into public.learners (id, user_id, full_name) values
  ('33333333-3333-4333-8333-3333333333c4', '31111111-1111-4111-8111-1111111111c4', 'V51 Other Learner')
on conflict (id) do nothing;

begin;
  select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-1111111111c4', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if exists (select 1 from public.library_quiz_attempts where score = 8) then
      raise exception 'V51 assert 8 failed: another learner''s attempt must be invisible'; end if;
    begin
      insert into public.library_quiz_attempts (item_id, learner_id, score, max_score)
      select id, '33333333-3333-4333-8333-3333333333c2', 99, 10 from public.library_items where title = 'V51 studio-wide reading';
      raise exception 'V51 assert 9 failed: a learner must not be able to file an attempt under another learner''s id';
    exception when insufficient_privilege then
      null;  -- the RLS refusal we WANT
    end;
  end $$;
commit;

-- ── 5. last_backup_at exists and is settable by the owner ────────────
begin;
  select set_config('request.jwt.claim.sub', '31111111-1111-4111-8111-1111111111c1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  update public.practice_settings set last_backup_at = now() where id = 1;
  do $$ begin
    if not exists (select 1 from public.practice_settings where id = 1 and last_backup_at is not null) then
      raise exception 'V51 assert 10 failed: last_backup_at must be writable by the owner'; end if;
  end $$;
commit;

select 'V51 behavioral assertions passed ✅' as status;
