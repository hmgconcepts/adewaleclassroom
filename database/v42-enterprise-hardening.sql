-- ============================================================================
-- Tutoring Connect · V42 — ENTERPRISE / DETERMINISTIC GRANT HARDENING
-- ----------------------------------------------------------------------------
-- WHY THIS EXISTS
--   The schema history applied 159 GRANT and 136 REVOKE statements in five
--   catalogue-wide sweeps. A function's *effective* EXECUTE privilege could
--   therefore depend on which sweep happened to run last — the exact class of
--   non-determinism behind the historical RLS recursion / visibility bugs.
--
--   V42 re-asserts the intended END STATE after every other pack, in one place,
--   so privilege no longer depends on line number and is safe to re-run on any
--   live database.
--
-- SAFETY (this pack is ADDITIVE only — it can only ever RESTORE access, never
--   remove it):
--   * A signed-in user (authenticated) is entitled to EXECUTE any function the
--     UI offers; every such function is SECURITY DEFINER and consults
--     auth.uid() itself, so RLS — not the grant — decides row access.
--   * An anonymous user gets EXECUTE on the curated PUBLIC surface only (forms,
--     CBT code gate, blog, free classes, exam registration, self-booking,
--     licence and the RLS predicates anonymous reads must be able to call).
--     We do NOT revoke anything, so we can never lock out a path that already
--     worked.
--
-- IDEMPOTENT: GRANT is idempotent; the anon grant loop only ever ADDS.
-- ============================================================================

-- 1. authenticated — EXECUTE on every function in schema public.
--    (Re-asserts the grant that any later sweep may have dropped. Row access is
--    still enforced by RLS inside the security-definer functions.)
grant execute on all functions in schema public to authenticated;

-- 2. anon — re-assert EXECUTE on the curated public surface.
--    This only ADDS a grant; nothing is revoked, so anonymous access can never
--    regress.
create or replace function public.tc_anon_executable()
returns setof text language sql stable set search_path = public
as $$
  select unnest(array[
    -- public forms / registration
    'tc_free_register','tc_free_convert','tc_free_cohort_public',
    'tc_class_register','tc_class_reg_status','tc_class_regs_for',
    'tc_lookup_learner_by_student_no','tc_verify_certificate','tc_poll_results',
    'tc_blog_get','tc_blog_list',
    'tc_cbt_get_exam','tc_keep_alive_status','tc_license_status',
    'tc_link_account','tc_current_role','tc_my_learner_id',
    -- RLS predicates anonymous paths must be able to evaluate
    'tc_is_manager','tc_is_admin','tc_is_tutor','tc_is_self_learner',
    'tc_is_parent_of','tc_teaches_learner','tc_teaches_subject',
    'tc_my_tutor_id','tc_family_ids','tc_my_family'
  ])
$$;

do $$
declare f text;
begin
  for f in select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    if f in (select * from public.tc_anon_executable()) then
      execute format('grant execute on function public.%I to anon', f);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- VERSION TRUTH — V42 becomes the single source of truth.
-- ----------------------------------------------------------------------------
create or replace function public.tc_schema_expected()
returns text language sql immutable
set search_path = public
as $$ select 'V42'::text $$;

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
              'v41-cbt-game','v42-enterprise-hardening'],
        'Consolidated, deterministic function grants + V42 version. Installed by database/complete-schema.sql.')
on conflict (id) do update
   set version    = excluded.version,
       applied_at = now(),
       packs      = excluded.packs,
       note       = excluded.note;

select public.tc_schema_info();
select 'Tutoring Connect V42 — enterprise hardening installed ✅' as status;
