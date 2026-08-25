-- ===========================================================================
-- TUTORING CONNECT — V27
-- ---------------------------------------------------------------------------
-- 1.  RLS infinite-recursion fix (reported on: payments, invoices, payment
--     plans, value-added, predicted grades, progress reports, at-risk board,
--     group insights, insights lab, learner 360, family links, parents page).
-- 2.  Public blog engine (staff write, public read).
-- 3.  Custom Document Builder columns on `documents` + token renderer.
-- 4.  Contracts & Consent register with family read-back of signed copies.
-- 5.  Account-linking RPCs (sign-in -> learner / parent / tutor record).
-- 6.  V27 self-test rows added through tc_v27_check().
-- ---------------------------------------------------------------------------
-- Safe to re-run: every statement is idempotent (create or replace,
-- drop policy if exists, alter ... add column if not exists).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS INFINITE RECURSION — ROOT CAUSE AND FIX
-- ---------------------------------------------------------------------------
-- The old policies had a cycle:
--
--     policy on parents         reads parent_learner   (inline subquery)
--     policy on parent_learner  reads parents          (inline subquery)
--
-- PostgreSQL evaluates a policy's USING expression under RLS, so reading
-- parent_learner from inside the parents policy applied the parent_learner
-- policy, which read parents again… until the server gave up with:
--
--     infinite recursion detected in policy for relation "parents"
--     infinite recursion detected in policy for relation "parent_learner"
--
-- Every downstream policy that touched either table in an inline subquery
-- (payments, invoices, payment plans, the insight desks, progress reports…)
-- inherited the crash, which is why one fix had to be at the two source
-- policies, not at each report.
--
-- The fix is the standard Supabase pattern: move the cross-table reads into
-- SECURITY DEFINER helper functions (they run as the table owner, bypassing
-- RLS), so a policy never re-enters RLS on the other table.
-- ---------------------------------------------------------------------------

-- A parent record whose user_id matches the signed-in user.
create or replace function public.tc_parent_matches_uid(p_parent uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_parent is not null
     and exists (select 1 from public.parents p
                  where p.id = p_parent and p.user_id = auth.uid());
$$;

revoke all on function public.tc_parent_matches_uid(uuid) from public, anon;
grant execute on function public.tc_parent_matches_uid(uuid) to authenticated;

-- A parent who has at least one child the signed-in tutor teaches.
create or replace function public.tc_tutor_covers_parent(p_parent uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_parent is not null
     and exists (select 1 from public.parent_learner pl
                  where pl.parent_id = p_parent
                    and public.tc_teaches_learner(pl.learner_id));
$$;

revoke all on function public.tc_tutor_covers_parent(uuid) from public, anon;
grant execute on function public.tc_tutor_covers_parent(uuid) to authenticated;

-- One predicate for "this person may see this learner": a manager, the
-- teaching tutor, the learner themself, or the learner's own parent.
create or replace function public.tc_family_can_see_learner(p_learner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_learner is not null and (
      public.tc_is_manager()
      or public.tc_teaches_learner(p_learner)
      or exists (select 1 from public.learners l
                  where l.id = p_learner and l.user_id = auth.uid())
      or exists (select 1 from public.parent_learner pl
                  join public.parents p on p.id = pl.parent_id
                 where pl.learner_id = p_learner and p.user_id = auth.uid())
  );
$$;

revoke all on function public.tc_family_can_see_learner(uuid) from public, anon;
grant execute on function public.tc_family_can_see_learner(uuid) to authenticated;

-- Rebuild the two source policies WITHOUT the inline cross-table subqueries.
do $$
begin
  if to_regclass('public.parents') is not null then
    alter table public.parents enable row level security;
    drop policy if exists parents_tutor_scope on public.parents;
    create policy parents_tutor_scope on public.parents
      for all to authenticated
      using (
        public.tc_is_manager()
        or user_id = auth.uid()
        or public.tc_tutor_covers_parent(id)
      )
      with check (public.tc_is_manager());
  end if;

  if to_regclass('public.parent_learner') is not null then
    alter table public.parent_learner enable row level security;
    drop policy if exists parent_learner_tutor_scope on public.parent_learner;
    create policy parent_learner_tutor_scope on public.parent_learner
      for all to authenticated
      using (
        public.tc_is_manager()
        or public.tc_teaches_learner(learner_id)
        or public.tc_parent_matches_uid(parent_id)
      )
      with check (public.tc_is_manager());
  end if;
end $$;

-- The family-facing money policies that used inline `parents` subqueries.
-- They were safe once the source policies were fixed, but the helper is
-- cleaner and removes the RLS re-entry entirely.
do $$
begin
  if to_regclass('public.account_credits') is not null then
    drop policy if exists account_credits_family on public.account_credits;
    create policy account_credits_family on public.account_credits
      for select to authenticated
      using (public.tc_parent_matches_uid(parent_id));
  end if;

  if to_regclass('public.payment_plans') is not null then
    drop policy if exists payment_plans_family on public.payment_plans;
    create policy payment_plans_family on public.payment_plans
      for select to authenticated
      using (public.tc_parent_matches_uid(parent_id));
  end if;

  if to_regclass('public.payment_plan_items') is not null then
    drop policy if exists payment_plan_items_family on public.payment_plan_items;
    create policy payment_plan_items_family on public.payment_plan_items
      for select to authenticated
      using (exists (select 1 from public.payment_plans pp
                      where pp.id = plan_id
                        and public.tc_parent_matches_uid(pp.parent_id)));
  end if;
end $$;

-- The five insight / report desks that inline-queried parent_learner+parents
-- in their read policies. Same pattern: one SECURITY DEFINER predicate.
do $$
declare t text;
begin
  foreach t in array array[
    'tc_at_risk_reviews', 'tc_practice_analytics', 'tc_value_added',
    'tc_predicted_grades', 'tc_progress_reports', 'tc_group_insights',
    'tc_insight_notes', 'tc_timezone_desk'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format($f$
        drop policy if exists %I on public.%I;
        create policy %I on public.%I for select to authenticated
        using (public.tc_family_can_see_learner(learner_id))
      $f$, t || '_read', t, t || '_read', t);
    end if;
  end loop;
end $$;

select 'V27 RLS recursion fix installed' as status;

-- ===========================================================================
-- 2. PUBLIC BLOG ENGINE  (report item 40)
-- ---------------------------------------------------------------------------
-- The studio writes posts; anyone on the internet reads published ones.
-- No uploads: cover art is a Drive / web link, never a file. Slug drives a
-- shareable public URL (blog-post.html?slug=...).
-- ===========================================================================
create table if not exists public.tc_blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz default now()
);

create table if not exists public.tc_blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text not null,
  category_id uuid references public.tc_blog_categories(id) on delete set null,
  cover_url text,
  tags text,
  seo_description text,
  author_id uuid references public.tutors(id) on delete set null,
  author_name text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  view_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tc_blog_posts_published_idx
  on public.tc_blog_posts (published_at desc) where status = 'published';
create index if not exists tc_blog_posts_slug_idx
  on public.tc_blog_posts (slug);

alter table public.tc_blog_posts enable row level security;
alter table public.tc_blog_categories enable row level security;

-- Staff write, everyone reads what is published.
drop policy if exists tc_blog_posts_staff on public.tc_blog_posts;
create policy tc_blog_posts_staff on public.tc_blog_posts
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

drop policy if exists tc_blog_posts_public on public.tc_blog_posts;
create policy tc_blog_posts_public on public.tc_blog_posts
  for select to anon, authenticated
  using (status = 'published');

drop policy if exists tc_blog_categories_staff on public.tc_blog_categories;
create policy tc_blog_categories_staff on public.tc_blog_categories
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

drop policy if exists tc_blog_categories_public on public.tc_blog_categories;
create policy tc_blog_categories_public on public.tc_blog_categories
  for select to anon, authenticated using (true);

-- A stable slug if the author left it blank.
create or replace function public.tc_blog_slugify(p_title text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(regexp_replace(
           lower(p_title), '[^a-z0-9]+', '-', 'g'), ''), 'post')
         || '-' || substr(md5(random()::text), 1, 6);
$$;

revoke all on function public.tc_blog_slugify(text) from public;

-- The public list: newest first, published only, with category + author names.
create or replace function public.tc_blog_list(p_category text default null, p_q text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'published_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', b.id, 'slug', b.slug, 'title', b.title,
               'excerpt', b.excerpt, 'cover_url', b.cover_url,
               'tags', b.tags, 'author_name', coalesce(b.author_name, 'The Studio'),
               'category', c.name, 'published_at', b.published_at,
               'view_count', b.view_count
             ) as x
        from public.tc_blog_posts b
        left join public.tc_blog_categories c on c.id = b.category_id
       where b.status = 'published'
         and (p_category is null or c.slug = p_category)
         and (p_q is null or b.title ilike '%' || p_q || '%'
                           or b.excerpt ilike '%' || p_q || '%'
                           or coalesce(b.tags, '') ilike '%' || p_q || '%')
    ) s;
$$;

revoke all on function public.tc_blog_list(text, text) from public, anon;
grant execute on function public.tc_blog_list(text, text) to anon, authenticated;

-- One post by slug; bumps the view counter once per open.
create or replace function public.tc_blog_get(p_slug text)
returns jsonb
language plpgsql
stable
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
           'category', c.name, 'published_at', b.published_at,
           'updated_at', b.updated_at, 'view_count', b.view_count)
    into v
    from public.tc_blog_posts b
    left join public.tc_blog_categories c on c.id = b.category_id
   where b.slug = p_slug and b.status = 'published';

  if v is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  update public.tc_blog_posts set view_count = view_count + 1 where slug = p_slug;
  return jsonb_build_object('ok', true, 'post', v);
end $$;

revoke all on function public.tc_blog_get(text) from public, anon;
grant execute on function public.tc_blog_get(text) to anon, authenticated;

-- Staff editor list: everything, including drafts, with the author's tutor id.
create or replace function public.tc_blog_my_posts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', b.id, 'slug', b.slug, 'title', b.title,
               'status', b.status, 'published_at', b.published_at,
               'category', c.name, 'created_at', b.created_at,
               'author_name', coalesce(b.author_name, 'The Studio'),
               'view_count', b.view_count
             ) as x
        from public.tc_blog_posts b
        left join public.tc_blog_categories c on c.id = b.category_id
       where public.tc_is_manager()
          or b.author_id = public.tc_my_tutor_id()
    ) s;
$$;

revoke all on function public.tc_blog_my_posts() from public, anon;
grant execute on function public.tc_blog_my_posts() to authenticated;

-- Publish / unpublish / archive in one call.
create or replace function public.tc_blog_set_status(p_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('draft','published','archived') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;
  if not (public.tc_is_manager() or public.tc_my_tutor_id() = (select author_id from public.tc_blog_posts where id = p_id)) then
    return jsonb_build_object('ok', false, 'reason', 'not_your_post');
  end if;
  update public.tc_blog_posts
     set status = p_status,
         published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
         updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.tc_blog_set_status(uuid, text) from public, anon;
grant execute on function public.tc_blog_set_status(uuid, text) to authenticated;

select 'V27 blog engine installed' as status;

-- ===========================================================================
-- 3. CUSTOM DOCUMENT BUILDER  (report item 7)
-- ---------------------------------------------------------------------------
-- Upgrades the existing `documents` table into a publishing engine: preset
-- types (bonafide, hall ticket, recommendation, transfer, testimonial,
-- invitation, fee clearance, admission, appointment, memorandum, certificate,
-- custom), tokenised body text, official signatory, and a renderer that fills
-- the tokens before print / PDF.
-- ===========================================================================
do $$
declare c text;
begin
  foreach c in array array[
    'doc_type text',
    'custom_type text',
    'reference text',
    'recipient_name text',
    'body text',
    'signatory_role text',
    'signatory_name text',
    'learner_id uuid',
    'version int',
    'effective_on date',
    'issued_on date',
    'updated_at timestamptz'
  ] loop
    execute format('alter table if exists public.documents add column if not exists %s', c);
  end loop;
end $$;

alter table public.documents enable row level security;

drop policy if exists documents_staff on public.documents;
create policy documents_staff on public.documents
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

-- A family may read documents issued to their own children.
drop policy if exists documents_family on public.documents;
create policy documents_family on public.documents
  for select to authenticated
  using (status in ('issued','final')
         and (learner_id is null or public.tc_family_can_see_learner(learner_id)));

-- Fill the tokens: [NAME] [CLASS] [TERM] [SESSION] [DATE] [REFERENCE]
-- [SCHOOL] [PRINCIPAL] [PROPRIETOR] [EXAM_OFFICER] [SIGNATORY] [TITLE]
create or replace function public.tc_documents_render(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.documents%rowtype;
  v_school text;
  v_body text;
  v_learner_name text := null;
  v_learner_class text := null;
begin
  select * into r from public.documents where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_school := coalesce((select name from public.practice_settings where id = 1),
                       'ADEWALE CLASSROOM');

  if r.learner_id is not null then
    select l.full_name, l.year_group into v_learner_name, v_learner_class
      from public.learners l where l.id = r.learner_id;
  end if;

  v_body := coalesce(r.body, '');
  v_body := replace(v_body, '[NAME]',      coalesce(v_learner_name, coalesce(r.recipient_name, '')));
  v_body := replace(v_body, '[CLASS]',     coalesce(v_learner_class, ''));
  v_body := replace(v_body, '[DATE]',      to_char(current_date, 'DD Month YYYY'));
  v_body := replace(v_body, '[REFERENCE]', coalesce(r.reference, ''));
  v_body := replace(v_body, '[SCHOOL]',    v_school);
  v_body := replace(v_body, '[SIGNATORY]', coalesce(r.signatory_name, ''));
  v_body := replace(v_body, '[TITLE]',     coalesce(r.title, ''));

  return jsonb_build_object(
    'ok', true,
    'title', r.title,
    'doc_type', coalesce(r.doc_type, r.kind),
    'reference', r.reference,
    'recipient', coalesce(v_learner_name, r.recipient_name),
    'signatory_role', r.signatory_role,
    'signatory_name', r.signatory_name,
    'body', v_body,
    'status', r.status,
    'issued_on', r.issued_on);
end $$;

revoke all on function public.tc_documents_render(uuid) from public, anon;
grant execute on function public.tc_documents_render(uuid) to authenticated;

select 'V27 document builder installed' as status;

-- ===========================================================================
-- 4. CONTRACTS & CONSENT  (report item 8)
-- ---------------------------------------------------------------------------
-- A register of agreements and consent records per family. Staff draft and
-- send; the signed copy is read back to the family; nothing is deletable
-- once signed (audit integrity), so the table is append/update-only.
-- ===========================================================================
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'contract' check (kind in ('contract','consent')),
  title text not null,
  body text not null,
  learner_id uuid references public.learners(id) on delete set null,
  parent_name text,
  status text not null default 'draft'
    check (status in ('draft','sent','awaiting_signature','signed','void')),
  signed_on date,
  signed_by_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists contracts_learner_idx on public.contracts (learner_id);
create index if not exists contracts_status_idx on public.contracts (status);

alter table public.contracts enable row level security;

drop policy if exists contracts_staff on public.contracts;
create policy contracts_staff on public.contracts
  for all to authenticated
  using (public.tc_is_manager() or public.tc_my_tutor_id() is not null)
  with check (public.tc_is_manager() or public.tc_my_tutor_id() is not null);

-- A family sees only signed copies relating to their own children.
drop policy if exists contracts_family on public.contracts;
create policy contracts_family on public.contracts
  for select to authenticated
  using (status = 'signed'
         and (learner_id is null or public.tc_family_can_see_learner(learner_id)));

-- The family-facing list of signed documents.
create or replace function public.tc_contracts_for_family()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
               'id', c.id, 'kind', c.kind, 'title', c.title,
               'body', c.body, 'signed_on', c.signed_on,
               'signed_by_name', c.signed_by_name,
               'learner_name', l.full_name, 'created_at', c.created_at
             ) as x
        from public.contracts c
        left join public.learners l on l.id = c.learner_id
       where c.status = 'signed'
         and public.tc_family_can_see_learner(c.learner_id)
    ) s;
$$;

revoke all on function public.tc_contracts_for_family() from public, anon;
grant execute on function public.tc_contracts_for_family() to authenticated;

select 'V27 contracts & consent installed' as status;

-- ===========================================================================
-- 5. ACCOUNT LINKING  (report item 43)
-- ---------------------------------------------------------------------------
-- School Connect / GOSA connect a sign-in to the person's record (student,
-- staff, parent). Tutoring Connect now does the same: profile.html shows the
-- unlinked records that share the signed-in email and offers one-click Link.
-- An admin can also link any record to any account (with audit).
-- ===========================================================================
create or replace function public.tc_unlinked_records()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_uid uuid := auth.uid();
  v jsonb;
begin
  select email into v_email from public.profiles where id = v_uid;
  if v_email is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
    select jsonb_build_object(
             'kind', 'learner', 'id', id, 'full_name', full_name,
             'student_no', student_no, 'email', email)
      from public.learners
     where user_id is null and lower(coalesce(email, '')) = lower(v_email)
    union all
    select jsonb_build_object(
             'kind', 'parent', 'id', id, 'full_name', full_name,
             'email', email)
      from public.parents
     where user_id is null and lower(coalesce(email, '')) = lower(v_email)
    union all
    select jsonb_build_object(
             'kind', 'tutor', 'id', id, 'full_name', full_name,
             'email', email)
      from public.tutors
     where user_id is null and lower(coalesce(email, '')) = lower(v_email)
  ) s;

  return jsonb_build_object('ok', true, 'records', v);
end $$;

revoke all on function public.tc_unlinked_records() from public, anon;
grant execute on function public.tc_unlinked_records() to authenticated;

-- Link a record to the signed-in user. Only when the email matches, or the
-- caller is a manager (admin override for a family that changed emails).
create or replace function public.tc_link_account(p_kind text, p_id uuid, p_uid uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_uid, auth.uid());
  v_email text;
  v_row_email text;
  v_my bool;
begin
  if p_kind not in ('learner','parent','tutor') then
    return jsonb_build_object('ok', false, 'reason', 'bad_kind');
  end if;

  select email into v_email from public.profiles where id = v_uid;

  if p_kind = 'learner' then
    select email into v_row_email from public.learners where id = p_id;
    v_my := (lower(coalesce(v_row_email,'')) = lower(coalesce(v_email,'')));
  elsif p_kind = 'parent' then
    select email into v_row_email from public.parents where id = p_id;
    v_my := (lower(coalesce(v_row_email,'')) = lower(coalesce(v_email,'')));
  else
    select email into v_row_email from public.tutors where id = p_id;
    v_my := (lower(coalesce(v_row_email,'')) = lower(coalesce(v_email,'')));
  end if;

  if not (v_my or public.tc_is_manager()) then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  end if;

  if p_kind = 'learner' then
    update public.learners set user_id = v_uid where id = p_id;
  elsif p_kind = 'parent' then
    update public.parents set user_id = v_uid where id = p_id;
  else
    update public.tutors set user_id = v_uid where id = p_id;
  end if;

  return jsonb_build_object('ok', true, 'linked', p_kind);
end $$;

revoke all on function public.tc_link_account(text, uuid, uuid) from public, anon;
grant execute on function public.tc_link_account(text, uuid, uuid) to authenticated;

select 'V27 account linking installed' as status;

-- ===========================================================================
-- 6. V27 SELF-TEST
-- ---------------------------------------------------------------------------
-- tc_schema_ok() now checks the V26 selftest PLUS these V27 objects.
-- ===========================================================================
create or replace function public.tc_v27_check()
returns table (kind text, name text, present boolean, needed_for text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t record;
begin
  for t in
    select * from (values
      ('tc_blog_posts','public blog posts'),
      ('tc_blog_categories','blog categories'),
      ('contracts','contracts & consent register')
    ) as v(n, why)
  loop
    kind := 'table'; name := t.n; needed_for := t.why;
    present := to_regclass('public.' || t.n) is not null;
    return next;
  end loop;

  for t in
    select * from (values
      ('tc_parent_matches_uid','RLS recursion fix (parents)'),
      ('tc_tutor_covers_parent','RLS recursion fix (parent scope)'),
      ('tc_family_can_see_learner','RLS recursion fix (insight desks)'),
      ('tc_blog_list','public blog list'),
      ('tc_blog_get','public blog post'),
      ('tc_blog_set_status','blog publish workflow'),
      ('tc_documents_render','document token renderer'),
      ('tc_contracts_for_family','family signed-document list'),
      ('tc_unlinked_records','account linking finder'),
      ('tc_link_account','account linking')
    ) as v(n, why)
  loop
    kind := 'function'; name := t.n; needed_for := t.why;
    present := exists (
      select 1 from pg_proc p
        join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = t.n);
    return next;
  end loop;

  for t in
    select * from (values
      ('documents','doc_type','document builder type preset'),
      ('documents','body','tokenised document body'),
      ('documents','signatory_role','official signatory'),
      ('documents','learner_id','issued-to learner'),
      ('tc_blog_posts','slug','public post URL'),
      ('tc_blog_posts','status','draft / published / archived'),
      ('contracts','status','contract lifecycle')
    ) as v(tbl, col, why)
  loop
    kind := 'column'; name := t.tbl || '.' || t.col; needed_for := t.why;
    present := exists (
      select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = t.tbl
         and c.column_name = t.col);
    return next;
  end loop;
end $$;

revoke all on function public.tc_v27_check() from public;
grant execute on function public.tc_v27_check() to authenticated;

-- tc_schema_ok() reports both the V26 baseline and the V27 additions.
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
  ) t;
$$;

revoke all on function public.tc_schema_ok() from public;
grant execute on function public.tc_schema_ok() to authenticated;

-- ---------------------------------------------------------------------------
-- 6b. REVIEW PAGE LOOKUP  (report item 36 — "review my paper")
-- The cbt-review.html page needs one safe RPC: give me the latest result for
-- a quiz code + student number. Open papers (guests) and self/review papers
-- are always re-openable; a graded result is only re-openable once released.
-- ---------------------------------------------------------------------------
create or replace function public.tc_cbt_recent_result(p_code text, p_student_no text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if p_code is null or p_student_no is null then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;

  select jsonb_build_object(
           'ok', true,
           'exam_title', e.title, 'quiz_kind', r.quiz_kind,
           'student_no', r.student_no, 'candidate_name', r.candidate_name,
           'score', r.score, 'max_score', r.max_score,
           'pct', case when coalesce(r.max_score, 0) > 0
                       then round(r.score / r.max_score * 100, 1) else 0 end,
           'detail', r.per_question,
           'subject_scores', coalesce(r.subject_scores, '{}'::jsonb),
           'finished_at', r.finished_at,
           'pending', coalesce(r.pending_count, 0),
           'marking_status', coalesce(r.marking_status, 'complete'))
    into v
    from public.cbt_results r
    join public.cbt_exams e on e.id = r.exam_id
   where lower(coalesce(r.exam_code, e.code)) = lower(p_code)
     and lower(coalesce(r.student_no, '')) = lower(coalesce(p_student_no, ''))
     and (coalesce(r.is_anonymous, false)
          or r.quiz_kind in ('self','review')
          or coalesce(r.released, true))
   order by r.finished_at desc
   limit 1;

  if v is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  return v;
end $$;

revoke all on function public.tc_cbt_recent_result(text, text) from public, anon;
grant execute on function public.tc_cbt_recent_result(text, text) to anon, authenticated;

select 'V27 review lookup installed' as status;

-- ---------------------------------------------------------------------------
-- 6c. tc_v27_check additions for the review lookup
-- ---------------------------------------------------------------------------
create or replace function public.tc_v27_check()
returns table (kind text, name text, present boolean, needed_for text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t record;
begin
  for t in
    select * from (values
      ('tc_blog_posts','public blog posts'),
      ('tc_blog_categories','blog categories'),
      ('contracts','contracts & consent register')
    ) as v(n, why)
  loop
    kind := 'table'; name := t.n; needed_for := t.why;
    present := to_regclass('public.' || t.n) is not null;
    return next;
  end loop;

  for t in
    select * from (values
      ('tc_parent_matches_uid','RLS recursion fix (parents)'),
      ('tc_tutor_covers_parent','RLS recursion fix (parent scope)'),
      ('tc_family_can_see_learner','RLS recursion fix (insight desks)'),
      ('tc_blog_list','public blog list'),
      ('tc_blog_get','public blog post'),
      ('tc_blog_set_status','blog publish workflow'),
      ('tc_documents_render','document token renderer'),
      ('tc_contracts_for_family','family signed-document list'),
      ('tc_unlinked_records','account linking finder'),
      ('tc_link_account','account linking'),
      ('tc_cbt_recent_result','review-my-paper lookup')
    ) as v(n, why)
  loop
    kind := 'function'; name := t.n; needed_for := t.why;
    present := exists (
      select 1 from pg_proc p
        join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = t.n);
    return next;
  end loop;

  for t in
    select * from (values
      ('documents','doc_type','document builder type preset'),
      ('documents','body','tokenised document body'),
      ('documents','signatory_role','official signatory'),
      ('documents','learner_id','issued-to learner'),
      ('tc_blog_posts','slug','public post URL'),
      ('tc_blog_posts','status','draft / published / archived'),
      ('contracts','status','contract lifecycle'),
      ('cbt_results','released','holding graded results until marking ends')
    ) as v(tbl, col, why)
  loop
    kind := 'column'; name := t.tbl || '.' || t.col; needed_for := t.why;
    present := exists (
      select 1 from information_schema.columns c
       where c.table_schema = 'public' and c.table_name = t.tbl
         and c.column_name = t.col);
    return next;
  end loop;
end $$;

revoke all on function public.tc_v27_check() from public;
grant execute on function public.tc_v27_check() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. PAGE-SCHEMA COLUMNS for the compliance / staff registers (report items
--    3, 5, 6, 9, 10). Each page keeps its enterprise CRUD workbench; these
--    columns give the registers the fields the page descriptions promise.
-- ---------------------------------------------------------------------------
do $$
declare c text;
begin
  foreach c in array array[
    -- safeguarding log: severity + case status + action
    'severity text', 'case_status text', 'action_taken text', 'occurred_on date',
    -- policies: versioned, owned, dated
    'status text', 'version text', 'owner text', 'effective_on date',
    -- leave: link to the tutor record + cover arrangement
    'tutor_id uuid', 'days numeric', 'cover_tutor text', 'contact_phone text',
    -- referrals: tracked code + reward shape
    'code text', 'referred_email text', 'reward_kind text',
    -- onboarding steps: order + deadline + owner
    'order_no int', 'due_on date', 'owner text',
    -- polls: creator
    'created_by uuid'
  ] loop
    if c like '%uuid%' then
      continue;
    end if;
    execute format('alter table if exists public.safeguarding_log add column if not exists %s', c);
    execute format('alter table if exists public.policies add column if not exists %s', c);
    execute format('alter table if exists public.leave_requests add column if not exists %s', c);
    execute format('alter table if exists public.referrals add column if not exists %s', c);
    execute format('alter table if exists public.onboarding_items add column if not exists %s', c);
    execute format('alter table if exists public.polls add column if not exists %s', c);
  end loop;
  -- tutor_id is a FK-ish reference; add it only to leave_requests
  execute 'alter table if exists public.leave_requests add column if not exists tutor_id uuid';
end $$;

select 'V27 staff-register columns installed' as status;

-- ---------------------------------------------------------------------------
-- 6b. REVIEW PAGE LOOKUP  (report item 36 — "review my paper")
