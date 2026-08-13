-- Stream, classwork, exam registration (idempotent).
create table if not exists public.exam_reg_links (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text, board text, series text, intro text,
  expires_on date, max_uses int, uses int default 0,
  status text default 'open', created_at timestamptz default now()
);
create table if not exists public.exam_registrations (
  id uuid primary key default gen_random_uuid(),
  code text, full_name text, student_no text, email text, phone text,
  dob date, sex text, id_no text, board text, series text, centre text,
  subjects text, photo_url text, doc_url text, guardian text, notes text,
  status text default 'submitted', created_at timestamptz default now()
);
create table if not exists public.stream_posts (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid, kind text, title text, body text, media_url text,
  publish_at timestamptz default now(), created_at timestamptz default now()
);
create table if not exists public.classwork_items (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid, topic text, kind text, title text, due_on date,
  points int, skills text, media_url text, created_at timestamptz default now()
);
alter table public.exam_reg_links enable row level security;
alter table public.exam_registrations enable row level security;
alter table public.stream_posts enable row level security;
alter table public.classwork_items enable row level security;
drop policy if exists exam_links_pub on public.exam_reg_links;
create policy exam_links_pub on public.exam_reg_links for select using (status = 'open');
drop policy if exists exam_reg_ins on public.exam_registrations;
create policy exam_reg_ins on public.exam_registrations for insert with check (true);
drop policy if exists exam_reg_staff on public.exam_registrations;
create policy exam_reg_staff on public.exam_registrations for all using (public.is_tutor()) with check (public.is_tutor());
drop policy if exists stream_rw on public.stream_posts;
create policy stream_rw on public.stream_posts for all using (true) with check (true);
drop policy if exists classwork_rw on public.classwork_items;
create policy classwork_rw on public.classwork_items for all using (true) with check (true);
grant select on public.exam_reg_links to anon, authenticated;
grant insert on public.exam_registrations to anon, authenticated;
grant select, insert, update, delete on public.stream_posts, public.classwork_items to authenticated;
select 'V3 classroom + exam registration installed ✅' as status;
