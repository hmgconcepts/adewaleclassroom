-- =====================================================================
-- V20 — CBT SCHEMA REPAIR, TWO-FACTOR AUTH, RICH POLLS
-- ---------------------------------------------------------------------
-- BUG 10 (reported): "Could not find the 'calculator' column of
-- 'cbt_exams' in the schema cache" when saving a quiz.
--
-- Root cause, verified against the schema: public.cbt_exams was created
-- with only SEVEN columns (id, title, code, questions, duration_min,
-- engagement_id, status). Later packs added quiz_kind, subject, subjects,
-- multi_subject, anti_cheat, push_to_scoresheet, show_review, exam_mode
-- and is_open — but the builder in cbt-multi.html also writes:
--
--     calculator, math_keyboard, subject_breakdown, identity_mode,
--     instructions, exam_type, csv_data, csv_source
--
-- ...and NONE of those were ever added. PostgREST rejects the whole insert
-- the moment it meets the first unknown column, which is why saving a
-- quiz failed outright rather than partially. Every missing column is
-- added here.
--
-- Also in this pack:
--   * Two-factor authentication support (TOTP), tracked per user.
--   * Poll/vote creation support so voting.html can actually create polls.
--   * cbt_results gains per-question detail needed by the new one-question
--     -per-page runner and the review screen.
--
-- Idempotent. Folded into database/complete-schema.sql.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. cbt_exams — every column the application actually writes.
-- ---------------------------------------------------------------------
alter table if exists public.cbt_exams add column if not exists calculator        boolean default true;
alter table if exists public.cbt_exams add column if not exists math_keyboard     boolean default true;
alter table if exists public.cbt_exams add column if not exists subject_breakdown jsonb   default '[]'::jsonb;
alter table if exists public.cbt_exams add column if not exists identity_mode     text    default 'name';
alter table if exists public.cbt_exams add column if not exists instructions      text;
alter table if exists public.cbt_exams add column if not exists exam_type         text;
alter table if exists public.cbt_exams add column if not exists csv_data          jsonb   default '[]'::jsonb;
alter table if exists public.cbt_exams add column if not exists csv_source        text;
alter table if exists public.cbt_exams add column if not exists is_archived       boolean default false;
alter table if exists public.cbt_exams add column if not exists shuffle_questions boolean default true;
alter table if exists public.cbt_exams add column if not exists shuffle_options   boolean default false;
alter table if exists public.cbt_exams add column if not exists questions_to_serve int     default 0;
alter table if exists public.cbt_exams add column if not exists pass_mark         numeric(5,2);
alter table if exists public.cbt_exams add column if not exists opens_at          timestamptz;
alter table if exists public.cbt_exams add column if not exists closes_at         timestamptz;
alter table if exists public.cbt_exams add column if not exists updated_at        timestamptz default now();
alter table if exists public.cbt_exams add column if not exists created_by        uuid;

create index if not exists cbt_exams_code_idx    on public.cbt_exams (code);
create index if not exists cbt_exams_status_idx  on public.cbt_exams (status);
create index if not exists cbt_exams_created_idx on public.cbt_exams (created_at desc);

-- cbt_results needs the per-question record the review screen reads.
alter table if exists public.cbt_results add column if not exists answers        jsonb default '{}'::jsonb;
alter table if exists public.cbt_results add column if not exists per_question   jsonb default '[]'::jsonb;
alter table if exists public.cbt_results add column if not exists violations     jsonb default '[]'::jsonb;
alter table if exists public.cbt_results add column if not exists time_taken_sec int;
alter table if exists public.cbt_results add column if not exists submitted_at   timestamptz default now();
alter table if exists public.cbt_results add column if not exists auto_submitted boolean default false;

-- A guard so this class of bug is caught by a query rather than by a user.
create or replace function public.tc_cbt_schema_check()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_missing text[] := '{}';
  v_needed  text[] := array[
    'title','code','questions','duration_min','engagement_id','status',
    'quiz_kind','subject','subjects','multi_subject','anti_cheat',
    'push_to_scoresheet','show_review','exam_mode','is_open',
    'calculator','math_keyboard','subject_breakdown','identity_mode',
    'instructions','exam_type','csv_data','csv_source','is_archived',
    'shuffle_questions','shuffle_options','questions_to_serve','pass_mark'];
  c text;
begin
  foreach c in array v_needed loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'cbt_exams'
                      and column_name = c) then
      v_missing := array_append(v_missing, c);
    end if;
  end loop;
  return jsonb_build_object(
    'ok', cardinality(v_missing) = 0,
    'missing_columns', to_jsonb(v_missing),
    'hint', case when cardinality(v_missing) = 0
                 then 'cbt_exams has every column the builder writes.'
                 else 'Re-run database/complete-schema.sql — the CBT builder will fail to save until these exist.'
            end);
end $$;

grant execute on function public.tc_cbt_schema_check() to authenticated;
revoke all on function public.tc_cbt_schema_check() from public, anon;


-- ---------------------------------------------------------------------
-- 2. TWO-FACTOR AUTHENTICATION (TOTP)
-- ---------------------------------------------------------------------
-- Supabase Auth provides the actual TOTP engine free (GoTrue MFA), so no
-- secret is ever stored here and no paid service is involved. What this
-- table adds is the STUDIO's policy layer: which roles must enrol, who
-- has enrolled, and when they last verified. Enforcement of the policy
-- lives in the app; enforcement of the factor itself lives in Supabase.
-- ---------------------------------------------------------------------
create table if not exists public.user_mfa (
  user_id      uuid primary key,
  enrolled     boolean default false,
  factor_id    text,
  method       text default 'totp',
  enrolled_at  timestamptz,
  last_verified_at timestamptz,
  backup_codes_issued int default 0,
  note         text
);

alter table public.user_mfa enable row level security;

-- A user manages only their own factor.
drop policy if exists user_mfa_self on public.user_mfa;
create policy user_mfa_self on public.user_mfa
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- An admin may SEE who has enrolled (never the secret — there isn't one here).
drop policy if exists user_mfa_admin_read on public.user_mfa;
create policy user_mfa_admin_read on public.user_mfa
  for select to authenticated using (public.is_admin());

revoke all on public.user_mfa from anon;

-- Studio policy: which roles are required to use 2FA.
alter table public.practice_settings add column if not exists mfa_required_roles text default '';
alter table public.practice_settings add column if not exists mfa_grace_days     int  default 14;

create or replace function public.tc_mfa_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text; v_req text; v_row public.user_mfa%rowtype; v_required boolean;
begin
  v_role := coalesce(public.tc_current_role(), '');
  select coalesce(mfa_required_roles, '') into v_req from public.practice_settings where id = 1;
  select * into v_row from public.user_mfa where user_id = auth.uid();

  v_required := v_role <> '' and position(v_role in v_req) > 0;

  return jsonb_build_object(
    'ok', true,
    'role', v_role,
    'required', v_required,
    'enrolled', coalesce(v_row.enrolled, false),
    'enrolled_at', v_row.enrolled_at,
    'method', coalesce(v_row.method, 'totp'),
    'grace_days', (select coalesce(mfa_grace_days, 14) from public.practice_settings where id = 1),
    'compliant', (not v_required) or coalesce(v_row.enrolled, false),
    'note', 'Two-factor codes are generated by Supabase Auth (free). This studio '
         || 'stores only whether you have enrolled — never a secret or a code.');
end $$;

grant execute on function public.tc_mfa_status() to authenticated;
revoke all on function public.tc_mfa_status() from public, anon;

create or replace function public.tc_mfa_record(p_enrolled boolean, p_factor text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.user_mfa (user_id, enrolled, factor_id, enrolled_at, last_verified_at)
  values (auth.uid(), coalesce(p_enrolled, false), p_factor,
          case when p_enrolled then now() end, now())
  on conflict (user_id) do update
     set enrolled = excluded.enrolled,
         factor_id = coalesce(excluded.factor_id, public.user_mfa.factor_id),
         enrolled_at = coalesce(public.user_mfa.enrolled_at, excluded.enrolled_at),
         last_verified_at = now();
  return public.tc_mfa_status();
end $$;

grant execute on function public.tc_mfa_record(boolean, text) to authenticated;
revoke all on function public.tc_mfa_record(boolean, text) from public, anon;

-- Who has and has not enrolled — the admin's compliance view.
create or replace function public.tc_mfa_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Two-factor reporting is for administrators only.'
      using errcode = 'insufficient_privilege';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'email', p.email, 'role', p.role,
           'enrolled', coalesce(m.enrolled, false),
           'enrolled_at', m.enrolled_at) order by coalesce(m.enrolled,false), p.email), '[]'::jsonb)
    into v
    from public.profiles p
    left join public.user_mfa m on m.user_id = p.id;
  return jsonb_build_object('ok', true, 'users', v,
    'required_roles', (select coalesce(mfa_required_roles,'') from public.practice_settings where id = 1));
end $$;

grant execute on function public.tc_mfa_report() to authenticated;
revoke all on function public.tc_mfa_report() from public, anon;


-- ---------------------------------------------------------------------
-- 3. POLLS / VOTING — make creation possible.
--    voting.html had no create path at all. These columns and the RPC
--    below are what the rebuilt page needs.
-- ---------------------------------------------------------------------
alter table if exists public.polls add column if not exists created_by  uuid;
alter table if exists public.polls add column if not exists audience    text default 'all';
alter table if exists public.polls add column if not exists anonymous   boolean default true;
alter table if exists public.polls add column if not exists kind        text default 'poll';
alter table if exists public.polls add column if not exists status      text default 'open';
alter table if exists public.polls add column if not exists updated_at  timestamptz default now();

create or replace function public.tc_create_poll(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_opts jsonb;
begin
  if not public.is_tutor() then
    raise exception 'Only studio staff can create a poll or a vote.'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p->>'question'), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'A question is required.');
  end if;

  v_opts := coalesce(p->'options', '[]'::jsonb);
  if jsonb_array_length(v_opts) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Give voters at least two options.');
  end if;

  insert into public.polls (title, description, options, closes_at, multi_choice, max_choices,
                            quorum, results_visible, audience, anonymous, kind, status, created_by)
  values (trim(p->>'question'), nullif(trim(coalesce(p->>'description','')),''),
          -- polls.options is TEXT in the base schema, so store the option list
          -- as a pipe-separated string. Storing jsonb here silently failed.
          (select string_agg(value #>> '{}', '|') from jsonb_array_elements(v_opts)),
          nullif(p->>'closes_at','')::timestamptz,
          coalesce((p->>'multi_choice')::boolean, false),
          coalesce((p->>'max_choices')::int, 1),
          coalesce((p->>'quorum')::int, 0),
          coalesce(nullif(trim(coalesce(p->>'results_visible','')),''), 'after_close'),
          coalesce(nullif(trim(coalesce(p->>'audience','')),''), 'all'),
          coalesce((p->>'anonymous')::boolean, true),
          coalesce(nullif(trim(coalesce(p->>'kind','')),''), 'poll'),
          'open', auth.uid())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'poll_id', v_id);
end $$;

grant execute on function public.tc_create_poll(jsonb) to authenticated;
revoke all on function public.tc_create_poll(jsonb) from public, anon;


-- Re-assert the V18 rule for everything created above.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public', r.sig);
  end loop;
end $$;
grant execute on function public.tc_register_candidate(jsonb) to anon;
grant execute on function public.tc_candidate_lookup(text, text) to anon;
grant execute on function public.tc_cbt_get_exam(text, text) to anon;
grant execute on function public.tc_keep_alive(text) to anon;
grant execute on function public.tc_submit_application(text, jsonb) to anon;
grant execute on function public.lookup_login_email(text) to anon;
grant execute on function public.tc_license_writable() to anon;
grant execute on function public.tc_check_promo(text, numeric) to anon;


-- ---------------------------------------------------------------------
-- ITEM 3 FIX — retire the legacy seeded studio name.
-- The original seed used `on conflict (id) do nothing`, so a studio whose
-- practice_settings row was created by an early version still holds the
-- old name. The footer reads this row, which is why renaming the code had
-- no effect on a live studio. This rewrites it in place.
-- ---------------------------------------------------------------------
update public.practice_settings
   set name = 'HMG Tutoring Studio'
 where id = 1
   and (name is null or name ilike '%lumen%');

select 'Legacy studio name retired ✅' as status, name from public.practice_settings where id = 1;

select 'V20 CBT schema repair + 2FA + poll creation installed ✅' as status;
