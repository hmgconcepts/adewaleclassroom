-- Behavioral assertions for the V46 CBT→assignment automation.
-- Any broken expectation RAISES, which the harness counts as an error.
begin;
insert into public.engagements (id, name, subject)
values ('11111111-1111-1111-1111-111111111111', 'V46 test cluster', 'Mathematics') on conflict do nothing;
insert into public.cbt_exams (id, code, title, subject, quiz_kind, status, is_open, engagement_id, close_at, questions)
values ('22222222-2222-2222-2222-222222222222', 'V46T', 'V46 behavior paper', 'Mathematics', 'graded', 'published', true,
        '11111111-1111-1111-1111-111111111111', now() + interval '3 days',
        '[{"q":"1+1","a":"2","mark":2},{"q":"2+2","a":"4","mark":3}]'::jsonb);
do $$ begin
  if (select count(*) from public.assignments where cbt_exam_id = '22222222-2222-2222-2222-222222222222') <> 1 then
    raise exception 'V46 assert 1 failed: publish did not create exactly one mirror row'; end if;
  if (select submission_url is distinct from 'cbt-exam.html?code=V46T' from public.assignments where cbt_exam_id = '22222222-2222-2222-2222-222222222222') then
    raise exception 'V46 assert 2 failed: mirror missing the sit link'; end if;
  if (select coalesce(max_score, 0) <> 5 from public.assignments where cbt_exam_id = '22222222-2222-2222-2222-222222222222') then
    raise exception 'V46 assert 3 failed: mirror max_score should be 5 (sum of marks)'; end if;
end $$;
update public.cbt_exams set title = 'V46 renamed' where id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  if (select count(*) from public.assignments where cbt_exam_id = '22222222-2222-2222-2222-222222222222' and title like '%renamed%') <> 1 then
    raise exception 'V46 assert 4 failed: rename did not follow through to the mirror'; end if;
end $$;
update public.cbt_exams set is_archived = true where id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  if (select count(*) from public.assignments where cbt_exam_id = '22222222-2222-2222-2222-222222222222') <> 0 then
    raise exception 'V46 assert 5 failed: archive did not withdraw the homework mirror'; end if;
end $$;
update public.cbt_exams set is_archived = false where id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  if (select count(*) from public.assignments where cbt_exam_id = '22222222-2222-2222-2222-222222222222') <> 1 then
    raise exception 'V46 assert 6 failed: restore did not bring the mirror back'; end if;
end $$;
delete from public.cbt_exams where id = '22222222-2222-2222-2222-222222222222';
do $$ begin
  if (select count(*) from public.assignments where kind = 'cbt') <> 0 then
    raise exception 'V46 assert 7 failed: deleting the exam orphaned its homework mirror'; end if;
end $$;
commit;
select 'V46 behavioral assertions passed ✅' as status;
