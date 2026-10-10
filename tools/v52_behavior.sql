-- Behavioral assertions for V52 (round 16). Any broken expectation RAISES.

-- fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('41111111-1111-4111-8111-1111111111d1', 'v52owner@test.local'),
  ('41111111-1111-4111-8111-1111111111d2', 'v52learner@test.local')
on conflict (id) do nothing;

update public.profiles set role='owner',   status='pending' where id='41111111-1111-4111-8111-1111111111d1';
update public.profiles set role='learner', status='approved' where id='41111111-1111-4111-8111-1111111111d2';

insert into public.learners (id, user_id, full_name, timezone) values
  ('33333333-3333-4333-8333-3333333333d2', '41111111-1111-4111-8111-1111111111d2', 'V52 Learner', 'America/Toronto')
on conflict (id) do nothing;

update public.practice_settings set timezone = 'Africa/Lagos' where id = 1;

insert into public.tc_timezone_desk (party_type, learner_id, city, country, tz, is_default, active)
values ('learner', '33333333-3333-4333-8333-3333333333d2', 'Toronto', 'Canada', 'America/Toronto', false, true)
on conflict do nothing;
insert into public.tc_timezone_desk (party_type, label, city, country, tz, is_default, active)
values ('studio', 'Studio clock', 'Lagos', 'Nigeria', 'Africa/Lagos', true, true)
on conflict do nothing;

-- ── 1. the learner: home + their own zone in ONE call ────────────────
begin;
  select set_config('request.jwt.claim.sub', '41111111-1111-4111-8111-1111111111d2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ declare r jsonb; begin
    select public.tc_my_tz() into r;
    if coalesce(r->>'home', '') <> 'Africa/Lagos' then
      raise exception 'V52 assert 1 failed: home must be the studio clock (Africa/Lagos), got %', r->>'home'; end if;
    if coalesce(r->>'mine', '') <> 'America/Toronto' then
      raise exception 'V52 assert 2 failed: the learner''s own zone (desk entry) must resolve, got %', r->>'mine'; end if;
  end $$;
commit;

-- ── 2. the owner: home resolves; mine is null (studio clock is theirs) ─
begin;
  select set_config('request.jwt.claim.sub', '41111111-1111-4111-8111-1111111111d1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ declare r jsonb; begin
    select public.tc_my_tz() into r;
    if coalesce(r->>'home', '') <> 'Africa/Lagos' then
      raise exception 'V52 assert 3 failed: the owner must still get the studio clock'; end if;
    if r->>'mine' is not null and r->>'mine' <> '' then
      raise exception 'V52 assert 4 failed: an owner''s clock IS the studio clock — mine must be null'; end if;
  end $$;
commit;

-- ── 3. the desk entry wins over the role-table column ────────────────
update public.learners set timezone = 'Europe/London' where id = '33333333-3333-4333-8333-3333333333d2';
begin;
  select set_config('request.jwt.claim.sub', '41111111-1111-4111-8111-1111111111d2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ declare r jsonb; begin
    select public.tc_my_tz() into r;
    if coalesce(r->>'mine', '') <> 'America/Toronto' then
      raise exception 'V52 assert 5 failed: the desk entry must take precedence over the learners.timezone column, got %', r->>'mine'; end if;
  end $$;
commit;

-- ── 4. anonymous: home only, never a personal zone ────────────────────
begin;
  set local role authenticated;
  do $$ declare r jsonb; begin
    select public.tc_my_tz() into r;
    if coalesce(r->>'home', '') = '' then
      raise exception 'V52 assert 6 failed: even without a uid, home must answer'; end if;
  end $$;
commit;


-- ── 5. tc_last_backup(): studio truth for ANY authenticated member ─────
update public.practice_settings set last_backup_at = now() - interval '2 hours',
                                    backup_path = 'device: tutoring-connect-backup-test.json'
where id = 1;
begin;
  select set_config('request.jwt.claim.sub', '41111111-1111-4111-8111-1111111111d2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ declare r jsonb; begin
    select to_jsonb(x) into r from public.tc_last_backup() x limit 1;
    if r is null or r->>'last_backup_at' is null then
      raise exception 'V52 assert 7 failed: tc_last_backup() must return the studio record for any authenticated member'; end if;
    if coalesce(r->>'backup_path', '') = '' then
      raise exception 'V52 assert 8 failed: tc_last_backup() must carry backup_path'; end if;
  end $$;
commit;

select 'V52 behavioral assertions passed ✅' as status;
