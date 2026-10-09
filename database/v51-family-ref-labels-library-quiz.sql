-- ═══════════════════════════════════════════════════════════════════════
-- V51 — FAMILY REF LABELS + DIGITAL-LIBRARY QUIZ + CLOUD LAST-BACKUP
-- (round 15)
--
-- Field reports this migration fixes:
--
--   ITEMS 2–5 — on the STUDENT portal, every shelf page (Mini LMS,
--   Digital library, Resource library, E-resources) still showed
--   "🔗 Link names are not loading from engagements" and every Class /
--   group / cohort cell read "linked · name unavailable" — even after
--   the staff side was fixed. Root cause: the link-name lookup loads the
--   engagements TABLE through row-level security, and the learner read
--   path returned an empty map for these accounts, while the shelf rows
--   themselves stayed visible through the family policy. The V50
--   tc_ref_labels() fallback returned {} for non-staff, so it could not
--   rescue them. Fix: tc_ref_labels() v2 is ROLE-AWARE — a learner gets
--   the id→name map of exactly the engagements they are a member of
--   (same predicate as the shelf visibility that provably works), and a
--   parent gets their children's. Name resolution no longer depends on
--   the engagements table's SELECT policy at all.
--
--   ITEM 8 — Digital library readings with comprehension questions
--   (GOSA deep-study): library_items gain instructions, due date, max
--   score, attempt limit, an optional linked CBT code and a questions
--   JSONB; a new library_quiz_attempts table records each learner's
--   auto-marked attempt. Scores accumulate per class + subject for the
--   points workbench on the library page.
--
--   ITEM 1 — "Last backup: never" although backups had been taken:
--   the timestamp lived in localStorage (per device!) and the cloud-side
--   Drive timestamp was never read by the card. practice_settings gains
--   last_backup_at — the cloud truth every device reads.
--
-- Idempotent: create-or-replace / add-if-not-exists throughout.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. tc_ref_labels() v2 — role-aware link-name resolution.
--    staff  → full maps (exactly as V50)
--    family → engagements they can legitimately see: the SAME membership
--             predicate that lets them read the shelf rows in the first
--             place, so a name is resolvable whenever its row is visible.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tc_ref_labels(p_table text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_staff boolean;
begin
  select public.is_tutor() into v_staff;

  if v_staff then
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
        return '{}'::jsonb;
    end case;
  end if;

  -- Family (learner / parent): only the engagements behind the rows they
  -- can already see. Studio-wide rows (engagement_id null) need no label.
  if lower(coalesce(p_table, '')) = 'engagements' then
    return coalesce((
      select jsonb_object_agg(e.id, e.name)
        from public.engagements e
       where exists (
         select 1
           from public.engagement_members em
           join public.learners l on l.id = em.learner_id
          where em.engagement_id = e.id
            and coalesce(em.status, 'active') = 'active'
            and (l.user_id = auth.uid() or public.is_parent_of(l.id))
       )
    ), '{}'::jsonb);
  end if;

  return '{}'::jsonb;
end $$;

grant execute on function public.tc_ref_labels(text) to authenticated;
revoke all on function public.tc_ref_labels(text) from public, anon;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Digital library readings carry comprehension questions (GOSA
--    deep-study, item 8): the reading itself gains the teacher-authored
--    quiz fields; a new table stores each learner's auto-marked attempt.
-- ─────────────────────────────────────────────────────────────────────
alter table if exists public.library_items
  add column if not exists instructions     text,
  add column if not exists due_date         date,
  add column if not exists max_score        numeric default 10,
  add column if not exists attempts_allowed int default 1,
  add column if not exists questions        jsonb default '[]'::jsonb,
  add column if not exists has_quiz         boolean default false,
  add column if not exists cbt_code         text;

create table if not exists public.library_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.library_items(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  score numeric not null default 0,
  max_score numeric not null default 0,
  answers jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists library_attempts_item_idx    on public.library_quiz_attempts (item_id);
create index if not exists library_attempts_learner_idx on public.library_quiz_attempts (learner_id);

alter table public.library_quiz_attempts enable row level security;

drop policy if exists library_attempts_staff_read on public.library_quiz_attempts;
create policy library_attempts_staff_read on public.library_quiz_attempts
  for select to authenticated using (public.is_tutor());

drop policy if exists library_attempts_family_read on public.library_quiz_attempts;
create policy library_attempts_family_read on public.library_quiz_attempts
  for select to authenticated
  using (public.is_self_learner(learner_id) or public.is_parent_of(learner_id));

drop policy if exists library_attempts_own_insert on public.library_quiz_attempts;
create policy library_attempts_own_insert on public.library_quiz_attempts
  for insert to authenticated with check (public.is_self_learner(learner_id));

grant select, insert on public.library_quiz_attempts to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Cloud truth for "Last backup" (item 1): practice_settings gains
--    last_backup_at. Written by the admin-data backup buttons (local
--    download AND Google Drive), read by every device — the card can
--    never again say "never" just because it is a different device.
-- ─────────────────────────────────────────────────────────────────────
alter table if exists public.practice_settings
  add column if not exists last_backup_at timestamptz;

-- PostgREST: make the new policy bodies and the table visible immediately.
notify pgrst, 'reload schema';

select 'V51 family ref labels + library quiz + cloud last-backup installed ✅' as status;
