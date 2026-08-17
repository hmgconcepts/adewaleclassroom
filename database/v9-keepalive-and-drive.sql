-- ============================================================================
-- Tutoring Connect V9 — KEEP-ALIVE HARDENING + DRIVE SYNC SUPPORT (idempotent)
-- ============================================================================
-- BACKGROUND (verified against Supabase behaviour, Aug 2026)
--
--   * Supabase pauses a FREE project after 7 consecutive days of inactivity.
--   * "Inactivity" is measured by real DATABASE activity. Visiting your
--     front end, opening the Supabase dashboard, or calling an API route that
--     never touches Postgres does NOT reset the timer.
--   * A paused project must be un-paused BY HAND from the dashboard, and a
--     project left paused is eventually DELETED (~90 days).
--   * pg_cron cannot save you on its own: it runs inside the database, so once
--     the project pauses the scheduler pauses with it. It is a useful bonus
--     layer, never the primary one.
--
-- WHAT V8 GOT WRONG (found by audit, reproduced against a live project)
--
--   1. `revoke all on public.tc_heartbeat from anon, authenticated` combined
--      with RLS and no policy meant platform-health.html could NEVER read the
--      heartbeat: the live project returns
--         42501 permission denied for table tc_heartbeat
--      So the keep-alive system was completely UNOBSERVABLE. An owner had no
--      way to discover that their pings had stopped until the project paused.
--      That is the single most dangerous failure mode: silent.
--   2. There was no status RPC, so no external monitor could ask
--      "how close am I to being paused?".
--   3. tc_keep_alive only did an UPDATE. If row id=1 were ever missing the
--      heartbeat silently no-opped and still returned success.
--
-- THIS PACK FIXES ALL THREE and adds an auditable ping log.
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Heartbeat table (unchanged shape, guaranteed to exist)
-- ---------------------------------------------------------------------------
create table if not exists public.tc_heartbeat (
  id integer primary key,
  last_ping timestamptz not null default now(),
  last_source text,
  ping_count bigint not null default 0
);
insert into public.tc_heartbeat (id) values (1) on conflict (id) do nothing;
alter table public.tc_heartbeat enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Ping log — observability. Capped at 200 rows so it can never threaten
--    the 500 MB free-tier budget (200 rows ≈ 20 KB).
-- ---------------------------------------------------------------------------
create table if not exists public.tc_keepalive_log (
  id bigserial primary key,
  pinged_at timestamptz not null default now(),
  source text,
  ok boolean not null default true
);
create index if not exists tc_keepalive_log_at_idx on public.tc_keepalive_log (pinged_at desc);
alter table public.tc_keepalive_log enable row level security;

-- ---------------------------------------------------------------------------
-- 3. THE write. SECURITY DEFINER so anon can trigger it without any table
--    grant. Now an UPSERT (never a silent no-op) and it records the ping.
-- ---------------------------------------------------------------------------
create or replace function public.tc_keep_alive(src text default 'unknown')
returns timestamptz
language plpgsql
security definer
set search_path = public
as $keepalive$
declare v_now timestamptz := now();
begin
  insert into public.tc_heartbeat (id, last_ping, last_source, ping_count)
  values (1, v_now, left(coalesce(src, 'unknown'), 40), 1)
  on conflict (id) do update
     set last_ping   = v_now,
         last_source = left(coalesce(src, 'unknown'), 40),
         ping_count  = public.tc_heartbeat.ping_count + 1;

  insert into public.tc_keepalive_log (pinged_at, source, ok)
  values (v_now, left(coalesce(src, 'unknown'), 40), true);

  -- Keep only the newest 200 log rows.
  delete from public.tc_keepalive_log
   where id < (select max(id) - 200 from public.tc_keepalive_log);

  return v_now;
end
$keepalive$;
grant execute on function public.tc_keep_alive(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. THE read. Lets any monitor (or the Platform Health page) ask how close
--    the project is to being paused, WITHOUT granting table access.
--    Returns jsonb so external cron services can assert on it.
--
--    state: healthy  (< 3 days since last ping)
--           warning  (3–5 days — a scheduler has probably missed a run)
--           critical (> 5 days — pause is imminent, act now)
-- ---------------------------------------------------------------------------
create or replace function public.tc_keep_alive_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $status$
  select jsonb_build_object(
    'ok',            true,
    'last_ping',     h.last_ping,
    'last_source',   h.last_source,
    'ping_count',    h.ping_count,
    'hours_since',   round(extract(epoch from (now() - h.last_ping)) / 3600.0, 2),
    'days_since',    round(extract(epoch from (now() - h.last_ping)) / 86400.0, 2),
    'days_left',     greatest(0, round(7 - extract(epoch from (now() - h.last_ping)) / 86400.0, 2)),
    'pause_risk_at', h.last_ping + interval '7 days',
    'state', case
               when now() - h.last_ping < interval '3 days' then 'healthy'
               when now() - h.last_ping < interval '5 days' then 'warning'
               else 'critical'
             end,
    'checked_at',    now()
  )
  from public.tc_heartbeat h
  where h.id = 1;
$status$;
grant execute on function public.tc_keep_alive_status() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Observability for staff. THE V8 BUG FIX: the Platform Health page could
--    not read this table at all. Staff may now read the heartbeat and the log;
--    anon still cannot (it uses the status RPC instead). Nobody may write
--    directly — the only write path remains the SECURITY DEFINER function.
-- ---------------------------------------------------------------------------
grant select on public.tc_heartbeat    to authenticated;
grant select on public.tc_keepalive_log to authenticated;
revoke all on public.tc_heartbeat     from anon;
revoke all on public.tc_keepalive_log from anon;

drop policy if exists tc_heartbeat_staff_read on public.tc_heartbeat;
create policy tc_heartbeat_staff_read on public.tc_heartbeat
  for select using (public.is_admin() or public.is_tutor());

drop policy if exists tc_keepalive_log_staff_read on public.tc_keepalive_log;
create policy tc_keepalive_log_staff_read on public.tc_keepalive_log
  for select using (public.is_admin() or public.is_tutor());

-- ---------------------------------------------------------------------------
-- 6. pg_cron — a BONUS layer only.
--    It cannot rescue a paused project (it pauses too), but while the project
--    is awake it adds a free internal ping every 2 days. Never rely on it.
-- ---------------------------------------------------------------------------
do $cronsetup$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule(jobid) from cron.job where jobname = 'tc-keep-alive';
      perform cron.schedule('tc-keep-alive', '23 5 */2 * *',
                            $job$select public.tc_keep_alive('pg_cron')$job$);
    exception when others then
      raise notice 'pg_cron keep-alive not scheduled (%). This is non-fatal.', sqlerrm;
    end;
  end if;
end
$cronsetup$;

-- ---------------------------------------------------------------------------
-- 7. Google Drive sync settings (used by assets/js/drive-sync.js)
-- ---------------------------------------------------------------------------
alter table if exists public.practice_settings add column if not exists drive_client_id     text default '';
alter table if exists public.practice_settings add column if not exists drive_sync_enabled  boolean not null default false;
alter table if exists public.practice_settings add column if not exists drive_sync_days     int not null default 7;
alter table if exists public.practice_settings add column if not exists drive_folder_id     text default '';
alter table if exists public.practice_settings add column if not exists drive_last_backup   timestamptz;
alter table if exists public.practice_settings add column if not exists drive_last_status   text default '';
alter table if exists public.practice_settings add column if not exists drive_last_rows     int default 0;
alter table if exists public.practice_settings add column if not exists drive_last_bytes    bigint default 0;

-- practice_settings is admin-write by the loop policy, but the Drive panel is
-- opened by owners/admins only, so no extra policy is required. Reading it is
-- already permitted for tutors via the *_tutor_read policy.

select 'Tutoring Connect V9 keep-alive hardening + Drive settings installed ✅' as status;
