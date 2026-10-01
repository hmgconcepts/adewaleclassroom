-- =====================================================================
-- V43 ENGAGEMENT COHORTS + PER-CLASS LIBRARY + PHYSICAL HOMEWORK
--        + ENTERPRISE BLOG LAYER (subscribers, reactions, comments)
--
-- Blueprint: School Connect / GOSA (HMG Concepts). Teachers attach work
-- to a class; every student in that class sees it on their dashboard;
-- students in another class never do; a teacher cannot edit another
-- teacher's work.
--
-- Safe to re-run. Every statement is idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENGAGEMENT KIND: add 'cohort'
--    A cohort is a whole class / year arm (e.g. "JSS 2 Gold — 2026"):
--    bigger than a group, used for school-wide CBT sittings, class
--    libraries and cohort homework. Existing kinds are untouched.
-- ---------------------------------------------------------------------
do $$
declare
  c text;
begin
  -- drop ANY check constraint that currently limits engagements.kind
  for c in
    select conname from pg_constraint
     where conrelid = 'public.engagements'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.engagements drop constraint if exists %I', c);
  end loop;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.engagements'::regclass
       and conname = 'engagements_kind_check'
  ) then
    alter table public.engagements
      add constraint engagements_kind_check
      check (kind in ('one_on_one','group','cohort'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. PER-CLASS LIBRARY. library_items / eresources gain an engagement
--    target + an owning tutor. Untargeted items stay a studio-wide
--    catalogue (staff + public). Targeted items are visible ONLY to
--    members of that engagement — via tc_my_work() (students) and the
--    scoped SELECT policy below (signed-in students).
-- ---------------------------------------------------------------------
alter table if exists public.library_items
  add column if not exists engagement_id uuid references public.engagements(id) on delete set null,
  add column if not exists tutor_id uuid references public.tutors(id) on delete set null;
alter table if exists public.eresources
  add column if not exists engagement_id uuid references public.engagements(id) on delete set null,
  add column if not exists tutor_id uuid references public.tutors(id) on delete set null;

create index if not exists library_items_engagement_idx
  on public.library_items (engagement_id) where engagement_id is not null;
create index if not exists eresources_engagement_idx
  on public.eresources (engagement_id) where engagement_id is not null;

-- Stamp the owning tutor on insert (same pattern as tc_stamp_exam_author).
create or replace function public.tc_stamp_library_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tutor_id is null then new.tutor_id := public.tc_my_tutor_id(); end if;
  return new;
end $$;

drop trigger if exists tc_stamp_library_author_trg on public.library_items;
create trigger tc_stamp_library_author_trg
  before insert on public.library_items
  for each row execute function public.tc_stamp_library_author();

drop trigger if exists tc_stamp_eresource_author_trg on public.eresources;
create trigger tc_stamp_eresource_author_trg
  before insert on public.eresources
  for each row execute function public.tc_stamp_library_author();

-- Ownership rules on the library ("no teacher edits another teacher's work"):
--   read     : staff always; anyone (incl. anon) sees only UNTARGETED items;
--              a signed-in student also sees items aimed at their engagements
--   write    : staff insert; update/delete only by the owner (or admin,
--              or the engagement's own tutor, or legacy unowned rows)
drop policy if exists library_items_admin on public.library_items;
drop policy if exists eresources_admin on public.eresources;
drop policy if exists library_read on public.library_items;
drop policy if exists eres_read on public.eresources;

create policy library_items_read on public.library_items for select using (
  public.is_admin() or public.is_tutor()
  or engagement_id is null
  or exists (
    select 1
      from public.engagement_members em
      join public.learners l on l.id = em.learner_id
     where em.engagement_id = library_items.engagement_id
       and coalesce(em.status, 'active') = 'active'
       and l.user_id = auth.uid()
  )
);
create policy eresources_read on public.eresources for select using (
  public.is_admin() or public.is_tutor()
  or engagement_id is null
  or exists (
    select 1
      from public.engagement_members em
      join public.learners l on l.id = em.learner_id
     where em.engagement_id = eresources.engagement_id
       and coalesce(em.status, 'active') = 'active'
       and l.user_id = auth.uid()
  )
);
create policy library_items_insert on public.library_items for insert with check (public.is_admin() or public.is_tutor());
create policy library_items_update on public.library_items for update using (
  public.is_admin()
  or tutor_id is null                                  -- legacy / studio-shared rows
  or tutor_id = public.tc_my_tutor_id()
  or exists (select 1 from public.engagements e where e.id = library_items.engagement_id and e.tutor_id = public.tc_my_tutor_id())
);
create policy library_items_delete on public.library_items for delete using (
  public.is_admin()
  or tutor_id is null
  or tutor_id = public.tc_my_tutor_id()
  or exists (select 1 from public.engagements e where e.id = library_items.engagement_id and e.tutor_id = public.tc_my_tutor_id())
);
create policy eresources_insert on public.eresources for insert with check (public.is_admin() or public.is_tutor());
create policy eresources_update on public.eresources for update using (
  public.is_admin()
  or tutor_id is null
  or tutor_id = public.tc_my_tutor_id()
  or exists (select 1 from public.engagements e where e.id = eresources.engagement_id and e.tutor_id = public.tc_my_tutor_id())
);
create policy eresources_delete on public.eresources for delete using (
  public.is_admin()
  or tutor_id is null
  or tutor_id = public.tc_my_tutor_id()
  or exists (select 1 from public.engagements e where e.id = eresources.engagement_id and e.tutor_id = public.tc_my_tutor_id())
);

grant select on public.library_items, public.eresources to anon;

-- ---------------------------------------------------------------------
-- 3. PHYSICAL ASSIGNMENTS. mode = 'digital' (submit a link) or
--    'physical' (hand in on paper — teacher records the score only).
-- ---------------------------------------------------------------------
alter table if exists public.assignments
  add column if not exists mode text not null default 'digital';
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.assignments'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%mode%'
  loop
    execute format('alter table public.assignments drop constraint if exists %I', c);
  end loop;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.assignments'::regclass
       and conname = 'assignments_mode_check'
  ) then
    alter table public.assignments
      add constraint assignments_mode_check check (mode in ('digital','physical'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. WORK BOARD v2 (tc_my_work): adds the class LIBRARY section,
--    homework delivery mode, and the engagement kind label. Same
--    security model as before (security definer + family checks).
-- ---------------------------------------------------------------------
create or replace function public.tc_my_work(p_learner_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_learner_id uuid := p_learner_id;
  v_me public.learners%rowtype;
  v_eng_ids uuid[];
  v_out jsonb;
begin
  if v_learner_id is null then
    select l.* into v_me from public.learners l where l.user_id = auth.uid() limit 1;
  else
    if not public.is_family_of_learner(v_learner_id) and not public.tc_is_manager() then
      return jsonb_build_object('ok', false, 'reason', 'not_your_child');
    end if;
    select l.* into v_me from public.learners l where l.id = v_learner_id limit 1;
  end if;
  if v_me.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_learner_record');
  end if;

  select coalesce(array_agg(em.engagement_id), '{}') into v_eng_ids
    from public.engagement_members em
   where em.learner_id = v_me.id
     and coalesce(em.status, 'active') = 'active';

  select jsonb_build_object(
    'ok', true,
    'learner', jsonb_build_object('id', v_me.id, 'name', v_me.full_name, 'year', v_me.year_group),
    'engagements', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', e.id, 'name', e.name, 'subject', e.subject, 'kind', e.kind) order by e.name), '[]'::jsonb)
                      from public.engagements e
                     where e.id = any(v_eng_ids) and coalesce(e.status,'active') = 'active'),
    'homework', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', a.id, 'title', a.title, 'due', a.due_on, 'status', a.status,
                    'score', a.score, 'max', a.max_score, 'mode', coalesce(a.mode, 'digital'),
                    'group', a.learner_id is null,
                    'engagement', (select e.name from public.engagements e where e.id = a.engagement_id)
                  ) order by a.due_on nulls last, a.created_at desc), '[]'::jsonb)
                  from public.assignments a
                 where (a.engagement_id = any(v_eng_ids) or a.learner_id = v_me.id)
                   and (a.learner_id is null or a.learner_id = v_me.id)),
    'reading', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', r.id, 'title', r.title, 'due', r.due_on, 'status', r.status,
                    'engagement', (select e.name from public.engagements e where e.id = r.engagement_id)
                  ) order by r.due_on nulls last, r.created_at desc), '[]'::jsonb)
                  from public.reading_assignments r
                 where r.engagement_id = any(v_eng_ids)),
    'library', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', x.id, 'title', x.title, 'url', x.url, 'kind', x.kind,
                    'subject', x.subject, 'source', 'library',
                    'engagement', (select e.name from public.engagements e where e.id = x.engagement_id)
                  ) order by x.created_at desc), '[]'::jsonb)
                  from public.library_items x
                 where x.engagement_id = any(v_eng_ids)),
    'resources', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', r.id, 'title', r.title, 'url', r.url, 'notes', r.notes,
                    'subject', r.subject, 'source', 'eresource',
                    'engagement', (select e.name from public.engagements e where e.id = r.engagement_id)
                  ) order by r.created_at desc), '[]'::jsonb)
                  from public.eresources r
                 where r.engagement_id = any(v_eng_ids)),
    'exams', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', x.id, 'code', x.code, 'title', x.title, 'minutes', x.duration_min,
                    'kind', x.quiz_kind, 'subject', x.subject
                  ) order by x.created_at desc), '[]'::jsonb)
                  from public.cbt_exams x
                 where x.engagement_id = any(v_eng_ids)
                   and (lower(coalesce(x.status, 'draft')) in ('published','live','open')
                        or coalesce(x.is_open, false))),
    'next_class', (select jsonb_build_object(
                      'starts', s.starts_at,
                      'engagement', (select e.name from public.engagements e where e.id = s.engagement_id),
                      'url', s.meeting_url)
                     from public.sessions s
                    where s.engagement_id = any(v_eng_ids)
                      and s.starts_at >= now()
                      and coalesce(s.status, 'scheduled') = 'scheduled'
                    order by s.starts_at limit 1)
  ) into v_out;
  return v_out;
end $$;

grant execute on function public.tc_my_work(uuid) to authenticated;
revoke all on function public.tc_my_work(uuid) from public, anon;

-- ---------------------------------------------------------------------
-- 5. BLOG — enterprise layer (Ghost / Substack / Medium parity on the
--    free tier: no email service, no storage, no edge functions).
-- ---------------------------------------------------------------------
alter table if exists public.tc_blog_posts
  add column if not exists pinned boolean not null default false;

-- 5a. Newsletter subscribers (Substack-style). Write via RPC only.
create table if not exists public.tc_blog_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active' check (status in ('active','unsubscribed')),
  created_at timestamptz default now()
);
alter table public.tc_blog_subscribers enable row level security;
-- no table policies at all: direct access denied to every role; the RPCs below are the only doors.

create or replace function public.tc_blog_subscribe(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~ '^[a-z0-9][^@]*@[^@]+\.[a-z]{2,}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email');
  end if;
  insert into public.tc_blog_subscribers (email) values (v_email)
  on conflict (email) do update set status = 'active';
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.tc_blog_subscribe(text) to anon, authenticated;
revoke all on function public.tc_blog_subscribe(text) from public;

-- 5b. Reactions (Medium-style applause, spam-proof: one per visitor per kind).
create table if not exists public.tc_blog_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.tc_blog_posts(id) on delete cascade,
  reaction text not null check (reaction in ('like','clap','insight')),
  visitor text not null,
  created_at timestamptz default now(),
  unique (post_id, visitor, reaction)
);
alter table public.tc_blog_reactions enable row level security;

create or replace function public.tc_blog_react(p_slug text, p_reaction text, p_visitor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.tc_blog_posts%rowtype;
  v_visitor text := left(md5(coalesce(p_visitor, '') || '|' || coalesce(inet_client_addr()::text, 'local')), 40);
begin
  select * into v_post from public.tc_blog_posts
   where slug = p_slug and status = 'published';
  if v_post.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if p_reaction not in ('like','clap','insight') then
    return jsonb_build_object('ok', false, 'reason', 'bad_reaction');
  end if;
  insert into public.tc_blog_reactions (post_id, reaction, visitor)
  values (v_post.id, p_reaction, v_visitor)
  on conflict (post_id, visitor, reaction) do nothing;
  return jsonb_build_object(
    'ok', true,
    'counts', (select jsonb_build_object(
                 'like',    count(*) filter (where reaction = 'like'),
                 'clap',    count(*) filter (where reaction = 'clap'),
                 'insight', count(*) filter (where reaction = 'insight'))
                 from public.tc_blog_reactions where post_id = v_post.id)
  );
end $$;
grant execute on function public.tc_blog_react(text, text, text) to anon, authenticated;
revoke all on function public.tc_blog_react(text, text, text) from public;

-- 5c. Comments (authenticated readers; staff moderate through the table).
create table if not exists public.tc_blog_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.tc_blog_posts(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null default 'Reader',
  body text not null,
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz default now()
);
alter table public.tc_blog_comments enable row level security;
create index if not exists tc_blog_comments_post_idx on public.tc_blog_comments (post_id, created_at desc);

create policy tc_blog_comments_read on public.tc_blog_comments for select using (status = 'visible');
create policy tc_blog_comments_staff on public.tc_blog_comments for all
  using (public.is_admin() or public.is_tutor())
  with check (public.is_admin() or public.is_tutor());

create or replace function public.tc_blog_comment_add(p_slug text, p_name text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post public.tc_blog_posts%rowtype;
  v_name text := left(btrim(coalesce(p_name, '')), 60);
  v_body text := left(btrim(coalesce(p_body, '')), 2000);
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'sign_in_required');
  end if;
  select * into v_post from public.tc_blog_posts
   where slug = p_slug and status = 'published';
  if v_post.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_body = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty_body');
  end if;
  if v_name = '' then
    select coalesce(full_name, email, 'Reader') into v_name from public.profiles where id = auth.uid();
  end if;
  insert into public.tc_blog_comments (post_id, author_id, author_name, body)
  values (v_post.id, auth.uid(), v_name, v_body);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.tc_blog_comment_add(text, text, text) to authenticated;
revoke all on function public.tc_blog_comment_add(text, text, text) from public, anon;

-- 5d. Public list/get: scheduled publishing (future published_at stays
--     hidden), pinned-first ordering, reading time, ids for reactions.
create or replace function public.tc_blog_list(p_category text default null, p_q text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by (x->>'pinned')::boolean desc nulls last, x->>'published_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', b.id, 'slug', b.slug, 'title', b.title,
               'excerpt', b.excerpt, 'cover_url', b.cover_url,
               'tags', b.tags, 'author_name', coalesce(b.author_name, 'The Studio'),
               'category', c.name, 'published_at', b.published_at,
               'view_count', b.view_count, 'pinned', b.pinned,
               'read_min', greatest(1, round(length(b.body) / 950.0))
             ) as x
        from public.tc_blog_posts b
        left join public.tc_blog_categories c on c.id = b.category_id
       where b.status = 'published'
         and coalesce(b.published_at, now()) <= now()
         and (p_category is null or c.slug = p_category)
         and (p_q is null or b.title ilike '%' || p_q || '%'
                           or b.excerpt ilike '%' || p_q || '%'
                           or coalesce(b.tags, '') ilike '%' || p_q || '%')
    ) s;
$$;
revoke all on function public.tc_blog_list(text, text) from public, anon;
grant execute on function public.tc_blog_list(text, text) to anon, authenticated;

create or replace function public.tc_blog_get(p_slug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select jsonb_build_object(
           'id', b.id, 'slug', b.slug, 'title', b.title,
           'excerpt', b.excerpt, 'body', b.body, 'cover_url', b.cover_url,
           'tags', b.tags, 'seo_description', b.seo_description,
           'author_name', coalesce(b.author_name, 'The Studio'),
           'category', c.name, 'category_slug', c.slug,
           'published_at', b.published_at, 'updated_at', b.updated_at,
           'view_count', b.view_count, 'pinned', b.pinned,
           'read_min', greatest(1, round(length(b.body) / 950.0))
    ) into v
    from public.tc_blog_posts b
    left join public.tc_blog_categories c on c.id = b.category_id
   where b.slug = p_slug and b.status = 'published'
     and coalesce(b.published_at, now()) <= now();

  if v is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  update public.tc_blog_posts set view_count = view_count + 1
   where slug = p_slug and coalesce(published_at, now()) <= now();
  return jsonb_build_object('ok', true, 'post', v);
end $$;
revoke all on function public.tc_blog_get(text) from public, anon;
grant execute on function public.tc_blog_get(text) to anon, authenticated;

-- 5e. Staff dashboard numbers (includes subscribers, reactions, comments).
create or replace function public.tc_blog_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_tutor()) then
    return jsonb_build_object('ok', false, 'reason', 'staff_only');
  end if;
  return jsonb_build_object(
    'ok', true,
    'posts', (select count(*) from public.tc_blog_posts),
    'published', (select count(*) from public.tc_blog_posts
                   where status = 'published' and coalesce(published_at, now()) <= now()),
    'scheduled', (select count(*) from public.tc_blog_posts
                   where status = 'published' and published_at > now()),
    'drafts', (select count(*) from public.tc_blog_posts where status = 'draft'),
    'views', (select coalesce(sum(view_count), 0) from public.tc_blog_posts),
    'subscribers', (select count(*) from public.tc_blog_subscribers where status = 'active'),
    'comments', (select count(*) from public.tc_blog_comments where status = 'visible'),
    'reactions', (select count(*) from public.tc_blog_reactions),
    'top_posts', (select coalesce(jsonb_agg(jsonb_build_object(
                    'title', t.title, 'slug', t.slug, 'views', t.view_count) order by t.view_count desc), '[]'::jsonb)
                    from (select title, slug, view_count from public.tc_blog_posts
                           where status = 'published' order by view_count desc limit 5) t)
  );
end $$;
grant execute on function public.tc_blog_stats() to authenticated;
revoke all on function public.tc_blog_stats() from public, anon;

-- Staff post list now carries pinned + scheduled state.
create or replace function public.tc_blog_my_posts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by (x->>'pinned')::boolean desc nulls last, x->>'created_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', b.id, 'slug', b.slug, 'title', b.title,
               'status', b.status, 'published_at', b.published_at,
               'category', c.name, 'created_at', b.created_at,
               'author_name', coalesce(b.author_name, 'The Studio'),
               'view_count', b.view_count, 'pinned', b.pinned,
               'scheduled', (b.status = 'published' and b.published_at > now()),
               'read_min', greatest(1, round(length(b.body) / 950.0))
             ) as x
        from public.tc_blog_posts b
        left join public.tc_blog_categories c on c.id = b.category_id
       where public.tc_is_manager()
          or b.author_id = public.tc_my_tutor_id()
    ) s;
$$;

-- ---------------------------------------------------------------------
-- 6. Roster helpers for the engagement console (seamless assignment).
--    Bulk add/remove members with one RPC call, respecting tutor scope.
-- ---------------------------------------------------------------------
create or replace function public.tc_roster_bulk(p_engagement_id uuid, p_learner_ids uuid[], p_action text default 'add')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eng public.engagements%rowtype;
  v_added int := 0; v_removed int := 0; v_id uuid;
begin
  select * into v_eng from public.engagements where id = p_engagement_id;
  if v_eng.id is null then
    return jsonb_build_object('ok', false, 'reason', 'engagement_not_found');
  end if;
  if not public.tc_is_manager() then
    if not exists (select 1 from public.engagements e
                    where e.id = p_engagement_id
                      and (e.tutor_id = public.tc_my_tutor_id() or e.tutor_id is null)) then
      return jsonb_build_object('ok', false, 'reason', 'not_your_engagement');
    end if;
  end if;
  if p_action = 'add' then
    foreach v_id in array coalesce(p_learner_ids, '{}') loop
      insert into public.engagement_members (engagement_id, learner_id)
      values (p_engagement_id, v_id)
      on conflict (engagement_id, learner_id)
      do update set status = 'active';
      v_added := v_added + 1;
    end loop;
  elsif p_action = 'remove' then
    foreach v_id in array coalesce(p_learner_ids, '{}') loop
      update public.engagement_members
         set status = 'left'
       where engagement_id = p_engagement_id and learner_id = v_id;
      v_removed := v_removed + 1;
    end loop;
  else
    return jsonb_build_object('ok', false, 'reason', 'bad_action');
  end if;
  return jsonb_build_object('ok', true, 'added', v_added, 'removed', v_removed,
    'members', (select count(*) from public.engagement_members
                 where engagement_id = p_engagement_id and coalesce(status,'active') = 'active'));
end $$;
grant execute on function public.tc_roster_bulk(uuid, uuid[], text) to authenticated;
revoke all on function public.tc_roster_bulk(uuid, uuid[], text) from public, anon;

-- Roster view for the console: engagement + members in one call (tutor-scoped).
create or replace function public.tc_roster_view(p_engagement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_eng public.engagements%rowtype;
begin
  select * into v_eng from public.engagements where id = p_engagement_id;
  if v_eng.id is null then
    return jsonb_build_object('ok', false, 'reason', 'engagement_not_found');
  end if;
  if not public.tc_is_manager() then
    if not exists (select 1 from public.engagements e
                    where e.id = p_engagement_id
                      and (e.tutor_id = public.tc_my_tutor_id() or e.tutor_id is null)) then
      return jsonb_build_object('ok', false, 'reason', 'not_your_engagement');
    end if;
  end if;
  return jsonb_build_object(
    'ok', true,
    'engagement', jsonb_build_object('id', v_eng.id, 'name', v_eng.name, 'kind', v_eng.kind,
                                     'subject', v_eng.subject, 'capacity', v_eng.capacity),
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
                  'learner_id', em.learner_id, 'name', l.full_name, 'student_no', l.student_no,
                  'status', em.status, 'joined_on', em.joined_on) order by l.full_name), '[]'::jsonb)
                  from public.engagement_members em
                  join public.learners l on l.id = em.learner_id
                 where em.engagement_id = p_engagement_id
                   and coalesce(em.status, 'active') = 'active')
  );
end $$;
grant execute on function public.tc_roster_view(uuid) to authenticated;
revoke all on function public.tc_roster_view(uuid) from public, anon;

notify pgrst, 'reload schema';

select 'V43 engagement cohorts + per-class library + physical homework + blog enterprise layer installed ✅' as status;
