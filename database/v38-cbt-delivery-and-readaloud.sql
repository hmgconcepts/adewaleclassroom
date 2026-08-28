-- =============================================================================
-- V38 — CBT delivery settings: read-aloud flag
-- =============================================================================
-- CONTEXT
-- cbt_exams has carried shuffle_questions and shuffle_options since v20, but
-- no runtime ever read them: the candidate was always served the authored CSV
-- order. V39 of the front end fixes that (CBT.applyDelivery in assets/js/cbt.js
-- is now called by cbt-exam.html), which turns those two columns into live
-- settings for the first time.
--
-- This migration adds the one column the new feature set still needed:
-- read_aloud, the per-paper switch for text to speech.
--
-- WHY A COLUMN AND NOT A JSONB BLOB
-- The alternative was to hide the flag inside the existing `questions` jsonb.
-- Rejected: settings and content would then share one column, every settings
-- change would rewrite the whole question payload, and cbt-results.html's CRUD
-- editor (which binds to real columns) could not expose it. A boolean column
-- costs one byte and keeps the editor, the RPC allow-list and the row-level
-- policies working unchanged.
--
-- SAFE TO RE-RUN. Also folded into database/complete-schema.sql, so a fresh
-- one-click install already contains it.
-- =============================================================================

alter table if exists public.cbt_exams
  add column if not exists read_aloud boolean default true;

comment on column public.cbt_exams.read_aloud is
  'Allow candidates to have questions and options spoken by their own device '
  'using the browser Web Speech API (free, offline, no third-party service). '
  'Set false for listening comprehension or reading-fluency papers, where '
  'hearing the text would invalidate what the paper is measuring.';

comment on column public.cbt_exams.shuffle_questions is
  'Randomise question order per candidate at sitting time. Passage/stimulus '
  'sets are shuffled as whole blocks, never split, so a comprehension passage '
  'always stays with its own questions.';

comment on column public.cbt_exams.shuffle_options is
  'Randomise option order per candidate. Safe: marking compares answer TEXT, '
  'not the A-D letter. Positional options ("All of the above") and True/False '
  'pairs are detected and left in place by assets/js/cbt.js.';

-- The candidate-facing lookup RPC must return the new flag, or the exam page
-- cannot know whether read-aloud is permitted for this paper.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cbt_exams' and column_name = 'read_aloud'
  ) then
    raise notice 'V38: cbt_exams.read_aloud present.';
  end if;
end $$;

notify pgrst, 'reload schema';
