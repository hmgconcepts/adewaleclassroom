-- ═══════════════════════════════════════════════════════════════════════
-- V44 — REAL IN-PORTAL MESSAGING (round-8 item 5)
-- Students and parents could NOT actually message the tutor or admin
-- before: the old `messages` table was a one-way note drop (`to_role` only,
-- no recipient, no threads, no read state) and the Messaging page was a
-- staff-only WhatsApp/mailto link helper. This migration turns it into a
-- proper two-way threaded inbox:
--   • messages.recipient  — real person-to-person routing
--   • messages.sender_name — display name kept for sender convenience
--   • messages.read_at    — read receipts (mark-on-open)
--   • tc_message_send()   — validated send + automatic notification row
--   • tc_message_threads() — inbox list (last message + unread count)
--   • tc_message_thread()  — full conversation, marks it read
--   • tc_message_unread()  — badge counter
--   • tc_message_directory() — who YOU may message:
--       learner/parent → tutors + admins ("message the tutor and/or admin")
--       tutor          → staff + the families of their own engagements
--       admin          → everyone with an account
-- All access flows through security-definer RPCs so RLS stays airtight;
-- the table itself is never queried directly by the client.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.messages add column if not exists recipient uuid;
alter table public.messages add column if not exists sender_name text;
alter table public.messages add column if not exists read_at timestamptz;
create index if not exists messages_pair_idx on public.messages (sender, recipient, created_at);
create index if not exists messages_recipient_idx on public.messages (recipient, read_at);

create or replace function public.tc_message_directory()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  out jsonb;
begin
  if me is null then return '[]'::jsonb; end if;

  if public.is_admin() then
    /* Admins may reach everyone who has an account. */
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', x.id, 'name', x.name, 'role', x.role) order by x.name), '[]'::jsonb)
      into out
      from (
        select p.id as id, coalesce(p.full_name, p.email, 'Member') as name, p.role as role
          from public.profiles p
         where p.id <> me and coalesce(p.status, 'approved') in ('approved', 'active')
        union
        select l.user_id, coalesce(l.full_name, p2.full_name, 'Learner'), 'learner'
          from public.learners l
          join public.profiles p2 on p2.id = l.user_id
         where l.user_id is not null
        union
        select par.user_id, coalesce(par.full_name, p3.full_name, 'Parent'), 'parent'
          from public.parents par
          join public.profiles p3 on p3.id = par.user_id
         where par.user_id is not null
      ) x;

  elsif public.is_tutor() then
    /* Tutors: fellow staff + the learners/parents of their own engagements. */
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', x.id, 'name', x.name, 'role', x.role) order by x.name), '[]'::jsonb)
      into out
      from (
        select p.id as id, coalesce(p.full_name, p.email, 'Member') as name, p.role as role
          from public.profiles p
         where p.id <> me
           and p.role in ('admin','owner','director','lead_tutor','super_admin','tutor','staff')
           and coalesce(p.status, 'approved') in ('approved', 'active')
        union
        select l.user_id, coalesce(l.full_name, p2.full_name, 'Learner'), 'learner'
          from public.engagements e
          join public.tutors t on t.id = e.tutor_id and t.user_id = me
          join public.engagement_members em on em.engagement_id = e.id
          join public.learners l on l.id = em.learner_id
          join public.profiles p2 on p2.id = l.user_id
         where l.user_id is not null
        union
        select par.user_id, coalesce(par.full_name, p3.full_name, 'Parent'), 'parent'
          from public.engagements e
          join public.tutors t on t.id = e.tutor_id and t.user_id = me
          join public.engagement_members em on em.engagement_id = e.id
          join public.learners l on l.id = em.learner_id
          join public.parent_learner pl on pl.learner_id = l.id
          join public.parents par on par.id = pl.parent_id
          join public.profiles p3 on p3.id = par.user_id
         where par.user_id is not null
      ) x;

  else
    /* Learners and parents: every approved staff member (tutor and/or admin). */
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id, 'name', coalesce(p.full_name, p.email, 'Staff'), 'role', p.role)
             order by coalesce(p.full_name, p.email, 'Staff')), '[]'::jsonb)
      into out
      from public.profiles p
     where p.id <> me
       and p.role in ('admin','owner','director','lead_tutor','super_admin','tutor','staff')
       and coalesce(p.status, 'approved') in ('approved', 'active');
  end if;

  return coalesce(out, '[]'::jsonb);
end $$;

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

  insert into public.notifications (user_id, title, body)
    values (p_to, 'New message from ' || myname, left(p_body, 140));

  return mid;
end $$;

create or replace function public.tc_message_threads()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'other', o.id,
             'other_name', coalesce(p.full_name, p.email, 'Member'),
             'role', coalesce(p.role, ''),
             'unread', o.unread,
             'last_at', to_char(o.last_at, 'YYYY-MM-DD HH24:MI'),
             'last_body', left(o.last_body, 90)
           ) order by o.last_at desc), '[]'::jsonb)
  from (
    select case when m.sender = auth.uid() then m.recipient else m.sender end as id,
           count(*) filter (where m.recipient = auth.uid() and m.read_at is null) as unread,
           max(m.created_at) as last_at,
           (array_agg(m.body order by m.created_at desc))[1] as last_body
      from public.messages m
     where m.sender = auth.uid() or m.recipient = auth.uid()
     group by 1
  ) o
  left join public.profiles p on p.id = o.id
  where o.id is not null;
$$;

create or replace function public.tc_message_thread(p_other uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  out jsonb;
begin
  if me is null or p_other is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', m.id,
             'mine', m.sender = me,
             'sender_name', coalesce(m.sender_name, 'Member'),
             'subject', coalesce(m.subject, ''),
             'body', m.body,
             'at', to_char(m.created_at, 'YYYY-MM-DD HH24:MI'),
             'read', m.read_at is not null
           ) order by m.created_at), '[]'::jsonb)
    into out
    from public.messages m
   where (m.sender = me and m.recipient = p_other)
      or (m.sender = p_other and m.recipient = me);

  update public.messages
     set read_at = now()
   where recipient = me and sender = p_other and read_at is null;

  return out;
end $$;

create or replace function public.tc_message_unread()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.messages
   where recipient = coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     and read_at is null;
$$;

grant execute on function public.tc_message_directory() to authenticated;
grant execute on function public.tc_message_send(uuid, text, text) to authenticated;
grant execute on function public.tc_message_threads() to authenticated;
grant execute on function public.tc_message_thread(uuid) to authenticated;
grant execute on function public.tc_message_unread() to authenticated;
revoke all on function public.tc_message_directory() from public, anon;
revoke all on function public.tc_message_send(uuid, text, text) from public, anon;
revoke all on function public.tc_message_threads() from public, anon;
revoke all on function public.tc_message_thread(uuid) from public, anon;
revoke all on function public.tc_message_unread() from public, anon;

notify pgrst, 'reload schema';

select 'V44 real two-way messaging installed ✅' as status;
