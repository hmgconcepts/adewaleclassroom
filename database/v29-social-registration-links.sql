-- ===========================================================================
-- TUTORING CONNECT — V29
-- ---------------------------------------------------------------------------
-- SOCIAL REGISTRATION LINKS for paid AND free classes.
--
-- The studio creates ONE short link per class and shares it on social media
-- (WhatsApp, Facebook, X, LinkedIn, Telegram, email, QR). The link opens a
-- public landing page (class-register.html?code=…) that shows what the class
-- is, what it costs (or that it is free), when it runs and where, and lets a
-- parent/student register in under a minute. Every registration is captured
-- with a registration number, and the studio tracks usage per link so it can
-- see which handle actually brings families.
--
-- Two tables, five RPCs. Free and paid classes share one mechanism: the only
-- difference is a price and a badge. A free registration is NOT a learner or
-- a client — it stays in tc_class_registrations (the same principle the free
-- cohort flow uses) until the studio deliberately moves it.
--
-- Idempotent: every statement is guarded (create or replace, add column if
-- not exists, drop policy if exists, create table if not exists).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------
create table if not exists public.tc_class_links (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- short code in the share URL
  kind        text not null default 'paid' check (kind in ('paid','free')),
  title       text not null,
  subject     text,
  tutor_name  text,
  starts_on   date,
  schedule    text,                                 -- e.g. "Sat 10:00 – 12:00 · 8 weeks"
  platform    text,                                 -- YouTube / Zoom / Meet / WhatsApp / In-person
  price       numeric(12,2),                        -- NULL / 0 for free
  currency    text default '₦',
  image_url   text,                                 -- Drive / web link, never an upload
  intro       text,                                 -- the message shown on the landing page
  meeting_url text,                                 -- link to the live class / joining instructions
  group_url   text,                                 -- WhatsApp / Telegram group link
  status      text not null default 'open' check (status in ('open','closed','archived')),
  expires_on  date,
  max_uses    int,
  uses        int not null default 0,
  created_by  uuid default auth.uid(),
  created_at  timestamptz default now()
);

create index if not exists tc_class_links_code_idx on public.tc_class_links (code);
create index if not exists tc_class_links_kind_idx on public.tc_class_links (kind);

create table if not exists public.tc_class_registrations (
  id           uuid primary key default gen_random_uuid(),
  link_id      uuid references public.tc_class_links(id) on delete cascade,
  reg_no       text not null unique,
  parent_name  text not null,
  email        text,
  phone        text,
  learner_name text,
  learner_year text,
  school       text,
  how_heard    text,
  consent      boolean default false,               -- guardian consent for minors
  notes        text,
  status       text not null default 'new' check (status in ('new','contacted','booked','converted','closed')),
  created_at   timestamptz default now()
);

create index if not exists tc_class_regs_link_idx on public.tc_class_registrations (link_id);
create index if not exists tc_class_regs_created_idx on public.tc_class_registrations (created_at desc);

-- ---------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.tc_class_links enable row level security;
alter table public.tc_class_registrations enable row level security;

-- Links: staff write; the public reads only open links (the RPC also gates).
drop policy if exists tc_class_links_staff on public.tc_class_links;
create policy tc_class_links_staff on public.tc_class_links
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

drop policy if exists tc_class_links_public on public.tc_class_links;
create policy tc_class_links_public on public.tc_class_links
  for select to anon, authenticated
  using (status = 'open');

-- Registrations: staff see and manage; the public never reads (the register
-- RPC inserts via SECURITY DEFINER, so no anon INSERT policy is needed).
drop policy if exists tc_class_regs_staff on public.tc_class_registrations;
create policy tc_class_regs_staff on public.tc_class_registrations
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

revoke all on public.tc_class_links, public.tc_class_registrations from anon;

select 'V29 class-link tables installed' as status;

-- ---------------------------------------------------------------------------
-- 3. PUBLIC RPCs
-- ---------------------------------------------------------------------------
-- Open a link by code. Returns everything the landing page needs, plus the
-- share text so the page can offer "forward this to a friend". Only open,
-- unexpired, under-limit links are returned.
create or replace function public.tc_class_link_get(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  l public.tc_class_links%rowtype;
begin
  if p_code is null or trim(p_code) = '' then
    return jsonb_build_object('ok', false, 'error', 'No class link given.');
  end if;

  select * into l from public.tc_class_links where code = p_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This link does not match any class.');
  end if;
  if l.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'Registration for this class is closed.');
  end if;
  if l.expires_on is not null and l.expires_on < current_date then
    return jsonb_build_object('ok', false, 'error', 'This registration link expired on ' || l.expires_on || '.');
  end if;
  if coalesce(l.max_uses, 0) > 0 and coalesce(l.uses, 0) >= l.max_uses then
    return jsonb_build_object('ok', false, 'error', 'This registration link has reached its limit.');
  end if;

  v := jsonb_build_object(
    'ok', true,
    'id', l.id, 'code', l.code, 'kind', l.kind,
    'title', l.title, 'subject', l.subject, 'tutor_name', l.tutor_name,
    'starts_on', l.starts_on, 'schedule', l.schedule, 'platform', l.platform,
    'price', l.price, 'currency', l.currency, 'image_url', l.image_url,
    'intro', l.intro, 'meeting_url', l.meeting_url, 'group_url', l.group_url,
    'created_at', l.created_at);
  return v;
end $$;

revoke all on function public.tc_class_link_get(text) from public, anon;
grant execute on function public.tc_class_link_get(text) to anon, authenticated;

-- Register for a class. Validates the link exactly like tc_class_link_get,
-- then writes one registration, bumps the use counter and issues a reg_no.
create or replace function public.tc_class_register(
  p_code        text,
  p_parent_name text,
  p_email       text default null,
  p_phone       text default null,
  p_learner_name text default null,
  p_learner_year text default null,
  p_school      text default null,
  p_how_heard   text default null,
  p_consent     boolean default false,
  p_notes       text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.tc_class_links%rowtype;
  v_reg_no text;
  v_id uuid;
begin
  if coalesce(trim(p_parent_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Please enter the parent / guardian name.');
  end if;

  select * into l from public.tc_class_links where code = p_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'This link does not match any class.');
  end if;
  if l.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'Registration for this class is closed.');
  end if;
  if l.expires_on is not null and l.expires_on < current_date then
    return jsonb_build_object('ok', false, 'error', 'This registration link expired on ' || l.expires_on || '.');
  end if;
  if coalesce(l.max_uses, 0) > 0 and coalesce(l.uses, 0) >= l.max_uses then
    return jsonb_build_object('ok', false, 'error', 'This registration link has reached its limit.');
  end if;
  -- Guardian consent: required on the PAGE when a child is registering. The
  -- database stores the consent flag with the registration; enforcement lives
  -- in the form so a legitimate parent with a broken checkbox is never
  -- silently blocked at the database layer.
  if coalesce(p_consent, false) = false and p_learner_year ~ '^[0-9]+$'
     and p_learner_year::int < 18 then
    return jsonb_build_object('ok', false, 'error',
      'Please tick the guardian consent box — this class is for a minor.');
  end if;

  v_reg_no := 'REG-' || upper(substr(md5(l.id::text || clock_timestamp()::text), 1, 8));

  insert into public.tc_class_registrations
    (link_id, reg_no, parent_name, email, phone, learner_name, learner_year,
     school, how_heard, consent, notes)
  values
    (l.id, v_reg_no, trim(p_parent_name), nullif(trim(coalesce(p_email,'')),''),
     nullif(trim(coalesce(p_phone,'')),''), nullif(trim(coalesce(p_learner_name,'')),''),
     nullif(trim(coalesce(p_learner_year,'')),''), nullif(trim(coalesce(p_school,'')),''),
     nullif(trim(coalesce(p_how_heard,'')),''), coalesce(p_consent,false),
     nullif(trim(coalesce(p_notes,'')),''))
  returning id into v_id;

  update public.tc_class_links set uses = uses + 1 where id = l.id;

  return jsonb_build_object(
    'ok', true,
    'reg_no', v_reg_no,
    'registration_id', v_id,
    'class_title', l.title,
    'kind', l.kind,
    'meeting_url', l.meeting_url,
    'group_url', l.group_url,
    'platform', l.platform,
    'starts_on', l.starts_on,
    'message', 'You are registered! Keep this number for your records.'
  );
end $$;

revoke all on function public.tc_class_register(text, text, text, text, text, text, text, text, boolean, text)
  from public, anon;
grant execute on function public.tc_class_register(text, text, text, text, text, text, text, text, boolean, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. STAFF RPCs
-- ---------------------------------------------------------------------------
-- List the links I may manage, with registration counts and the share URL.
create or replace function public.tc_class_links_my()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', l.id, 'code', l.code, 'kind', l.kind, 'title', l.title,
               'subject', l.subject, 'price', l.price, 'currency', l.currency,
               'starts_on', l.starts_on, 'platform', l.platform,
               'status', l.status, 'uses', l.uses, 'max_uses', l.max_uses,
               'expires_on', l.expires_on,
               'regs', (select count(*) from public.tc_class_registrations r
                         where r.link_id = l.id),
               'regs_new', (select count(*) from public.tc_class_registrations r
                             where r.link_id = l.id and r.status = 'new'),
               'created_at', l.created_at
             ) as x
        from public.tc_class_links l
       where public.tc_is_manager() or l.created_by = auth.uid()
    ) s;
$$;

revoke all on function public.tc_class_links_my() from public, anon;
grant execute on function public.tc_class_links_my() to authenticated;

-- List registrations for one link (staff).
create or replace function public.tc_class_regs_for(p_link uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', r.id, 'reg_no', r.reg_no, 'parent_name', r.parent_name,
               'email', r.email, 'phone', r.phone, 'learner_name', r.learner_name,
               'learner_year', r.learner_year, 'school', r.school,
               'how_heard', r.how_heard, 'consent', r.consent, 'notes', r.notes,
               'status', r.status, 'created_at', r.created_at
             ) as x
        from public.tc_class_registrations r
       where r.link_id = p_link
    ) s;
$$;

revoke all on function public.tc_class_regs_for(uuid) from public, anon;
grant execute on function public.tc_class_regs_for(uuid) to authenticated;

-- Set a registration's status (new → contacted → booked → converted → closed).
create or replace function public.tc_class_reg_status(p_reg uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('new','contacted','booked','converted','closed') then
    return jsonb_build_object('ok', false, 'error', 'Unknown status.');
  end if;
  update public.tc_class_registrations set status = p_status where id = p_reg;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

revoke all on function public.tc_class_reg_status(uuid, text) from public, anon;
grant execute on function public.tc_class_reg_status(uuid, text) to authenticated;

-- Open / close / archive a link.
create or replace function public.tc_class_link_set_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('open','closed','archived') then
    return jsonb_build_object('ok', false, 'error', 'Unknown status.');
  end if;
  update public.tc_class_links set status = p_status where id = p_id;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

revoke all on function public.tc_class_link_set_status(uuid, text) from public, anon;
grant execute on function public.tc_class_link_set_status(uuid, text) to authenticated;

select 'V29 class-link RPCs installed' as status;

-- ---------------------------------------------------------------------------
-- 5. SELF-TEST
-- ---------------------------------------------------------------------------
create or replace function public.tc_v29_check()
returns table (kind text, name text, present boolean, needed_for text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare t record;
begin
  for t in
    select * from (values
      ('tc_class_links','social registration links'),
      ('tc_class_registrations','registrations from those links')
    ) as v(n, why)
  loop
    kind := 'table'; name := t.n; needed_for := t.why;
    present := to_regclass('public.' || t.n) is not null;
    return next;
  end loop;

  for t in
    select * from (values
      ('tc_class_link_get','open a share link'),
      ('tc_class_register','public registration'),
      ('tc_class_links_my','staff link list'),
      ('tc_class_regs_for','staff registrations list'),
      ('tc_class_reg_status','update a registration'),
      ('tc_class_link_set_status','open / close a link')
    ) as v(n, why)
  loop
    kind := 'function'; name := t.n; needed_for := t.why;
    present := exists (select 1 from pg_proc p
                        join pg_namespace ns on ns.oid = p.pronamespace
                       where ns.nspname = 'public' and p.proname = t.n);
    return next;
  end loop;

  for t in
    select * from (values
      ('tc_class_links','code','short code in the URL'),
      ('tc_class_links','kind','paid or free'),
      ('tc_class_links','price','fee / free'),
      ('tc_class_links','status','open / closed / archived'),
      ('tc_class_links','uses','usage counter'),
      ('tc_class_registrations','reg_no','registration number'),
      ('tc_class_registrations','status','funnel status')
    ) as v(tbl, col, why)
  loop
    kind := 'column'; name := t.tbl || '.' || t.col; needed_for := t.why;
    present := exists (select 1 from information_schema.columns c
                        where c.table_schema = 'public' and c.table_name = t.tbl
                          and c.column_name = t.col);
    return next;
  end loop;
end $$;

revoke all on function public.tc_v29_check() from public;
grant execute on function public.tc_v29_check() to authenticated;

-- tc_schema_ok() now checks V26 + V27 + V28 + V29 together.
create or replace function public.tc_schema_ok()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when count(*) filter (where not present) = 0
      then 'Schema complete \u2705 — ' || count(*)::text || ' objects checked, none missing.'
    else 'Schema INCOMPLETE \u274c — missing: ' ||
         string_agg(kind || ' ' || name, ', ') filter (where not present)
  end
  from (
    select * from public.tc_schema_selftest()
    union all
    select * from public.tc_v27_check()
    union all
    select * from public.tc_v28_check()
    union all
    select * from public.tc_v29_check()
  ) t;
$$;

revoke all on function public.tc_schema_ok() from public;
grant execute on function public.tc_schema_ok() to authenticated;

select 'V29 installed and self-test extended' as status;
