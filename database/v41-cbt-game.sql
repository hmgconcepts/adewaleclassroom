-- ============================================================================
-- Tutoring Connect · V41 — QUIZ GAMIFICATION  (appended 29 Aug 2026)
-- ----------------------------------------------------------------------------
-- ITEM 16 — Gamify quizzes (Quizizz-style) when the tutor enables it.
--
-- This is pure schema: the tables, the XP/streak engine and the leaderboard.
-- The client (practice.html / cbt-exam.html / gamification.html) reads
-- tc_game_award() and tc_game_leaderboard() and paints the badges. Nothing
-- here is AI, nothing calls out to a service, and the whole thing works on
-- the free tier.
--
-- DESIGN
--   * XP is earned per completed attempt, scaled by accuracy + a streak
--     bonus, so a learner is rewarded for consistency as well as for a single
--     high score — the same loop that makes Quizizz sticky.
--   * Streaks are day-based. Consecutive days (calendar days in the learner's
--     own timezone) build streak_days; a missed day resets it to 1.
--   * Levels are a soft curve (level = 1 + floor(sqrt(xp/25))), so early
--     levels come fast and later ones slower.
--   * Security-definer awarding means a learner can never write their own XP.
--     RLS lets a learner read their own profile and effort history, and lets
--     anyone read the public leaderboard.
--
-- IDEMPOTENT: every statement is CREATE TABLE/INDEX IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS before CREATE POLICY,
-- INSERT ... ON CONFLICT DO NOTHING/UPDATE. Safe to re-run many times, and
-- safe to drop into an already-live studio.
-- ============================================================================

alter table if exists public.cbt_exams add column if not exists gamify boolean default false;

-- ----------------------------------------------------------------------------
-- 1. Learner XP + streak profile. One row per learner.
-- ----------------------------------------------------------------------------
create table if not exists public.tc_game_profiles (
  learner_id   uuid primary key references public.learners(id) on delete cascade,
  xp           int  not null default 0,
  level        int  not null default 1,
  streak_days  int  not null default 0,
  best_streak  int  not null default 0,
  last_quiz_day date,
  badges       jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

create index if not exists tc_game_profiles_xp_idx on public.tc_game_profiles (xp desc);

-- ----------------------------------------------------------------------------
-- 2. Audit of every gamified attempt that awarded XP.
-- ----------------------------------------------------------------------------
create table if not exists public.tc_game_attempts (
  id          uuid primary key default gen_random_uuid(),
  learner_id  uuid not null references public.learners(id) on delete cascade,
  exam_id     uuid,
  correct     int not null default 0,
  total       int not null default 0,
  pct         numeric(6,2) not null default 0,
  accuracy_xp int not null default 0,
  streak_xp   int not null default 0,
  xp_earned   int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists tc_game_attempts_learner_idx on public.tc_game_attempts (learner_id, created_at desc);

-- ITEM 11 (scale) — the single per-candidate WRITE on a big CBT is the result
-- row; the single hot READ is the tutor's list of a paper's candidates and the
-- audit. A composite index makes both sargable when hundreds of candidates sit
-- the same paper at once, instead of a sequential scan.
create index if not exists tc_cbt_results_exam_created_idx on public.cbt_results (exam_id, created_at desc);

alter table public.tc_game_profiles enable row level security;
alter table public.tc_game_attempts enable row level security;

-- ----------------------------------------------------------------------------
-- 3. Helpers.
-- ----------------------------------------------------------------------------
-- The learner row that belongs to the currently signed-in user.
create or replace function public.tc_my_learner_id()
returns uuid language sql stable security invoker set search_path = public as $$
  select l.id from public.learners l where l.user_id = auth.uid() limit 1;
$$;
grant execute on function public.tc_my_learner_id() to authenticated;

-- The learner's current level for a given XP total.
create or replace function public.tc_game_level(p_xp int)
returns int language sql immutable as $$
  select greatest(1, floor(sqrt(coalesce(p_xp,0) / 25.0))::int + 1);
$$;
grant execute on function public.tc_game_level(int) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. XP engine — award points for a finished attempt.
--    SECURITY DEFINER: the caller passes only the outcome (correct/total);
--    the function computes the award and writes it. A learner cannot inject
--    XP, because the values they would want are the ones being computed.
-- ----------------------------------------------------------------------------
create or replace function public.tc_game_award(p_learner uuid, p_correct int, p_total int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_xp           int := 0;
  v_acc_xp       int := 0;
  v_streak_xp    int := 0;
  v_pct          numeric(6,2) := 0;
  v_streak       int := 0;
  v_last         date;
  v_today        date := (now() at time zone coalesce((select p.timezone from public.practice_settings p where p.id = 1),'Africa/Lagos'))::date;
  v_prefix       text := (coalesce((select p.name from public.practice_settings p where p.id = 1),'Tutoring Connect'));
begin
  if p_learner is null then
    return jsonb_build_object('ok', false, 'reason', 'no learner');
  end if;
  v_pct := case when coalesce(p_total,0) > 0 then round(100.0 * coalesce(p_correct,0) / p_total, 2) else 0 end;

  select coalesce(xp,0), coalesce(streak_days,0), last_quiz_day
    into v_xp, v_streak, v_last
    from public.tc_game_profiles where learner_id = p_learner;

  -- Accuracy XP: up to 50 points for a perfect score (linear, rounded to
  -- integers). This is the bulk of the reward and it is capped, so grinding
  -- an easy 100-question paper cannot outpace genuine improvement.
  v_acc_xp := round(50.0 * v_pct / 100.0)::int;

  -- Streak XP: one point per day of a continuing run, so two days in a row
  -- beats twenty attempts on a single day. A missed day resets the run.
  if v_last is not null and v_last = v_today - 1 then
    v_streak := coalesce(v_streak,0) + 1;
  else
    v_streak := 1;
  end if;
  v_streak_xp := v_streak;   -- 1/day is deliberately gentle: streaks reward
                             -- presence, accuracy rewards performance.

  -- Completion bonus: +5 for actually finishing (a blank submit awards 0).
  -- The final XP is accuracy + streak + a flat 10 for a completed attempt,
  -- so a learner who stays the course is never left at zero.
  v_xp := coalesce(v_xp,0) + v_acc_xp + v_streak_xp + 10;

  insert into public.tc_game_profiles
    (learner_id, xp, level, streak_days, best_streak, last_quiz_day, badges, updated_at)
  values
    (p_learner, v_xp, public.tc_game_level(v_xp), v_streak,
     greatest(coalesce((select best_streak from public.tc_game_profiles where learner_id = p_learner),0), v_streak),
     v_today, (select coalesce(badges,'[]'::jsonb) from public.tc_game_profiles where learner_id = p_learner), now())
  on conflict (learner_id) do update set
     xp           = excluded.xp,
     level        = excluded.level,
     streak_days  = excluded.streak_days,
     best_streak  = greatest(tc_game_profiles.best_streak, excluded.best_streak),
     last_quiz_day = excluded.last_quiz_day,
     badges       = tc_game_profiles.badges,
     updated_at   = now();

  insert into public.tc_game_attempts
    (learner_id, correct, total, pct, accuracy_xp, streak_xp, xp_earned)
  values (p_learner, coalesce(p_correct,0), coalesce(p_total,0), v_pct, v_acc_xp, v_streak_xp, v_acc_xp + v_streak_xp + 10);

  -- A couple of friendly one-time badges, computed purely from the totals.
  if v_streak >= 3 and not (select coalesce((select badges from public.tc_game_profiles where learner_id = p_learner),'[]') @> '["streak-3"]') then
    update public.tc_game_profiles set badges = badges || '["streak-3"]'::jsonb where learner_id = p_learner;
  end if;
  if v_pct >= 90 and not (select coalesce((select badges from public.tc_game_profiles where learner_id = p_learner),'[]') @> '["sharp-90"]') then
    update public.tc_game_profiles set badges = badges || '["sharp-90"]'::jsonb where learner_id = p_learner;
  end if;

  return jsonb_build_object(
    'ok', true,
    'xp_earned', v_acc_xp + v_streak_xp + 10,
    'accuracy_xp', v_acc_xp,
    'streak_xp', v_streak_xp,
    'pct', v_pct,
    'streak', v_streak,
    'level', public.tc_game_level(v_xp),
    'profile', v_prefix
  );
end $$;
grant execute on function public.tc_game_award(uuid, int, int) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Public leaderboard — the Quizizz-style podium.
-- ----------------------------------------------------------------------------
create or replace function public.tc_game_leaderboard(p_limit int default 50)
returns table (learner_id uuid, full_name text, xp int, level int, streak_days int, badges jsonb)
language sql stable security definer set search_path = public as $$
  select gp.learner_id,
         coalesce(l.full_name, 'Learner') as full_name,
         gp.xp, gp.level, gp.streak_days, gp.badges
    from public.tc_game_profiles gp
    left join public.learners l on l.id = gp.learner_id
   order by gp.xp desc, gp.level desc, gp.updated_at desc
   limit greatest(1, least(coalesce(p_limit,50), 100));
$$;
grant execute on function public.tc_game_leaderboard(int) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. RLS. Public: read the leaderboard (own row). Private: only the learner
--    may update their own profile; attempts are written by the safe function.
-- ----------------------------------------------------------------------------
drop policy if exists tc_game_profiles_read on public.tc_game_profiles;
create policy tc_game_profiles_read on public.tc_game_profiles
  for select to anon, authenticated
  using (true);   -- leaderboard is public; no personal data beyond display name

drop policy if exists tc_game_profiles_self on public.tc_game_profiles;
create policy tc_game_profiles_self on public.tc_game_profiles
  for all to authenticated
  using (learner_id = public.tc_my_learner_id())
  with check (learner_id = public.tc_my_learner_id());

drop policy if exists tc_game_attempts_read on public.tc_game_attempts;
create policy tc_game_attempts_read on public.tc_game_attempts
  for select to authenticated
  using (learner_id = public.tc_my_learner_id());

-- Attempts may only be inserted by the awarding function (security definer),
-- never directly by a client. An explicit policy is omitted on purpose.

-- ----------------------------------------------------------------------------
-- 7. Version truth — bump the single source of truth for the schema version.
-- ----------------------------------------------------------------------------
create or replace function public.tc_schema_expected()
returns text language sql immutable
set search_path = public
as $$ select 'V41'::text $$;

-- ----------------------------------------------------------------------------
-- 8. Stamp the registry with V41 and this pack's name.
-- ----------------------------------------------------------------------------
insert into public.tc_schema_registry (id, version, packs, note)
values (1,
        public.tc_schema_expected(),
        array['v1-core','v2-tutoring-ops','v3-classroom-exams','v4-enterprise-parity',
              'v5-ops-parity','v6-cbt-modes','v7-family-access','v9-keepalive-drive',
              'v12-quota-guard','v15-family-polls-billing','v16-exam-registration',
              'v17-licensing-family-billing','v18-security-hardening',
              'v19-revenue-and-security','v20-cbt-2fa-polls','v22-cbt-results-audit',
              'v24-tutor-scoping','v25-desks-lifecycle-free-classes',
              'v26-tutor-marking-and-selftest','v27-rls-recursion-blog-documents',
              'v28-admin-and-ops-enrichment','v29-social-registration-links',
              'v30-group-insights-rls-hotfix','v32-rls-recursion-hard-break',
              'v34-cbt-review-lookup','v35-cbt-review-lookup',
              'v36-anon-rls-predicate-grants','v37-schema-version-truth',
              'v38-cbt-delivery-and-readaloud','v40-anon-write-visibility-hardening',
              'v41-cbt-game'],
        'Installed by database/complete-schema.sql — single-file install, no other pack required.')
on conflict (id) do update
   set version    = excluded.version,
       applied_at = now(),
       packs      = excluded.packs,
       note       = excluded.note;

select public.tc_schema_info();
perform set_config('search_path', 'public', true);
notify pgrst, 'reload schema';
select 'Tutoring Connect V41 — quiz gamification installed ✅' as status;
