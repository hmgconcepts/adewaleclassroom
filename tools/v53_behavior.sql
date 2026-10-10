-- Behavioral assertions for V53 (round 17). Any broken expectation RAISES.

-- fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('51111111-1111-5111-8111-1111111111d1', 'v53admin@test.local'),
  ('51111111-1111-5111-8111-1111111111d2', 'v53tutorA@test.local'),
  ('51111111-1111-5111-8111-1111111111d3', 'v53tutorB@test.local'),
  ('51111111-1111-5111-8111-1111111111d4', 'v53parent@test.local'),
  ('51111111-1111-5111-8111-1111111111d5', 'v53learner@test.local')
on conflict (id) do nothing;

update public.profiles set role='owner',   status='approved' where id='51111111-1111-5111-8111-1111111111d1';
update public.profiles set role='tutor',  status='approved' where id='51111111-1111-5111-8111-1111111111d2';
update public.profiles set role='tutor',  status='approved' where id='51111111-1111-5111-8111-1111111111d3';
update public.profiles set role='parent', status='approved' where id='51111111-1111-5111-8111-1111111111d4';
update public.profiles set role='learner',status='approved' where id='51111111-1111-5111-8111-1111111111d5';

insert into public.tutors (id, user_id, full_name, email, timezone, hourly_cost) values
  ('53333333-3333-5333-8333-3333333333d2', '51111111-1111-5111-8111-1111111111d2', 'Tutor Alpha', 'a@t.local', 'Africa/Lagos', 5000),
  ('53333333-3333-5333-8333-3333333333d3', '51111111-1111-5111-8111-1111111111d3', 'Tutor Beta',  'b@t.local', 'Europe/London', 4000)
on conflict (id) do nothing;

insert into public.learners (id, user_id, full_name, timezone) values
  ('54444444-4444-5444-8444-4444444444d5', '51111111-1111-5111-8111-1111111111d5', 'V53 Learner', 'America/Toronto')
on conflict (id) do nothing;

insert into public.parents (id, user_id, full_name, email) values
  ('55555555-5555-5555-8555-5555555555d4', '51111111-1111-5111-8111-1111111111d4', 'V53 Parent', 'p@t.local')
on conflict (id) do nothing;
insert into public.parent_learner (parent_id, learner_id) values
  ('55555555-5555-5555-8555-5555555555d4', '54444444-4444-5444-8444-4444444444d5')
on conflict do nothing;

-- one engagement per tutor; the learner sits in tutor A's class only
insert into public.engagements (id, name, kind, subject, tutor_id, status) values
  ('56666666-6666-5666-8666-6666666666d2', 'Alpha Math', 'one_on_one', 'Mathematics', '53333333-3333-5333-8333-3333333333d2', 'active'),
  ('56666666-6666-5666-8666-6666666666d3', 'Beta Physics', 'group', 'Physics', '53333333-3333-5333-8333-3333333333d3', 'active')
on conflict (id) do nothing;
insert into public.engagement_members (engagement_id, learner_id) values
  ('56666666-6666-5666-8666-6666666666d2', '54444444-4444-5444-8444-4444444444d5')
on conflict do nothing;

-- content isolation fixtures: tutor A's own item, a shared item,
-- tutor B's engagement-scoped item
insert into public.library_items (id, title, url, subject, kind, tutor_id, engagement_id) values
  ('57777777-7777-5777-8777-7777777777a1', 'Alpha own reading',   'https://a.example/1', 'Mathematics', 'book', '53333333-3333-5333-8333-3333333333d2', null),
  ('57777777-7777-5777-8777-7777777777a2', 'Studio shared reading','https://a.example/2', 'English',    'book', null, null),
  ('57777777-7777-5777-8777-7777777777a3', 'Beta class-only plan', 'https://a.example/3', 'Physics',    'worksheet', '53333333-3333-5333-8333-3333333333d3', '56666666-6666-5666-8666-6666666666d3')
on conflict (id) do nothing;

-- sessions: two taken by tutor A (one completed), one upcoming
insert into public.sessions (id, engagement_id, tutor_id, starts_at, ends_at, status, hours) values
  ('58888888-8888-5888-8888-8888888888a1', '56666666-6666-5666-8666-6666666666d2', '53333333-3333-5333-8333-3333333333d2', now() - interval '7 days', now() - interval '7 days' + interval '1 hour', 'completed', 1),
  ('58888888-8888-5888-8888-8888888888a2', '56666666-6666-5666-8666-6666666666d2', '53333333-3333-5333-8333-3333333333d2', now() + interval '2 days',  now() + interval '2 days' + interval '1 hour',  'scheduled', 1)
on conflict (id) do nothing;

-- bookings: tutor A's block with one done class + one upcoming
insert into public.booking_blocks (id, engagement_id, learner_id, started_on, times_per_cycle, cycle_count, duration_minutes, hourly_rate, computed_classes, computed_hours, computed_amount, status) values
  ('59999999-9999-5999-8999-9999999999b1', '56666666-6666-5666-8666-6666666666d2', '54444444-4444-5444-8444-4444444444d5', current_date - 14, 1, 2, 60, 5000, 2, 2, 10000, 'active')
on conflict (id) do nothing;
insert into public.booking_classes (id, block_id, cycle_no, seq_in_cycle, scheduled_at, duration_minutes, status, topics_covered, completed_at) values
  ('5aaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaa1', '59999999-9999-5999-8999-9999999999b1', 1, 1, now() - interval '7 days', 60, 'done', 'Fractions — addition', now() - interval '7 days'),
  ('5aaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaa2', '59999999-9999-5999-8999-9999999999b1', 2, 1, now() + interval '7 days', 60, 'scheduled', null, null)
on conflict (id) do nothing;

-- a CBT created by tutor A's portal account
insert into public.cbt_exams (id, title, code, status, tutor_id, created_by) values
  ('5bbbbbbb-bbbb-5bbb-8bbb-bbbbbbbbbbb1', 'Alpha fractions quiz', 'V53ALPHA', 'published', '53333333-3333-5333-8333-3333333333d2', '51111111-1111-5111-8111-1111111111d2')
on conflict (id) do nothing;

-- payroll history for tutor A (matched by name)
insert into public.payroll (tutor_name, period, hours, rate, gross, status) values
  ('Tutor Alpha', '2026-09', 12, 5000, 60000, 'paid')
on conflict do nothing;

-- invoice + payment for the parent
insert into public.invoices (id, parent_id, engagement_id, amount, currency, status) values
  ('5ccccccc-cccc-5ccc-8ccc-ccccccccccc1', '55555555-5555-5555-8555-5555555555d4', '56666666-6666-5666-8666-6666666666d2', 10000, '₦', 'paid')
on conflict (id) do nothing;
insert into public.payments (invoice_id, amount, method, paid_on) values
  ('5ccccccc-cccc-5ccc-8ccc-ccccccccccc1', 10000, 'transfer', current_date)
on conflict do nothing;

-- ── 1. credential truth: RPC write + read, isolated per account ────────
begin;
  select set_config('request.jwt.claim.sub', '51111111-1111-5111-8111-1111111111d2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  select public.tc_set_user_setting('cd-turn', '{"cf_key":"kA","cf_token":"tA"}'::jsonb);
  do $$ declare r jsonb; begin
    select to_jsonb(x) into r from public.tc_get_user_settings() x where x.key = 'cd-turn';
    if r is null or r->'value'->>'cf_key' <> 'kA' then
      raise exception 'V53 assert 1 failed: the RPC roundtrip must store and return the credential'; end if;
  end $$;
commit;
begin;
  select set_config('request.jwt.claim.sub', '51111111-1111-5111-8111-1111111111d3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ declare n int; begin
    select count(*) into n from public.tc_get_user_settings() where key = 'cd-turn';
    if n <> 0 then
      raise exception 'V53 assert 2 failed: another account must NEVER read credentials it did not save'; end if;
  end $$;
commit;
begin;
  select set_config('request.jwt.claim.sub', '51111111-1111-5111-8111-1111111111d2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  -- and the plain table read stays isolated too: the owner sees their row
  do $$ declare n int; begin
    select count(*) into n from public.user_settings where key = 'cd-turn';
    if n <> 1 then
      raise exception 'V53 assert 3 failed: the saving account must see its own row through plain RLS'; end if;
  end $$;
commit;

-- ── 2. backup stamp: admin stamps, learner refused ──────────────────────
begin;
  select set_config('request.jwt.claim.sub', '51111111-1111-5111-8111-1111111111d5', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    begin
      perform public.tc_stamp_backup('device: learner-should-not.pdf');
      raise exception 'V53 assert 4 failed: a learner must not be allowed to stamp the studio backup';
    exception when others then
      if sqlerrm like 'V53 assert 4%' then raise; end if;
      -- the expected privilege error — pass through
    end;
  end $$;
commit;
begin;
  select set_config('request.jwt.claim.sub', '51111111-1111-5111-8111-1111111111d1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ declare ts timestamptz; begin
    select public.tc_stamp_backup('device: v53-backup.json') into ts;
    if ts is null then
      raise exception 'V53 assert 5 failed: the admin stamp must return the studio-wide timestamp'; end if;
    if not exists (select 1 from public.practice_settings
                    where id = 1 and backup_path = 'device: v53-backup.json') then
      raise exception 'V53 assert 6 failed: the stamp must record WHERE the newest archive lives'; end if;
  end $$;
commit;

-- ── 3. tutor content isolation ──────────────────────────────────────────
begin;
  select set_config('request.jwt.claim.sub', '51111111-1111-5111-8111-1111111111d2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ declare own int; shared int; theirs int; begin
    select count(*) into own     from public.library_items where id = '57777777-7777-5777-8777-7777777777a1';
    select count(*) into shared  from public.library_items where id = '57777777-7777-5777-8777-7777777777a2';
    select count(*) into theirs from public.library_items where id = '57777777-7777-5777-8777-7777777777a3';
    if own <> 1 or shared <> 1 then
      raise exception 'V53 assert 7 failed: a tutor must see their OWN items and the studio-shared shelf'; end if;
    if theirs <> 0 then
      raise exception 'V53 assert 8 failed: a tutor must NOT see another tutor''s class-scoped item'; end if;
  end $$;
commit;

-- ── 4. the tutor monitor: admin sees everything, tutor refused ──────────
begin;
  select set_config('request.jwt.claim.sub', '51111111-1111-5111-8111-1111111111d1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ declare r jsonb; begin
    select public.tc_tutor_monitor('53333333-3333-5333-8333-3333333333d2') into r;
    if coalesce(r->>'ok', 'false') <> 'true' then
      raise exception 'V53 assert 9 failed: the admin must get the tutor monitor'; end if;
    if (r->'sessions'->>'total')::int <> 2 or (r->'sessions'->>'completed')::int <> 1 then
      raise exception 'V53 assert 10 failed: classes-taken counts wrong (%)', r->'sessions'; end if;
    if (r->'bookings'->>'completed')::int <> 1 or (r->'bookings'->>'ongoing')::int <> 1 then
      raise exception 'V53 assert 11 failed: booking counts wrong (%/%)', r->'bookings'->>'completed', r->'bookings'->>'ongoing'; end if;
    if (r->'cbts'->>'count')::int <> 1 then
      raise exception 'V53 assert 12 failed: CBTs-created count wrong'; end if;
    if jsonb_array_length(r->'students') <> 1 then
      raise exception 'V53 assert 13 failed: students-taught list wrong'; end if;
    if jsonb_array_length(r->'payroll_history') <> 1 then
      raise exception 'V53 assert 14 failed: payroll history missing'; end if;
    if not (r->'topics_covered' @> '["Fractions — addition"]') then
      raise exception 'V53 assert 15 failed: topics covered missing'; end if;
    if (r->'bookings'->>'computed_earnings')::numeric <> 10000 then
      raise exception 'V53 assert 16 failed: computed booking earnings wrong'; end if;
  end $$;
commit;
begin;
  select set_config('request.jwt.claim.sub', '51111111-1111-5111-8111-1111111111d2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ declare r jsonb; begin
    select public.tc_tutor_monitor('53333333-3333-5333-8333-3333333333d2') into r;
    if coalesce(r->>'ok', 'true') <> 'false' then
      raise exception 'V53 assert 17 failed: a tutor must NOT open the monitor'; end if;
  end $$;
commit;

-- ── 5. the parent monitor: children + payments ──────────────────────────
begin;
  select set_config('request.jwt.claim.sub', '51111111-1111-5111-8111-1111111111d1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ declare r jsonb; begin
    select public.tc_parent_monitor('55555555-5555-5555-8555-5555555555d4') into r;
    if coalesce(r->>'ok', 'false') <> 'true' then
      raise exception 'V53 assert 18 failed: the admin must get the parent monitor'; end if;
    if jsonb_array_length(r->'children') <> 1
        or jsonb_array_length(r->'children'->0->'engagements') <> 1 then
      raise exception 'V53 assert 19 failed: the parent''s children and their classes must list'; end if;
    if jsonb_array_length(r->'payments') <> 1 or jsonb_array_length(r->'invoices') <> 1 then
      raise exception 'V53 assert 20 failed: the payment history must list'; end if;
  end $$;
commit;

select 'V53 behavioral assertions passed ✅' as status;
