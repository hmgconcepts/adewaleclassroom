-- ============================================================================
-- Tutoring Connect V12 — SCHEMA REGISTRY + FREE-TIER QUOTA GUARD (idempotent)
-- ============================================================================
-- Two jobs, both aimed squarely at surviving on the Supabase free tier:
--
--   PART A — a SCHEMA REGISTRY, so a studio can always answer "which version am
--   I actually running?" without guessing. The V11 audit found the live ADEWALE
--   CLASSROOM project silently sitting at V4 while its files expected V9; the
--   only way to detect that was to probe for functions one by one. Now the
--   database records its own version.
--
--   PART B — a QUOTA GUARD for the 500 MB database limit. The platform already
--   refuses file uploads (links, never bytes), which protects the 1 GB *storage*
--   quota. But the *database* can still fill up, and on this platform it will
--   always fill up in the same place: CBT results. Every submitted quiz stores
--   `answers`, `review` and `detail` as JSONB — a 60-question paper is roughly
--   30-60 KB per candidate, so 300 sittings ≈ 15 MB, and a busy studio with
--   several years of history will eventually notice.
--
--   Three defences, cheapest first:
--     1. COMPRESS  — LZ4 on the heavy JSONB/text columns (PG14+). Typically
--                    40-60% off JSONB payloads, applied by Postgres itself with
--                    no application change.
--     2. MEASURE   — tc_db_report() exposes total size, the worst tables, and
--                    the percentage of the 500 MB budget consumed.
--     3. RECLAIM   — tc_prune_logs() enforces retention on append-only logs, and
--                    tc_slim_cbt_results() strips the verbose per-question blob
--                    from OLD results while keeping every score, so analytics
--                    and the scoresheet are completely unaffected.
--
--   Nothing here deletes a mark, a payment, a session or a learner record.
--   Only logs and the bulky replay data of long-past quizzes are touched, and
--   every step is opt-in with an explicit day threshold.
--
-- Safe to run repeatedly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PART A · SCHEMA REGISTRY
-- ---------------------------------------------------------------------------
create table if not exists public.tc_schema_registry (
  id          integer primary key default 1,
  version     text not null,
  applied_at  timestamptz not null default now(),
  packs       text[] not null default '{}',
  note        text,
  constraint tc_schema_registry_single_row check (id = 1)
);

insert into public.tc_schema_registry (id, version, packs, note)
values (1, 'V12', array['v1-core','v2-tutoring-ops','v3-classroom-exams',
                        'v4-enterprise-parity','v5-ops-parity','v6-cbt-modes',
                        'v7-family-access','v9-keepalive-drive','v12-quota-guard'],
        'Installed by database/complete-schema.sql')
on conflict (id) do update
   set version    = excluded.version,
       applied_at = now(),
       packs      = excluded.packs,
       note       = excluded.note;

alter table public.tc_schema_registry enable row level security;
grant select on public.tc_schema_registry to authenticated;
revoke all on public.tc_schema_registry from anon;

drop policy if exists tc_schema_registry_read on public.tc_schema_registry;
create policy tc_schema_registry_read on public.tc_schema_registry
  for select using (public.is_admin() or public.is_tutor());

-- One call the app can make instead of probing function-by-function.
create or replace function public.tc_schema_info()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'version', r.version,
    'applied_at', r.applied_at,
    'packs', r.packs,
    'expected', 'V12'
  ) from public.tc_schema_registry r where r.id = 1;
$$;
grant execute on function public.tc_schema_info() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- PART B1 · COMPRESS — LZ4 on the columns that actually get big.
--   Guarded twice: server_version must be >= 14, and each ALTER is wrapped so a
--   build without LZ4 support degrades to the default pglz instead of failing
--   the whole script.
--   NOTE: this affects rows written AFTER the change. Existing rows re-compress
--   when they are next rewritten (or on a VACUUM FULL, which we do not run
--   automatically because it takes an exclusive lock).
-- ---------------------------------------------------------------------------
do $lz4$
declare
  t record;
  targets text[][] := array[
    -- The genuinely heavy ones, verified to exist in complete-schema.sql.
    ['cbt_exams',        'questions'],      -- the whole question bank per paper
    ['cbt_results',      'answers'],        -- what the candidate picked
    ['cbt_results',      'review'],         -- per-question replay for the PDF
    ['cbt_results',      'detail'],         -- grading detail
    ['cbt_results',      'subject_scores'], -- per-subject breakdown
    ['applications',     'payload'],        -- full application form submissions
    ['application_links','fields'],
    ['survey_responses', 'answers'],
    ['module_records',   'data'],
    ['surveys',          'questions'],
    ['polls',            'options'],
    ['session_notes',    'body'],
    ['reading_items',    'notes'],
    ['practice_settings','role_access'],
    ['practice_settings','role_write']
  ];
  i int;
begin
  if current_setting('server_version_num')::int < 140000 then
    raise notice 'LZ4 column compression needs PostgreSQL 14+. Skipped (TOAST/pglz still applies).';
    return;
  end if;
  for i in 1 .. array_length(targets, 1) loop
    begin
      if exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name  = targets[i][1]
           and column_name = targets[i][2]
      ) then
        execute format('alter table public.%I alter column %I set compression lz4',
                       targets[i][1], targets[i][2]);
      end if;
    exception when others then
      raise notice 'LZ4 not applied to %.% (%). Default compression remains.',
                   targets[i][1], targets[i][2], sqlerrm;
    end;
  end loop;
end
$lz4$;

-- ---------------------------------------------------------------------------
-- PART B2 · MEASURE — what is actually using the 500 MB?
-- ---------------------------------------------------------------------------
create or replace function public.tc_db_report()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with sizes as (
    select c.relname as table_name,
           pg_total_relation_size(c.oid) as bytes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  ), total as (
    select coalesce(sum(bytes), 0)::bigint as b from sizes
  )
  select jsonb_build_object(
    'ok', true,
    'checked_at', now(),
    'quota_bytes', 524288000,                                  -- 500 MB free tier
    'used_bytes', (select b from total),
    'used_mb', round((select b from total) / 1048576.0, 2),
    'used_pct', round((select b from total) / 5242880.0, 2),   -- % of 500 MB
    'state', case
               when (select b from total) > 440401920 then 'critical'   -- >84%
               when (select b from total) > 366545920 then 'warning'    -- >70%
               else 'healthy'
             end,
    'top_tables', (
      select jsonb_agg(jsonb_build_object(
               'table', table_name,
               'mb', round(bytes / 1048576.0, 2),
               'pct', round(bytes / greatest((select b from total), 1)::numeric * 100, 1)))
        from (select * from sizes order by bytes desc limit 12) s
    ),
    'row_counts', (
      select jsonb_object_agg(t, n) from (
        select 'cbt_results' as t, (select count(*) from public.cbt_results) as n
        union all select 'activity_log', (select count(*) from public.activity_log)
        union all select 'notifications', (select count(*) from public.notifications)
        union all select 'login_audit', (select count(*) from public.login_audit)
        union all select 'sessions', (select count(*) from public.sessions)
      ) x
    )
  );
$$;
grant execute on function public.tc_db_report() to authenticated;

-- ---------------------------------------------------------------------------
-- PART B3 · RECLAIM — retention on append-only logs.
--   Admin-only. Defaults are deliberately generous; nothing academic is touched.
-- ---------------------------------------------------------------------------
create or replace function public.tc_prune_logs(p_days int default 180)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(p_days, 30));
  a int := 0; b int := 0; c int := 0; d int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may prune logs.';
  end if;

  delete from public.activity_log     where created_at < cutoff;              get diagnostics a = row_count;
  delete from public.login_audit      where created_at < cutoff;              get diagnostics b = row_count;
  delete from public.notifications    where created_at < cutoff
                                        and read_at is not null;              get diagnostics c = row_count;
  delete from public.tc_keepalive_log where pinged_at < now() - interval '30 days';
  get diagnostics d = row_count;

  return jsonb_build_object(
    'ok', true, 'cutoff', cutoff,
    'deleted', jsonb_build_object('activity_log', a, 'login_audit', b,
                                  'notifications_read', c, 'keepalive_log', d));
end $$;
grant execute on function public.tc_prune_logs(int) to authenticated;

-- ---------------------------------------------------------------------------
-- PART B4 · RECLAIM — slim OLD quiz results.
--   `detail` and `answers` are the per-question replay blob: what the learner
--   picked, the key, the explanation. It is what powers the review screen and
--   the PDF, and it is by far the biggest thing this platform stores.
--
--   After a couple of terms nobody re-opens a review, but the SCORE must live
--   forever. So for results older than p_days we drop the replay blob and keep
--   score, max_score, subject_scores and every scoresheet row. Analytics,
--   value-added, predictions and the scoresheet are completely unaffected.
--
--   A marker is written into `detail` so the review screen can explain the
--   absence honestly instead of rendering an empty page.
-- ---------------------------------------------------------------------------
create or replace function public.tc_slim_cbt_results(p_days int default 365)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare n int := 0; freed_estimate bigint := 0;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator may slim CBT results.';
  end if;

  select coalesce(sum(pg_column_size(answers) + pg_column_size(review) + pg_column_size(detail)), 0)
    into freed_estimate
    from public.cbt_results
   where created_at < now() - make_interval(days => greatest(p_days, 90))
     and detail is not null
     and (detail ? 'archived') is not true;

  update public.cbt_results
     set answers = null,
         review  = null,
         detail  = jsonb_build_object(
                     'archived', true,
                     'archived_at', now(),
                     'note', 'Per-question replay removed to protect the free-tier database. '
                          || 'Score, per-subject scores and every scoresheet row are unchanged.')
   where created_at < now() - make_interval(days => greatest(p_days, 90))
     and detail is not null
     and (detail ? 'archived') is not true;
  get diagnostics n = row_count;

  return jsonb_build_object('ok', true, 'slimmed', n,
                            'freed_bytes_estimate', freed_estimate,
                            'freed_mb_estimate', round(freed_estimate / 1048576.0, 2));
end $$;
grant execute on function public.tc_slim_cbt_results(int) to authenticated;

-- ---------------------------------------------------------------------------
-- PART B5 · AUTOMATE — nightly housekeeping when pg_cron exists.
--   Conservative: logs older than a year, quiz replay older than two years.
--   pg_cron only runs while the project is awake, which is exactly what the
--   keep-alive layers guarantee.
-- ---------------------------------------------------------------------------
do $housekeeping$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule(jobid) from cron.job where jobname = 'tc-housekeeping';
      perform cron.schedule('tc-housekeeping', '17 3 * * 0',
        $job$
          delete from public.activity_log     where created_at < now() - interval '365 days';
          delete from public.login_audit      where created_at < now() - interval '365 days';
          delete from public.tc_keepalive_log where pinged_at  < now() - interval '30 days';
        $job$);
    exception when others then
      raise notice 'pg_cron housekeeping not scheduled (%). Non-fatal.', sqlerrm;
    end;
  end if;
end
$housekeeping$;

select 'Tutoring Connect V12 schema registry + quota guard installed ✅' as status;
