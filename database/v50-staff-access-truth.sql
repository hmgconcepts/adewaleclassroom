-- ═══════════════════════════════════════════════════════════════════════
-- V50 — STAFF ACCESS TRUTH FIX + LINK-NAME FALLBACK + PUBLISH-BY-DEFAULT
-- (round 14)
--
-- Field reports this migration fixes:
--
--   ITEMS 4–7 — "linked · name unavailable" on E-resources, Mini LMS,
--   Digital library and Resource library, despite the rows being linked.
--   THE REAL ROOT CAUSE (v49 only fixed half of it):
--     · public.profiles.status DEFAULTS TO 'pending' — not NULL. v49's
--       coalesce(status,'approved') therefore did nothing for the many
--       staff accounts whose status is the untouched signup default.
--     · the engagements READ policy called is_tutor() ONLY — an owner or
--       admin (who CAN create shelf items, because the write policies
--       also accept is_admin(), which has no status gate) could NOT read
--       the engagements table at all. Row Level Security does not error
--       in that case — it silently returns ZERO rows — so the CRUD link
--       map came back empty and every linked row rendered as
--       "linked · name unavailable".
--   Fixes:
--     a) is_tutor() v2: MANAGER roles (owner, admin, director,
--        super_admin, lead_tutor) are never status-gated — there is no
--        one above an owner to approve them. Operational roles (tutor,
--        staff, teacher, instructor) pass on NULL / '' / whitespace /
--        approved / active; 'pending' and 'suspended' still require
--        approval, exactly as the approvals workflow intends.
--     b) tc_is_manager() v2: same never-gate for manager roles.
--     c) engagements_read now also accepts is_admin().
--     d) NEW tc_ref_labels(p_table): a security-definer RPC that returns
--        id → label maps for engagements / subjects / tutors / learners
--        to any approved staff member. crud.js calls it as a FALLBACK
--        whenever a ref table reads back empty, so link NAMES can never
--        go dark again even if some future policy regresses.
--
--   ITEM 5 — Mini LMS items "don't appear on the assigned students'
--   portal": every lesson was saved with status 'draft' (the old table
--   default AND the first option of the old form select), and drafts are
--   deliberately invisible to families. New lessons now default to
--   'published' (the form's default order changed too), and the staff
--   list shows a one-click Publish action plus an amber draft badge.
--   Existing rows are NOT touched — publish them from the list.
--
-- Idempotent: create-or-replace / drop-if-exists throughout.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. is_tutor() v2 — the status gate now has the right semantics per
--    role class. Manager roles are the studio's own authorities: never
--    gated. Operational roles keep the approval workflow, but a NULL or
--    blank status means "created before the workflow existed" → allowed.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.is_tutor()
returns boolean language plpgsql stable security definer as $$
declare
  v_role   text;
  v_status text;
begin
  select lower(p.role), lower(coalesce(p.status, '')) into v_role, v_status
    from public.profiles p where p.id = auth.uid();
  if v_role is null then return false; end if;

  -- Manager roles: never status-gated. An owner/admin/director is the
  -- authority that would do the approving — blocking them on their own
  -- un-approval is a deadlock (the round-14 field report).
  if v_role in ('admin','owner','director','super_admin','lead_tutor') then
    return true;
  end if;

  -- Operational roles: approval workflow applies, but legacy rows
  -- (NULL / '' status) count as approved, and 'teacher' / 'instructor'
  -- are honoured alongside 'tutor' / 'staff'.
  if v_role in ('tutor','staff','teacher','instructor') then
    return v_status in ('', 'approved', 'active');
  end if;

  return false;
end $$;

-- tc_is_manager() v2: manager roles are never status-gated (they are
-- the studio's own authorities — see is_tutor() v2 above).
create or replace function public.tc_is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid()
       and lower(p.role) in ('admin','owner','director','super_admin','lead_tutor')
  );
$$;

-- The recreated engagements_read policy calls these two family helpers.
-- They are create-or-replace copies of the definitions in the base schema
-- so this migration also runs STANDALONE on a legacy database (where no
-- earlier migration has created them yet).
create or replace function public.is_self_learner(p_learner uuid)
returns boolean language plpgsql stable security definer as $H$
begin
  return exists (
    select 1 from public.learners l
    where l.id = p_learner and l.user_id = auth.uid()
  );
end $H$;

create or replace function public.is_parent_of(p_learner uuid)
returns boolean language plpgsql stable security definer as $H$
begin
  return exists (
    select 1 from public.parent_learner pl
    join public.parents par on par.id = pl.parent_id
    where pl.learner_id = p_learner and par.user_id = auth.uid()
  );
end $H$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. engagements_read: an admin/owner reads the class list too. (They
--    always could WRITE the shelves — the asymmetry was the bug.)
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists engagements_read on public.engagements;
create policy engagements_read on public.engagements for select using (
  public.is_admin() or public.is_tutor() or exists (
    select 1 from public.engagement_members em
    where em.engagement_id = engagements.id
      and (public.is_self_learner(em.learner_id) or public.is_parent_of(em.learner_id))
  )
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. tc_ref_labels(p_table) — the link-name fallback RPC.
--    Returns {id: label} for the reference tables the CRUD pages link
--    against, to any approved staff member (is_tutor() v2 semantics).
--    Non-staff callers get an empty object. SECURITY DEFINER so it can
--    read the tables regardless of a broken/regressed SELECT policy —
--    that is the entire point: link names must never go dark.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tc_ref_labels(p_table text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_tutor() then
    return '{}'::jsonb;
  end if;
  case lower(coalesce(p_table, ''))
    when 'engagements' then
      return coalesce((select jsonb_object_agg(id, name) from public.engagements), '{}'::jsonb);
    when 'subjects' then
      return coalesce((select jsonb_object_agg(id, name) from public.subjects), '{}'::jsonb);
    when 'tutors' then
      return coalesce((select jsonb_object_agg(id, full_name) from public.tutors), '{}'::jsonb);
    when 'learners' then
      return coalesce((select jsonb_object_agg(id, full_name) from public.learners), '{}'::jsonb);
    when 'parents' then
      return coalesce((select jsonb_object_agg(id, full_name) from public.parents), '{}'::jsonb);
    else
      return '{}'::jsonb;   -- unknown table: nothing (caller shows honest labels)
  end case;
end $$;

grant execute on function public.tc_ref_labels(text) to authenticated;
revoke all on function public.tc_ref_labels(text) from public, anon;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Mini LMS: new lessons are VISIBLE by default. The draft workflow
--    stays (set status='draft' on the row, or unpublish from the list);
--    the trap was that 'draft' was the silent default for every add.
--    Existing rows are deliberately untouched.
-- ─────────────────────────────────────────────────────────────────────
alter table public.lms_lessons alter column status set default 'published';

-- PostgREST: make the new policies and function bodies visible immediately.
notify pgrst, 'reload schema';

select 'V50 staff access truth + link-name fallback + publish-by-default installed ✅' as status;
