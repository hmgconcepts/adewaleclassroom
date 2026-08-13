-- Tutoring Connect keep-alive (idempotent). Already inside complete-schema.
create table if not exists public.tc_heartbeat (
  id integer primary key,
  last_ping timestamptz not null default now(),
  last_source text,
  ping_count bigint not null default 0
);
alter table public.tc_heartbeat enable row level security;
revoke all on table public.tc_heartbeat from anon, authenticated;
insert into public.tc_heartbeat (id) values (1) on conflict (id) do nothing;

create or replace function public.tc_keep_alive(src text default 'unknown')
returns timestamptz
language sql
security definer
set search_path = public
as $keepalive$
  update public.tc_heartbeat
     set last_ping = now(),
         last_source = left(coalesce(src, 'unknown'), 40),
         ping_count = ping_count + 1
   where id = 1
  returning last_ping;
$keepalive$;
grant execute on function public.tc_keep_alive(text) to anon, authenticated;

do $cronsetup$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule(jobid) from cron.job where jobname = 'tc-keep-alive';
      perform cron.schedule('tc-keep-alive', '23 5 */2 * *', $job$select public.tc_keep_alive('pg_cron')$job$);
    exception when others then
      raise notice 'pg_cron keep-alive not scheduled (%).', sqlerrm;
    end;
  end if;
end
$cronsetup$;
select 'Tutoring Connect keep-alive heartbeat installed ✅' as status;
