-- Behavioral assertions for V47 (round 11): school settings + roaming
-- credentials + the family↔staff messaging chain. RLS is exercised AS the
-- real REST role (set local role authenticated + jwt claims), so policies
-- are proven, not assumed. Any broken expectation RAISES, which the
-- harness counts as an error. All procedural checks run inside DO blocks.

-- ── fixtures: admin, tutor, learner, parent, unlinked learner ──────────
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-1111111111a1', 'v47admin@test.local'),
  ('11111111-1111-4111-8111-1111111111a2', 'v47tutor@test.local'),
  ('11111111-1111-4111-8111-1111111111a3', 'v47learner@test.local'),
  ('11111111-1111-4111-8111-1111111111a4', 'v47parent@test.local'),
  ('11111111-1111-4111-8111-1111111111a5', 'v47other@test.local')
on conflict (id) do nothing;

update public.profiles set role='admin',   status='approved' where id='11111111-1111-4111-8111-1111111111a1';
update public.profiles set role='tutor',   status='approved' where id='11111111-1111-4111-8111-1111111111a2';
update public.profiles set role='learner', status='approved' where id='11111111-1111-4111-8111-1111111111a3';
update public.profiles set role='parent',  status='approved' where id='11111111-1111-4111-8111-1111111111a4';
update public.profiles set role='learner', status='approved' where id='11111111-1111-4111-8111-1111111111a5';

insert into public.tutors (id, user_id, full_name) values
  ('22222222-2222-4222-8222-2222222222a2', '11111111-1111-4111-8111-1111111111a2', 'V47 Tutor')
on conflict (id) do nothing;
insert into public.learners (id, user_id, full_name) values
  ('33333333-3333-4333-8333-3333333333a3', '11111111-1111-4111-8111-1111111111a3', 'V47 Learner'),
  ('33333333-3333-4333-8333-3333333333a5', '11111111-1111-4111-8111-1111111111a5', 'V47 Other Learner')
on conflict (id) do nothing;
insert into public.parents (id, user_id, full_name) values
  ('44444444-4444-4444-8444-4444444444a4', '11111111-1111-4111-8111-1111111111a4', 'V47 Parent')
on conflict (id) do nothing;
insert into public.parent_learner (parent_id, learner_id, relationship)
select '44444444-4444-4444-8444-4444444444a4', '33333333-3333-4333-8333-3333333333a3', 'mother'
where not exists (select 1 from public.parent_learner
                   where parent_id='44444444-4444-4444-8444-4444444444a4'
                     and learner_id='33333333-3333-4333-8333-3333333333a3');
insert into public.engagements (id, name, tutor_id) values
  ('55555555-5555-4555-8555-5555555555a5', 'V47 Maths cluster', '22222222-2222-4222-8222-2222222222a2')
on conflict (id) do nothing;
insert into public.engagement_members (engagement_id, learner_id) values
  ('55555555-5555-4555-8555-5555555555a5', '33333333-3333-4333-8333-3333333333a3')
on conflict do nothing;

-- ── 1. school_settings: seeded client ID, admin manages, learner cannot ──
do $$ begin
  if not exists (select 1 from public.school_settings where id = 1
                  and drive_client_id like '%apps.googleusercontent.com') then
    raise exception 'V47 assert 1 failed: school_settings not seeded with the Google OAuth Client ID'; end if;
end $$;

begin;  -- as ADMIN
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    update public.school_settings set drive_sync_days = 3 where id = 1;
    if (select drive_sync_days from public.school_settings where id = 1) <> 3 then
      raise exception 'V47 assert 2 failed: admin could not save Drive settings'; end if;
  end $$;
commit;

begin;  -- as LEARNER: readable, but NOT writable
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if (select drive_client_id from public.school_settings where id = 1) is null then
      raise exception 'V47 assert 3 failed: learner cannot read school settings'; end if;
    update public.school_settings set drive_sync_days = 99 where id = 1;
    if (select drive_sync_days from public.school_settings where id = 1) <> 3 then
      raise exception 'V47 assert 4 failed: a LEARNER could overwrite the school''s Drive settings'; end if;
  end $$;
commit;

-- ── 2. user_settings: owner-only roaming storage ───────────────────────
begin;  -- as ADMIN: leaves a row the learner must never see
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.user_settings (user_id, key, value)
  values ('11111111-1111-4111-8111-1111111111a1', 'probe', '{"v":"admin"}')
  on conflict (user_id, key) do update set value = excluded.value;
commit;

begin;  -- as LEARNER
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.user_settings (user_id, key, value)
  values ('11111111-1111-4111-8111-1111111111a3', 'cd-turn', '{"cf_key":"k","cf_token":"t"}');
  do $$ begin
    if (select count(*) from public.user_settings where key = 'probe') <> 0 then
      raise exception 'V47 assert 5 failed: learner can see another account''s credentials'; end if;
    if (select value->>'cf_key' from public.user_settings where key = 'cd-turn') <> 'k' then
      raise exception 'V47 assert 6 failed: owner cannot read own roaming row'; end if;
  end $$;
  do $$ begin
    begin
      insert into public.user_settings (user_id, key, value)
      values ('11111111-1111-4111-8111-1111111111a1', 'hijack', '{}');
      raise exception 'V47 assert 7 failed: learner could WRITE credentials into the admin''s account';
    exception when insufficient_privilege then null;  -- expected: policy blocked it
    end;
  end $$;
  update public.user_settings set value = '{"cf_key":"k2","cf_token":"t2"}' where key = 'cd-turn';
  do $$ begin
    if (select value->>'cf_key' from public.user_settings where key = 'cd-turn') <> 'k2' then
      raise exception 'V47 assert 8 failed: owner cannot update own roaming row'; end if;
  end $$;
commit;

-- ── 3. messaging: families ↔ staff, both directions (round-11 item 5) ──
begin;  -- as LEARNER
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if (select jsonb_array_length(public.tc_message_directory())) < 2 then
      raise exception 'V47 assert 9 failed: learner directory does not list the staff'; end if;
    if exists (select 1 from jsonb_array_elements(public.tc_message_directory()) d
                where d->>'id' = '11111111-1111-4111-8111-1111111111a5') then
      raise exception 'V47 assert 10 failed: learner directory offers another learner'; end if;
    perform public.tc_message_send('11111111-1111-4111-8111-1111111111a2', 'Homework', 'Please which page for tomorrow?');
    begin
      perform public.tc_message_send('11111111-1111-4111-8111-1111111111a5', '', 'hi');
      raise exception 'V47 assert 11 failed: learner-to-learner messaging is not blocked';
    exception when others then
      if sqlerrm not like '%tutors and the admins%' then
        raise exception 'V47 assert 11 failed with the wrong error: %', sqlerrm; end if;
    end;
  end $$;
commit;

begin;  -- as TUTOR: the learner's message arrived; replies always work
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a2', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if not exists (select 1 from public.messages
                    where sender = '11111111-1111-4111-8111-1111111111a3'
                      and recipient = '11111111-1111-4111-8111-1111111111a2') then
      raise exception 'V47 assert 12 failed: the learner''s message never landed'; end if;
    perform public.tc_message_send('11111111-1111-4111-8111-1111111111a3', '', 'Page 42 — well spotted!');
    begin  -- unlinked learner with NO existing thread must be refused
      perform public.tc_message_send('11111111-1111-4111-8111-1111111111a5', '', 'hello');
      raise exception 'V47 assert 13 failed: tutor could message an unlinked learner';
    exception when others then
      if sqlerrm not like '%families of your own classes%' then
        raise exception 'V47 assert 13 failed with the wrong error: %', sqlerrm; end if;
    end;
  end $$;
commit;

begin;  -- as PARENT: writes to the admin
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a4', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if (select jsonb_array_length(public.tc_message_directory())) < 2 then
      raise exception 'V47 assert 14 failed: parent directory does not list the staff'; end if;
    perform public.tc_message_send('11111111-1111-4111-8111-1111111111a1', 'Fees', 'Invoice received, thank you.');
  end $$;
commit;

begin;  -- as ADMIN: threads + unread visible on the other side
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    if not exists (select 1 from public.messages
                    where sender = '11111111-1111-4111-8111-1111111111a4'
                      and recipient = '11111111-1111-4111-8111-1111111111a1') then
      raise exception 'V47 assert 15 failed: the parent''s message never reached the admin'; end if;
    if public.tc_message_unread() < 1 then
      raise exception 'V47 assert 16 failed: unread badge shows nothing for the admin'; end if;
  end $$;
commit;

select 'V47 behavioral assertions passed ✅' as status;
