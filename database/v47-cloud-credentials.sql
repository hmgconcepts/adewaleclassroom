-- ═══════════════════════════════════════════════════════════════════════
-- V47 — CLOUD CREDENTIALS + SCHOOL SETTINGS (round 11)
--
-- Field reports this migration fixes:
--
--   ITEM 1 — TURN/streaming credentials did not follow the account.
--   A teacher who generated Cloudflare TURN credentials on one laptop had
--   to paste them again on every other device, because ClassDeck stores
--   them in localStorage (per-device). The fix: a per-account
--   USER_SETTINGS table. ClassDeck (served on the same origin as the
--   portal) reads the portal sign-in from localStorage and pulls/pushes
--   the TURN key, the generated relay credentials and the streaming
--   destinations through this table — owner-only by policy, so the
--   credentials are available on every device the teacher signs in from,
--   and to nobody else.
--
--   ITEM 2 — "A table is missing (school_settings)". The Google Drive
--   backup card reads/writes a school_settings table that no schema file
--   ever created, so every attempt to set up Drive backup failed with
--   the schema doctor's "table missing" message. The table is created
--   here and pre-seeded with the school's Google OAuth Client ID, so
--   backing up to the school's own Drive works immediately.
--
-- Idempotent: create-if-not-exists / create-or-replace throughout; safe
-- to run twice and safe on a fresh install (complete-schema.sql already
-- carries this section for new databases).
-- ═══════════════════════════════════════════════════════════════════════

-- UPGRADE-ORDER GUARD (round-9 field-fix class): this migration uses
-- is_admin() in its policies and tc_set_updated_at() in its triggers.
-- Both live in the base schema, but a legacy database running THIS file
-- standalone (migrations chain only) has neither yet. create-or-replace
-- with the canonical bodies is a no-op where they already exist.
create or replace function public.tc_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.is_admin()
returns boolean language plpgsql stable security definer as $$
begin
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','owner','director','lead_tutor','super_admin')
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- 1. SCHOOL SETTINGS (school-wide, admin-managed, readable by staff)
--    Consumed by assets/js/drive-sync.js (Google Drive backup card).
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.school_settings (
  id                  int primary key default 1 check (id = 1),
  drive_client_id     text not null default '',
  drive_sync_enabled  boolean not null default false,
  drive_sync_days     int not null default 7,
  drive_folder_id     text not null default '',
  drive_last_backup   timestamptz,
  updated_at          timestamptz not null default now()
);

alter table public.school_settings enable row level security;

drop policy if exists "school settings are readable by signed-in members" on public.school_settings;
create policy "school settings are readable by signed-in members"
  on public.school_settings for select
  to authenticated
  using (true);
  /* The Drive Client ID is public by design (OAuth client IDs appear in
     every page load of Google-hosted apps); the last-backup timestamp is
     operational, not confidential. Nothing here is a secret. */

drop policy if exists "school settings are managed by admins" on public.school_settings;
create policy "school settings are managed by admins"
  on public.school_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "school settings are seeded by admins" on public.school_settings;
create policy "school settings are seeded by admins"
  on public.school_settings for insert
  to authenticated
  with check (public.is_admin());

drop trigger if exists trg_school_settings_updated on public.school_settings;
create trigger trg_school_settings_updated
  before update on public.school_settings
  for each row execute function public.tc_set_updated_at();

/* Seed the singleton row. The school's real Google OAuth Client ID is
   pre-filled (it is public, and this repo is the school's own deployment):
   once the migration runs, the Drive Backup card is already configured —
   the admin only has to authorise Google. A school that has already saved
   its own Client ID is never overwritten. */
insert into public.school_settings (id, drive_client_id) values (
  1,
  '1051552536424-epf577d73iq03lkkthokkj2kp7n2f1qr.apps.googleusercontent.com'
)
on conflict (id) do update
  set drive_client_id = case
        when length(btrim(public.school_settings.drive_client_id)) = 0
          then excluded.drive_client_id
        else public.school_settings.drive_client_id
      end;

-- ─────────────────────────────────────────────────────────────────────
-- 2. USER SETTINGS — per-account roaming storage (round-11 item 1).
--    One row per (account, channel). Channels in use:
--      cd-turn    — Cloudflare TURN key + generated relay credentials
--      cd-stream  — streaming gateway, relay secret, destinations
--    Owner-only at the policy level; values never leave the owner's
--    account. Values are jsonb so new channels need no schema change.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.user_settings (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  key        text not null,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_settings enable row level security;

drop policy if exists "own settings readable" on public.user_settings;
create policy "own settings readable"
  on public.user_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own settings insertable" on public.user_settings;
create policy "own settings insertable"
  on public.user_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "own settings updatable" on public.user_settings;
create policy "own settings updatable"
  on public.user_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own settings deletable" on public.user_settings;
create policy "own settings deletable"
  on public.user_settings for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists trg_user_settings_updated on public.user_settings;
create trigger trg_user_settings_updated
  before update on public.user_settings
  for each row execute function public.tc_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 3. MESSAGES RLS — v44 gave messages a recipient column (real person-
--    to-person routing), but the read policy was never widened to match:
--    a direct REST read of your own inbox returned NOTHING for received
--    person-to-person messages (the RPCs masked it by running as
--    security definer). The recipient clause makes the policy honest.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists messages_own_read on public.messages;
create policy messages_own_read on public.messages
  for select using (
    sender = auth.uid()
    or recipient = auth.uid()
    or to_role is null
    or lower(to_role) = 'all'
    or lower(to_role) = lower(coalesce((select p.role from public.profiles p where p.id = auth.uid()), ''))
  );

-- PostgREST: clear the cached schema so both tables are visible immediately.
notify pgrst, 'reload schema';

grant select, insert, update on public.school_settings to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;

select 'V47 school_settings + user_settings (cloud credentials) installed ✅' as status;
