-- ═══════════════════════════════════════════════════════════════════════
-- tools/pg_stubs.sql — Supabase environment stubs for LOCAL verification.
--
-- complete-schema.sql targets Supabase Postgres, which ships with an
-- `auth` schema (users + uid()/role()/email() helpers), a `storage` schema
-- (buckets/objects) and the anon / authenticated / service_role roles.
-- None of those exist on a vanilla Postgres — this file recreates the
-- minimum surface the schema actually touches, so
-- tools/verify_schema_pg.sh can run the REAL complete-schema.sql locally
-- and prove it executes error-free on both fresh and legacy databases.
--
-- This file is NEVER deployed — it exists only for local verification.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- Supabase client roles -------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;

-- auth schema ------------------------------------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function auth.uid() returns uuid
language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create or replace function auth.role() returns text
language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $$;

create or replace function auth.email() returns text
language sql stable as
$$ select nullif(current_setting('request.jwt.claim.email', true), '')::text $$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;

-- storage schema (only the columns the schema's policies touch) ----------
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  created_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz default now()
);

grant usage on schema storage to anon, authenticated, service_role;

commit;
