-- Private storage buckets for vault archives and proctor snapshots (1 GB file space, not the 500 MB DB).
insert into storage.buckets (id, name, public)
values ('archives', 'archives', false), ('proctor', 'proctor', false)
on conflict (id) do nothing;

-- Learners may upload only into their own proctor prefix; staff may read/delete.
drop policy if exists proctor_upload on storage.objects;
create policy proctor_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'proctor');
drop policy if exists proctor_staff_read on storage.objects;
create policy proctor_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'proctor');
drop policy if exists archives_admin on storage.objects;
create policy archives_admin on storage.objects for all to authenticated
  using (bucket_id = 'archives') with check (bucket_id = 'archives');
select 'Storage offload buckets ready ✅' as status;
