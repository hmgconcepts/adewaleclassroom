-- ═══════════════════════════════════════════════════════════════════════
-- V48 — NOTIFICATION DEEP LINKS (round 12, item 3)
--
-- Field report: "when I clicked on the notification bell at the top, it
-- should show notifications of an unread message but when I clicked on
-- this particular message, it didn't take me directly to the message
-- page."
--
-- Root cause: the bell dropdown navigates using the notification's url
-- column — but the two writers that matter never set it:
--   · tc_message_send (v44) inserts (user_id, title, body) only, so
--     every "New message from …" notification was a dead end;
--   · tc_notify_cbt_submission writes a `link` column the bell never
--     reads (url and link mean the same thing here — v48 standardises
--     on url and keeps link in sync for any older consumer).
--
-- This migration:
--   1. rewrites both functions so every notification they raise carries
--      a working url;
--   2. backfills the url for legacy rows already in the database
--      (message notifications → the Messages page, CBT submissions →
--      the CBT results page), so old notifications become clickable
--      too, not just new ones.
--
-- Idempotent: create-or-replace + guarded updates; safe to run twice.
-- ═══════════════════════════════════════════════════════════════════════

-- UPGRADE-ORDER GUARD (round-9 field-fix class): the url/kind/link columns
-- are added by complete-schema.sql's base section, but a legacy database
-- running THIS file standalone (migrations chain only) has none of them
-- yet — and the function bodies below would then fail at CALL time with
-- "column url does not exist". Guarantee them here; no-ops where present.
alter table public.notifications add column if not exists url      text;
alter table public.notifications add column if not exists kind     text;
alter table public.notifications add column if not exists audience text default 'all';
alter table public.notifications add column if not exists link     text;

-- 1. tc_message_send — the recipient's notification now carries the page.
create or replace function public.tc_message_send(p_to uuid, p_subject text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  tgt public.profiles%rowtype;
  mid uuid;
  myname text;
begin
  if me is null then raise exception 'Please sign in first.'; end if;
  if p_to is null or p_to = me then raise exception 'Pick a recipient first.'; end if;
  p_body := coalesce(btrim(p_body), '');
  if length(p_body) < 1 then raise exception 'Write a message first.'; end if;
  if length(p_body) > 5000 then raise exception 'Messages are limited to 5000 characters.'; end if;
  if length(coalesce(p_subject, '')) > 200 then p_subject := left(p_subject, 200); end if;

  select * into tgt from public.profiles where id = p_to;
  if tgt.id is null then raise exception 'That recipient no longer has an account.'; end if;

  if not public.is_admin() and not public.is_tutor() then
    /* Families may write to staff only — that is the whole point of item 5. */
    if tgt.role not in ('admin','owner','director','lead_tutor','super_admin','tutor','staff') then
      raise exception 'You can message your tutors and the admins from here.';
    end if;
  elsif public.is_tutor() and not public.is_admin() then
    /* Tutors: staff anyone; families only when linked to their engagements
       or when a thread already exists (so replies always work). */
    if tgt.role not in ('admin','owner','director','lead_tutor','super_admin','tutor','staff') then
      if not exists (
          select 1
            from public.engagements e
            join public.tutors tt on tt.id = e.tutor_id and tt.user_id = me
            join public.engagement_members em on em.engagement_id = e.id
            join public.learners l on l.id = em.learner_id
            left join public.parent_learner pl on pl.learner_id = l.id
            left join public.parents par on par.id = pl.parent_id
           where l.user_id = p_to or par.user_id = p_to)
        and not exists (
          select 1 from public.messages m
           where (m.sender = p_to and m.recipient = me)
              or (m.sender = me and m.recipient = p_to)) then
        raise exception 'You can message staff and the families of your own classes.';
      end if;
    end if;
  end if;

  select coalesce(full_name, email, 'Member') into myname from public.profiles where id = me;

  insert into public.messages (sender, recipient, to_role, subject, body, sender_name)
    values (me, p_to, tgt.role, coalesce(p_subject, ''), p_body, myname)
    returning id into mid;

  /* V48: the bell notification now deep-links to the conversation. */
  insert into public.notifications (user_id, title, body, url)
    values (p_to, 'New message from ' || myname, left(p_body, 140), 'messages.html');

  return mid;
end $$;

-- 2. tc_notify_cbt_submission — url (what the bell reads) alongside link.
create or replace function public.tc_notify_cbt_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_title text; v_pct numeric; v_who text;
begin
  select title into v_title from public.cbt_exams where id = new.exam_id;
  v_pct := case when coalesce(new.max_score, 0) > 0
                then round(100.0 * coalesce(new.score, 0) / new.max_score, 1) end;
  v_who := coalesce(new.candidate_name, 'An anonymous candidate');

  begin
    insert into public.notifications (title, body, kind, audience, link, url, created_at)
    values (
      'CBT submitted: ' || coalesce(v_title, 'a quiz'),
      v_who || ' scored ' || coalesce(new.score, 0)::text || '/' ||
        coalesce(new.max_score, 0)::text ||
        case when v_pct is not null then ' (' || v_pct::text || '%)' else '' end ||
        case when coalesce(jsonb_array_length(coalesce(new.violations, '[]'::jsonb)), 0) > 0
             then ' — ' || jsonb_array_length(new.violations)::text || ' integrity flag(s)'
             else '' end,
      'cbt_result', 'staff',
      'cbt-results.html?exam=' || coalesce(new.exam_id::text, ''),
      'cbt-results.html?exam=' || coalesce(new.exam_id::text, ''),
      now());
  exception when others then
    -- Never let a notification failure block a candidate's submission.
    null;
  end;
  return new;
end $$;

-- 3. Backfill: legacy notifications become clickable too.
update public.notifications
   set url = 'messages.html'
 where url is null
   and title like 'New message from %';

update public.notifications
   set url = coalesce(link, 'cbt-results.html')
 where url is null
   and coalesce(kind, '') = 'cbt_result';

-- PostgREST: make the new function bodies visible immediately.
notify pgrst, 'reload schema';

select 'V48 notification deep links installed ✅' as status;
