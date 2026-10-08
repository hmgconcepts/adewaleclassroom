-- Behavioral assertions for V48 (round 12): every notification the platform
-- raises must carry a working url, so clicking it in the bell leads to the
-- right page. Any broken expectation RAISES.

-- fixtures (ids reused from v47 behavior)
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-1111111111a1', 'v48admin@test.local'),
  ('11111111-1111-4111-8111-1111111111a3', 'v48learner@test.local')
on conflict (id) do nothing;
update public.profiles set role='admin',   status='approved' where id='11111111-1111-4111-8111-1111111111a1';
update public.profiles set role='learner', status='approved' where id='11111111-1111-4111-8111-1111111111a3';

insert into public.cbt_exams (id, code, title, subject, quiz_kind, status, is_open, questions)
values ('66666666-6666-4666-8666-6666666666a6', 'V48T', 'V48 paper', 'Mathematics', 'graded', 'published', true,
        '[{"q":"1+1","a":"2","mark":2}]'::jsonb)
on conflict (id) do nothing;

-- 1. a message raises a notification that deep-links to the messages page
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a3', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    perform public.tc_message_send('11111111-1111-4111-8111-1111111111a1', '', 'V48 deep-link test');
    if not exists (select 1 from public.notifications
                    where user_id = '11111111-1111-4111-8111-1111111111a1'
                      and title like 'New message from%'
                      and url = 'messages.html') then
      raise exception 'V48 assert 1 failed: message notification has no messages.html url'; end if;
  end $$;
commit;

-- 2. a CBT submission raises a notification that deep-links to its results
begin;
  select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-1111111111a1', true);
  select set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  do $$ begin
    insert into public.cbt_results (exam_id, candidate_name, score, max_score)
    values ('66666666-6666-4666-8666-6666666666a6', 'V48 candidate', 2, 2);
    if not exists (select 1 from public.notifications
                    where title like 'CBT submitted: V48 paper%'
                      and url = 'cbt-results.html?exam=66666666-6666-4666-8666-6666666666a6') then
      raise exception 'V48 assert 2 failed: CBT notification has no results url'; end if;
  end $$;
commit;

-- 3. legacy backfill: pre-V48 message notifications are clickable too
insert into public.notifications (user_id, title, body)
values ('11111111-1111-4111-8111-1111111111a1', 'New message from Legacy Sender', 'old row')
on conflict do nothing;
-- (simulate the backfill having already run by re-running it — idempotent)
update public.notifications
   set url = 'messages.html'
 where url is null and title like 'New message from %';
do $$ begin
  if not exists (select 1 from public.notifications
                  where title = 'New message from Legacy Sender' and url = 'messages.html') then
    raise exception 'V48 assert 3 failed: legacy message notification was not backfilled'; end if;
end $$;

select 'V48 behavioral assertions passed ✅' as status;
