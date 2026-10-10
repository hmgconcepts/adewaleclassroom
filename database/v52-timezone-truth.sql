-- ═══════════════════════════════════════════════════════════════════════
-- V52 — TIMEZONE TRUTH (round 16, item 1)
--
-- The blueprint: international students sit in different timezones, and
-- a class time rendered in a single zone is how students miss classes.
-- The portal now renders schedule times in BOTH the studio's home zone
-- and the viewer's own zone concurrently (crud.js schedule columns, the
-- dashboard Next-class card, and the Timezone desk planner + live world
-- clocks). Those surfaces need ONE authoritative answer to two questions:
--
--   · what is the studio's home zone?
--   · what zone is THIS signed-in person in?
--
-- tc_my_tz() answers both in a single security-definer RPC:
--   home  — practice_settings.timezone (the studio clock), else the
--           tc_timezone_desk row flagged is_default, else 'Africa/Lagos'
--   mine  — the person's own tc_timezone_desk entry (learner / tutor /
--           parent, matched through the role tables by user_id), else
--           the role table's own timezone column, else NULL (the client
--           then falls back to the browser's zone — correct by design)
--
-- Callers: assets/js/tz.js (every dual-time surface). Readable by any
-- authenticated user about THEMSELVES only.
--
-- Also in this migration (round 16, items 2–6 hardening): nothing new is
-- needed server-side — the name-resolution fix is tc_ref_labels v2 (V51)
-- plus the client-side race fix in crud.js. This file is kept
-- timezone-only on purpose.
--
-- Idempotent: create-or-replace throughout.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.tc_my_tz()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_home  text;
  v_mine  text;
  v_label text;
  v_role  text;
begin
  if auth.uid() is null then
    return jsonb_build_object('home', 'Africa/Lagos', 'mine', null, 'mine_label', '');
  end if;

  select lower(coalesce(p.role, '')) into v_role from public.profiles p where p.id = auth.uid();

  -- home: the studio clock
  select coalesce(s.timezone, '') into v_home from public.practice_settings s where s.id = 1;
  if coalesce(v_home, '') = '' then
    select tz into v_home from public.tc_timezone_desk d
     where d.is_default and d.active limit 1;
  end if;
  v_home := coalesce(nullif(v_home, ''), 'Africa/Lagos');

  -- mine: the person's own desk entry first (it carries working hours too),
  -- then the role table's timezone column.
  if v_role in ('learner', 'student') then
    select d.tz, coalesce(d.city, d.tz) into v_mine, v_label
      from public.tc_timezone_desk d
     where d.active and d.party_type = 'learner'
       and d.learner_id in (select l.id from public.learners l where l.user_id = auth.uid())
     order by d.created_at limit 1;
    if v_mine is null then
      select coalesce(l.timezone, '') into v_mine from public.learners l where l.user_id = auth.uid() limit 1;
    end if;
  elsif v_role in ('tutor', 'teacher', 'staff', 'lead_tutor') then
    select d.tz, coalesce(d.city, d.tz) into v_mine, v_label
      from public.tc_timezone_desk d
     where d.active and d.party_type = 'tutor'
       and d.tutor_id in (select t.id from public.tutors t where t.user_id = auth.uid())
     order by d.created_at limit 1;
    if v_mine is null then
      select coalesce(t.timezone, '') into v_mine from public.tutors t where t.user_id = auth.uid() limit 1;
    end if;
  elsif v_role = 'parent' then
    select d.tz, coalesce(d.city, d.tz) into v_mine, v_label
      from public.tc_timezone_desk d
     where d.active and d.party_type = 'parent'
       and d.parent_id in (select pa.id from public.parents pa where pa.user_id = auth.uid())
     order by d.created_at limit 1;
    if v_mine is null then
      select coalesce(pa.timezone, '') into v_mine from public.parents pa where pa.user_id = auth.uid() limit 1;
    end if;
  else
    -- owner / admin / director: the studio clock is their clock
    v_mine := null;
  end if;

  if coalesce(v_mine, '') = '' then v_mine := null; end if;

  return jsonb_build_object('home', v_home, 'mine', v_mine,
                            'mine_label', coalesce(v_label, ''));
end $$;

grant execute on function public.tc_my_tz() to authenticated;
revoke all on function public.tc_my_tz() from public, anon;

-- PostgREST: make the new function visible immediately.
-- ─────────────────────────────────────────────────────────────────────────
-- 2) TC_LAST_BACKUP — the round-16 fix for admin-data "Last Backup: never".
--    The r15 client read practice_settings.last_backup_at from inside an
--    async IIFE; for a non-owner family role the RLS select returns NULL
--    (not an error) and the card fell back to "never" forever. This
--    security-definer RPC returns the studio-wide truth for ANY
--    authenticated member, and carries the backup path so every device
--    can tell not just when but where the latest archive lives.
-- ----------------------------------------------------------------------------
alter table public.practice_settings
  add column if not exists backup_path text;

create or replace function public.tc_last_backup()
returns table (last_backup_at timestamptz, backup_path text)
language sql
security definer
set search_path = public
as $$
  select p.last_backup_at, p.backup_path
  from public.practice_settings p
  where p.id = 1
$$;

revoke all on function public.tc_last_backup() from public, anon;
grant execute on function public.tc_last_backup() to authenticated;

notify pgrst, 'reload schema';

select 'V52 timezone truth (tc_my_tz + tc_last_backup) installed ✅' as status;
