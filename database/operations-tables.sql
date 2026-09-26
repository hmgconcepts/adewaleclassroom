-- =====================================================================
-- OPERATIONS TABLES — the missing database layer for the operations
-- pages (hostel, health, inventory, transport, alumni).
-- These pages shipped as HTML/JS but their tables were never defined,
-- so every list opened with "relation does not exist". This migration
-- installs the five tables with owner/admin + tutor write access and
-- read access for staff, and appends them to the audit + touch-trigger
-- machinery. Safe to re-run.
-- =====================================================================

-- 1. FACILITY & HOSTEL -------------------------------------------------
create table if not exists public.facility_hostel (
  id uuid primary key default gen_random_uuid(),
  room_name text not null,
  category text,
  capacity int,
  assigned_to text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. HEALTH & MEDICAL --------------------------------------------------
create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  student text not null,
  condition_allergy text,
  action_plan text,
  emergency_contact text,
  last_updated text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. INVENTORY & ASSETS ------------------------------------------------
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text,
  quantity text,
  condition text,
  assigned_to text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. TRANSPORT & PICKUP ------------------------------------------------
create table if not exists public.transport (
  id uuid primary key default gen_random_uuid(),
  student text not null,
  authorized_pickup text,
  route_van text,
  status text default 'active',
  contact text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. ALUMNI NETWORK ----------------------------------------------------
create table if not exists public.alumni (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  graduation_year text,
  destination_university text,
  contact_email text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ROW LEVEL SECURITY ---------------------------------------------------
alter table public.facility_hostel enable row level security;
alter table public.health_records    enable row level security;
alter table public.inventory         enable row level security;
alter table public.transport         enable row level security;
alter table public.alumni            enable row level security;

do $$
declare t text;
begin
  foreach t in array array['facility_hostel','health_records','inventory','transport','alumni'] loop
    execute format('drop policy if exists %I on public.%I', t||'_ops_staff', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.tc_is_manager() or public.is_tutor())
         with check (public.tc_is_manager() or public.is_tutor())',
      t||'_ops_staff', t);

    /* read-only for the remaining authenticated staff (secretary etc.) */
    execute format('drop policy if exists %I on public.%I', t||'_ops_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t||'_ops_read', t);

    /* updated_at touch trigger */
    execute format('drop trigger if exists %I on public.%I', t||'_touch', t);
    execute format('create trigger %I before update on public.%I
       for each row execute function public.tc_set_updated_at()', t||'_touch', t);

    /* audit trail */
    execute format('drop trigger if exists %I on public.%I', t||'_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I
       for each row execute function public.tc_audit()', t||'_audit', t);
  end loop;
end $$;

select 'Operations tables installed (facility_hostel, health_records, inventory, transport, alumni)' as status;
