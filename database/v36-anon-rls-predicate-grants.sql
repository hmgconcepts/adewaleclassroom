-- =====================================================================
-- V36 — RLS PREDICATE EXECUTE GRANTS (CRITICAL HOTFIX)
-- Tutoring Connect / generated studios.  Idempotent. Safe to re-run.
-- =====================================================================
--
-- SYMPTOM
--   Every public page (index, apply, public-book, exam-register,
--   free-register, blog, login) logs a wall of HTTP 401s and renders
--   with stock branding, no tutor list, no availability, no licence
--   state.  The REST body is:
--
--     {"code":"42501","message":"permission denied for function is_tutor"}
--
-- ROOT CAUSE
--   The V18/V19 hardening block runs a catalogue-wide loop:
--
--     revoke all on function <every public fn> from public;
--     revoke all on function <every public fn> from anon;
--     grant  execute on function <every public fn> to authenticated;
--
--   ...then re-grants to `anon` only a 7-function allow-list.  That loop
--   is correct for *callable* RPCs, but it also stripped the helper
--   functions that RLS POLICIES themselves call in USING / WITH CHECK.
--
--   In PostgreSQL a policy predicate is executed as the QUERYING role.
--   So when `anon` selects from any table carrying a policy such as
--       using (public.is_admin() or public.is_tutor())
--   Postgres must execute is_tutor() AS anon, has no EXECUTE privilege,
--   and raises 42501.  PostgREST turns that into HTTP 401 and ABORTS the
--   whole request — instead of the intended behaviour, which is for the
--   predicate to simply evaluate FALSE and fall through to the permissive
--   "public read" policy beside it.
--
--   Note the failure mode: this is not "anon sees too little", it is
--   "anon's query errors out entirely", which is why even genuinely
--   public tables (practice_settings, subjects, availability) 401.
--
-- AFFECTED PREDICATES (all 13 were DENIED to anon)
--   is_tutor, is_admin, is_self_learner, is_parent_of, tc_is_manager,
--   tc_my_tutor_id, tc_teaches_engagement, tc_teaches_learner,
--   tc_teaches_session, tc_parent_matches_uid, tc_family_can_see_learner,
--   is_family_of_engagement, is_family_of_learner
--
-- WHY GRANTING THESE TO anon IS SAFE
--   Each is SECURITY DEFINER, takes no user-controlled table name, and
--   resolves purely from auth.uid().  For an anonymous caller auth.uid()
--   is NULL, so every one of them returns FALSE (or NULL) and grants no
--   visibility whatsoever.  They are booleans about the CALLER, not data
--   readers.  Executing them cannot leak a row; being unable to execute
--   them breaks the site.  The actual access decision still rests with
--   the policies and with the SECURITY DEFINER bodies themselves.
--
-- WHAT THIS DOES NOT CHANGE
--   The anon RPC allow-list is untouched.  Staff reporting functions
--   (tc_exam_reg_stats, tc_db_report, tc_security_report, ...) stay
--   revoked from anon and keep their internal is_tutor() re-check.
-- =====================================================================

begin;

do $$
declare
  r record;
  -- Only the helpers that RLS policies invoke as the querying role.
  predicates text[] := array[
    'is_tutor',
    'is_admin',
    'is_self_learner',
    'is_parent_of',
    'tc_is_manager',
    'tc_my_tutor_id',
    'tc_teaches_engagement',
    'tc_teaches_learner',
    'tc_teaches_session',
    'tc_parent_matches_uid',
    'tc_family_can_see_learner',
    'is_family_of_engagement',
    'is_family_of_learner'
  ];
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind  = 'f'
       and p.proname  = any (predicates)
  loop
    -- Both roles: `authenticated` is normally already correct, but a
    -- future blanket revoke must not be able to half-fix this again.
    execute format('grant execute on function %s to anon, authenticated', r.sig);
    raise notice 'V36 granted EXECUTE on % to anon, authenticated', r.sig;
  end loop;
end $$;

commit;


-- ---------------------------------------------------------------------
-- VERIFICATION — every row must read true / true.
-- ---------------------------------------------------------------------
select p.proname                                            as predicate,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon_ok,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_ok
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'is_tutor','is_admin','is_self_learner','is_parent_of','tc_is_manager',
     'tc_my_tutor_id','tc_teaches_engagement','tc_teaches_learner',
     'tc_teaches_session','tc_parent_matches_uid','tc_family_can_see_learner',
     'is_family_of_engagement','is_family_of_learner')
 order by 1;


-- ---------------------------------------------------------------------
-- REGRESSION GUARD
-- Re-run this after ANY future hardening loop.  The loops in V18/V19/V25
-- iterate the whole catalogue, so they will silently re-break RLS unless
-- this file is applied last.  Keep it as the final migration.
-- ---------------------------------------------------------------------
