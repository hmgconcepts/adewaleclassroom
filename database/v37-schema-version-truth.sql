-- =====================================================================
-- V37 — SCHEMA VERSION TRUTH (fixes the false "database is out of date")
-- Tutoring Connect / generated studios.  Idempotent. Safe to re-run.
-- =====================================================================
--
-- SYMPTOM (reported)
--   "Despite running the latest complete schema SQL, I still get:
--      Your database is out of date — it is at V4 but these files expect V9.
--      1 missing function(s); this breaks quiz codes / student-ID sign-in
--      for CBT.  Run: database/v6-cbt-modes.sql"
--
--   Running v6-cbt-modes.sql changes nothing, because nothing was missing.
--   The banner is a FALSE ALARM produced by two independent defects.
--
-- DEFECT 1 — tc_schema_info() disagreed with the schema it ships in.
--   complete-schema.sql upserts tc_schema_registry.version through a series
--   of packs, finishing at 'V29'.  But the last definition of
--   tc_schema_info() hard-codes:
--        'expected', 'V24'   and   'up_to_date', (r.version = 'V24')
--   So a PERFECTLY installed database reports version=V29, expected=V24,
--   up_to_date=false.  assets/js/schema-doctor.js compares
--        v === reg.data.expected
--   which is false, so it abandons the authoritative registry and falls
--   through to guessing by probing individual functions — straight into
--   defect 2.  Two hard-coded strings in two places that must agree, and
--   they had drifted apart. This file removes the possibility of drift.
--
-- DEFECT 2 — the fallback probe asks PostgREST the wrong question.
--   schema-doctor.js probed each function with NO arguments:
--        sb.rpc('tc_cbt_get_exam', {})
--   but the real signature is
--        tc_cbt_get_exam(p_code text, p_student_no text default '')
--   PostgREST cannot resolve a no-argument call and replies:
--        PGRST202 "Searched for the function public.tc_cbt_get_exam without
--        parameters or with a single unnamed json/jsonb parameter, but no
--        matches were found in the schema cache."
--   The doctor tested only for /PGRST202|Could not find the function/ and so
--   declared a function that plainly EXISTS to be missing. Because the probe
--   list stops at the first gap, it then reported the database as "V4".
--   Verified against the live project: every other probe returns 42501
--   (permission denied = present), only this one returns PGRST202.
--   The JS side is fixed in assets/js/schema-doctor.js.
--
-- THE RULE THIS ESTABLISHES
--   There is now exactly ONE place the expected version is written:
--   public.tc_schema_expected().  The registry row and tc_schema_info()
--   both read it, so they cannot disagree again.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Single source of truth for the expected schema version.
--    Bump this ONE literal when a new pack is appended, and nothing else.
-- ---------------------------------------------------------------------
create or replace function public.tc_schema_expected()
returns text language sql immutable
set search_path = public
as $$ select 'V37'::text $$;

-- ---------------------------------------------------------------------
-- 2. Stamp the registry with that same value.
-- ---------------------------------------------------------------------
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
              'v36-anon-rls-predicate-grants','v37-schema-version-truth'],
        'Installed by database/complete-schema.sql — single-file install, no other pack required.')
on conflict (id) do update
   set version    = excluded.version,
       applied_at = now(),
       packs      = excluded.packs,
       note       = excluded.note;

-- ---------------------------------------------------------------------
-- 3. tc_schema_info() now DERIVES expected instead of hard-coding it.
-- ---------------------------------------------------------------------
create or replace function public.tc_schema_info()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ok',         true,
    'version',    r.version,
    'expected',   public.tc_schema_expected(),
    'up_to_date', (r.version = public.tc_schema_expected()),
    'packs',      r.packs,
    'applied_at', r.applied_at
  ) from public.tc_schema_registry r where r.id = 1;
$$;

grant execute on function public.tc_schema_expected() to anon, authenticated;
grant execute on function public.tc_schema_info()     to authenticated;

commit;


-- ---------------------------------------------------------------------
-- VERIFICATION — up_to_date must be true immediately after install.
-- ---------------------------------------------------------------------
select public.tc_schema_info();


-- ---------------------------------------------------------------------
-- PostgREST caches the schema. A function created seconds ago can be
-- genuinely present and still invisible to the REST API, producing the
-- exact PGRST202 error that started all of this. Always finish here.
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';
