-- ============================================================================
-- MAWEID (مواعيد) · Complete Supabase Postgres Backend
-- Multi-tenant Appointment Scheduling & Walk-in Queue System
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "btree_gist";

create schema if not exists maweid;

-- ----------------------------------------------------------------------------
-- 0. Owner Email Configuration
-- ----------------------------------------------------------------------------
create or replace function maweid.owner_email()
returns text language sql immutable as $$
  select 'noureddinelmobaraki@gmail.com'::text;
$$;

-- ----------------------------------------------------------------------------
-- 1. Core Tables
-- ----------------------------------------------------------------------------

create table if not exists public.tenants (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  name_fr text,
  tagline text,
  tagline_fr text,
  address_line text,
  address text,
  city text not null default 'الدار البيضاء',
  phone text not null,
  whatsapp text,
  email text,
  time_zone text not null default 'Africa/Casablanca',
  currency text not null default 'MAD',
  lat double precision,
  lng double precision,
  brand_color text not null default '#0E7C86',
  default_locale text not null default 'ar',
  locales text[] not null default array['ar', 'fr'],
  logo_url text,
  is_published boolean not null default true,
  settings jsonb not null default '{
    "slot_granularity_min": 15,
    "min_notice_min": 60,
    "max_advance_days": 30,
    "hold_ttl_min": 5,
    "auto_confirm": false,
    "cancel_cutoff_min": 120,
    "reschedule_cutoff_min": 120,
    "allow_customer_cancel": true,
    "allow_customer_reschedule": true,
    "require_email": false,
    "allow_any_staff": true,
    "show_staff_picker": true,
    "max_active_per_customer": 3,
    "block_after_no_shows": 2,
    "queue_enabled": true,
    "queue_max_size": 30
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  phone text,
  locale text not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  view_all boolean not null default true,
  decide boolean not null default false,
  move boolean not null default false,
  reorder_queue boolean not null default false,
  cancel boolean not null default false,
  delete boolean not null default false,
  edit_services boolean not null default false,
  edit_staff boolean not null default false,
  edit_settings boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.staff (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  display_name text not null,
  title text,
  title_fr text,
  color text not null default '#0E7C86',
  avatar_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  name_fr text,
  description text,
  category text not null default 'general',
  duration_min int not null check (duration_min > 0),
  buffer_before_min int not null default 0,
  buffer_after_min int not null default 0,
  price_centimes int not null default 0,
  price_from boolean not null default false,
  requires_approval boolean not null default false,
  color text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  max_per_day int,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_services (
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  duration_override_min int,
  price_override_centimes int,
  primary key (staff_id, service_id)
);

create table if not exists public.working_hours (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  opens_min int not null check (opens_min between 0 and 1440),
  closes_min int not null check (closes_min between 0 and 1440),
  check (opens_min < closes_min)
);

create table if not exists public.closed_dates (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  day text not null, -- YYYY-MM-DD
  label text,
  created_at timestamptz not null default now()
);

create table if not exists public.time_off (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  locale text not null default 'ar',
  is_blocked boolean not null default false,
  no_show_count int not null default 0,
  total_bookings int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  staff_id uuid not null references public.staff(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  buffer_before_min int not null default 0,
  buffer_after_min int not null default 0,
  status text not null check (status in ('held', 'pending', 'confirmed', 'serving', 'completed', 'cancelled', 'declined', 'no_show')),
  mode text not null default 'appointment' check (mode in ('appointment', 'queue')),
  source text not null default 'web' check (source in ('web', 'admin', 'whatsapp', 'phone', 'walk_in')),
  price_centimes int not null default 0,
  currency text not null default 'MAD',
  code text not null,
  queue_rank numeric(18, 6),
  skipped_count int not null default 0,
  served_at timestamptz,
  hold_expires_at timestamptz,
  notes_customer text,
  notes_internal text,
  cancel_reason text,
  reschedule_of uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_events (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null,
  tenant_id uuid not null,
  actor_label text,
  kind text not null check (kind in ('created', 'status', 'moved', 'queued', 'reordered', 'skipped', 'served', 'note', 'deleted')),
  from_status text,
  to_status text,
  from_starts_at timestamptz,
  to_starts_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications_outbox (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'sms')),
  recipient text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

-- Exclusion constraint to prevent double bookings per staff
alter table public.bookings drop constraint if exists no_double_booking;
alter table public.bookings add constraint no_double_booking
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('held', 'pending', 'confirmed', 'serving'));

-- ----------------------------------------------------------------------------
-- 2. Triggers & Helpers
-- ----------------------------------------------------------------------------

create or replace function maweid.force_owner_perms()
returns trigger language plpgsql as $$
begin
  if new.role = 'owner' then
    new.view_all := true;
    new.decide := true;
    new.move := true;
    new.reorder_queue := true;
    new.cancel := true;
    new.delete := true;
    new.edit_services := true;
    new.edit_staff := true;
    new.edit_settings := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_force_owner_perms on public.tenant_members;
create trigger trg_force_owner_perms
  before insert or update on public.tenant_members
  for each row execute function maweid.force_owner_perms();

create or replace function maweid.bind_owner()
returns text language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
  v_email text := maweid.owner_email();
begin
  select id into v_user_id from auth.users where email = v_email limit 1;
  if v_user_id is null then
    return 'user ' || v_email || ' not found in auth.users';
  end if;

  select id into v_tenant_id from public.tenants where slug = 'zaytouna' limit 1;
  if v_tenant_id is null then
    return 'tenant zaytouna not found';
  end if;

  insert into public.profiles (id, email, display_name)
  values (v_user_id, v_email, 'Noureddine El Mobaraki')
  on conflict (id) do update set email = excluded.email;

  insert into public.tenant_members (
    tenant_id, user_id, role,
    view_all, decide, move, reorder_queue, cancel, delete,
    edit_services, edit_staff, edit_settings
  ) values (
    v_tenant_id, v_user_id, 'owner',
    true, true, true, true, true, true,
    true, true, true
  )
  on conflict (tenant_id, user_id) do update set
    role = 'owner',
    view_all = true, decide = true, move = true, reorder_queue = true,
    cancel = true, delete = true, edit_services = true, edit_staff = true,
    edit_settings = true;

  return 'bound owner ' || v_user_id || ' to tenant ' || v_tenant_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. RPC Endpoints (Security Definer)
-- ----------------------------------------------------------------------------

create or replace function public.whoami()
returns table (
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
  tenant_id uuid,
  tenant_slug text,
  tenant_name text,
  role text,
  is_shop_owner boolean,
  perms jsonb
) language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  return query
  select
    u.id as user_id,
    u.email::text,
    coalesce(p.display_name, u.email)::text as display_name,
    p.avatar_url::text,
    t.id as tenant_id,
    t.slug::text as tenant_slug,
    t.name::text as tenant_name,
    tm.role::text,
    (tm.role = 'owner' or u.email = maweid.owner_email()) as is_shop_owner,
    jsonb_build_object(
      'view_all', tm.view_all,
      'decide', tm.decide,
      'move', tm.move,
      'reorder_queue', tm.reorder_queue,
      'cancel', tm.cancel,
      'delete', tm.delete,
      'edit_services', tm.edit_services,
      'edit_staff', tm.edit_staff,
      'edit_settings', tm.edit_settings
    ) as perms
  from auth.users u
  left join public.profiles p on p.id = u.id
  join public.tenant_members tm on tm.user_id = u.id
  join public.tenants t on t.id = tm.tenant_id
  where u.id = v_uid
  limit 1;
end;
$$;

create or replace function public.get_tenant_bundle(p_slug text)
returns jsonb language plpgsql security definer as $$
declare
  v_tenant record;
  v_services jsonb;
  v_staff jsonb;
  v_staff_services jsonb;
  v_working_hours jsonb;
  v_closed_dates jsonb;
begin
  select * into v_tenant from public.tenants where slug = p_slug and is_published = true;
  if v_tenant is null then
    raise exception 'tenant_not_found';
  end if;

  select jsonb_agg(row_to_json(s)) into v_services
  from (select * from public.services where tenant_id = v_tenant.id and is_active = true order by sort_order) s;

  select jsonb_agg(row_to_json(st)) into v_staff
  from (select * from public.staff where tenant_id = v_tenant.id and is_active = true order by sort_order) st;

  select jsonb_agg(row_to_json(ss)) into v_staff_services
  from public.staff_services ss
  join public.staff st on st.id = ss.staff_id
  where st.tenant_id = v_tenant.id;

  select jsonb_agg(row_to_json(wh)) into v_working_hours
  from public.working_hours wh
  where wh.tenant_id = v_tenant.id;

  select jsonb_agg(row_to_json(cd)) into v_closed_dates
  from public.closed_dates cd
  where cd.tenant_id = v_tenant.id;

  return jsonb_build_object(
    'tenant', row_to_json(v_tenant),
    'settings', v_tenant.settings,
    'services', coalesce(v_services, '[]'::jsonb),
    'staff', coalesce(v_staff, '[]'::jsonb),
    'staffServices', coalesce(v_staff_services, '[]'::jsonb),
    'workingHours', coalesce(v_working_hours, '[]'::jsonb),
    'closedDates', coalesce(v_closed_dates, '[]'::jsonb)
  );
end;
$$;

-- Additional RPC Functions matching DataAdapter
create or replace function public.get_queue(p_tenant_id uuid, p_day text default null)
returns table (
  id uuid,
  position int,
  queue_rank numeric,
  status text,
  staff_id uuid,
  staff_name text,
  staff_color text,
  service_id uuid,
  service_name text,
  duration_min int,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  code text,
  skipped_count int,
  created_at timestamptz,
  served_at timestamptz,
  eta_minutes int
) language plpgsql security definer as $$
begin
  return query
  with ranked as (
    select
      b.id,
      b.queue_rank,
      b.status,
      b.staff_id,
      st.display_name as staff_name,
      st.color as staff_color,
      b.service_id,
      srv.name as service_name,
      srv.duration_min,
      b.customer_id,
      c.full_name as customer_name,
      c.phone as customer_phone,
      b.code,
      b.skipped_count,
      b.created_at,
      b.served_at,
      row_number() over (order by (case when b.status = 'serving' then 0 else 1 end), b.queue_rank asc, b.created_at asc) as pos
    from public.bookings b
    join public.staff st on st.id = b.staff_id
    join public.services srv on srv.id = b.service_id
    left join public.customers c on c.id = b.customer_id
    where b.tenant_id = p_tenant_id
      and b.mode = 'queue'
      and b.status in ('pending', 'confirmed', 'serving')
  )
  select
    r.id,
    r.pos::int as position,
    coalesce(r.queue_rank, 1000 * r.pos) as queue_rank,
    r.status,
    r.staff_id,
    r.staff_name,
    r.staff_color,
    r.service_id,
    r.service_name,
    r.duration_min,
    r.customer_id,
    r.customer_name,
    r.customer_phone,
    r.code,
    r.skipped_count,
    r.created_at,
    r.served_at,
    (coalesce(r.pos - 1, 0) * 20)::int as eta_minutes
  from ranked r
  order by r.pos;
end;
$$;

create or replace function public.queue_next(
  p_tenant_id uuid,
  p_staff_id uuid default null,
  p_close_as text default 'completed'
)
returns table (
  finished_id uuid,
  next_id uuid,
  next_name text
) language plpgsql security definer as $$
declare
  v_finished_id uuid;
  v_next_id uuid;
  v_next_name text;
begin
  -- 1. Finish currently serving booking for this tenant/staff
  select id into v_finished_id
  from public.bookings
  where tenant_id = p_tenant_id
    and status = 'serving'
    and (p_staff_id is null or staff_id = p_staff_id)
  order by served_at asc
  limit 1;

  if v_finished_id is not null then
    update public.bookings
    set status = p_close_as, updated_at = now()
    where id = v_finished_id;

    insert into public.booking_events (booking_id, tenant_id, kind, from_status, to_status)
    values (v_finished_id, p_tenant_id, 'status', 'serving', p_close_as);
  end if;

  -- 2. Find the next waiting person
  select b.id, coalesce(c.full_name, 'زبون')
  into v_next_id, v_next_name
  from public.bookings b
  left join public.customers c on c.id = b.customer_id
  where b.tenant_id = p_tenant_id
    and b.mode = 'queue'
    and b.status in ('pending', 'confirmed')
    and (p_staff_id is null or b.staff_id = p_staff_id)
  order by b.queue_rank asc, b.created_at asc
  limit 1;

  if v_next_id is not null then
    update public.bookings
    set status = 'serving', served_at = now(), updated_at = now()
    where id = v_next_id;

    insert into public.booking_events (booking_id, tenant_id, kind, from_status, to_status)
    values (v_next_id, p_tenant_id, 'served', 'confirmed', 'serving');
  end if;

  return query select v_finished_id, v_next_id, v_next_name;
end;
$$;

create or replace function public.queue_advance(p_booking_id uuid, p_places int default null)
returns setof public.bookings language plpgsql security definer as $$
declare
  v_booking public.bookings%rowtype;
  v_min_rank numeric;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'booking_not_found'; end if;

  if p_places is null then
    -- Move to absolute front
    select coalesce(min(queue_rank), 1000) - 1000 into v_min_rank
    from public.bookings
    where tenant_id = v_booking.tenant_id and mode = 'queue' and status in ('pending', 'confirmed');

    update public.bookings
    set queue_rank = v_min_rank, updated_at = now()
    where id = p_booking_id
    returning * into v_booking;
  else
    -- Shift up
    update public.bookings
    set queue_rank = queue_rank - (p_places * 1000), updated_at = now()
    where id = p_booking_id
    returning * into v_booking;
  end if;

  insert into public.booking_events (booking_id, tenant_id, kind, note)
  values (p_booking_id, v_booking.tenant_id, 'reordered', 'تسبيق');

  return next v_booking;
end;
$$;

create or replace function public.queue_skip(p_booking_id uuid, p_places int default 1)
returns setof public.bookings language plpgsql security definer as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'booking_not_found'; end if;

  update public.bookings
  set queue_rank = queue_rank + (coalesce(p_places, 1) * 1000),
      skipped_count = skipped_count + coalesce(p_places, 1),
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, tenant_id, kind, note)
  values (p_booking_id, v_booking.tenant_id, 'skipped', 'تخطي');

  return next v_booking;
end;
$$;

create or replace function public.queue_reorder(
  p_booking_id uuid,
  p_before_id uuid default null,
  p_after_id uuid default null
)
returns setof public.bookings language plpgsql security definer as $$
declare
  v_booking public.bookings%rowtype;
  v_r1 numeric;
  v_r2 numeric;
  v_target_rank numeric;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'booking_not_found'; end if;

  if p_before_id is not null then
    select queue_rank into v_r1 from public.bookings where id = p_before_id;
  end if;
  if p_after_id is not null then
    select queue_rank into v_r2 from public.bookings where id = p_after_id;
  end if;

  if v_r1 is not null and v_r2 is not null then
    v_target_rank := (v_r1 + v_r2) / 2.0;
  elsif v_r1 is not null then
    v_target_rank := v_r1 + 1000;
  elsif v_r2 is not null then
    v_target_rank := v_r2 - 1000;
  else
    v_target_rank := 1000;
  end if;

  update public.bookings
  set queue_rank = v_target_rank, updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, tenant_id, kind, note)
  values (p_booking_id, v_booking.tenant_id, 'reordered', 'تمرير');

  return next v_booking;
end;
$$;

create or replace function public.queue_call(p_booking_id uuid)
returns setof public.bookings language plpgsql security definer as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'booking_not_found'; end if;

  update public.bookings
  set status = 'serving', served_at = now(), updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, tenant_id, kind, from_status, to_status)
  values (p_booking_id, v_booking.tenant_id, 'served', v_booking.status, 'serving');

  return next v_booking;
end;
$$;

create or replace function public.admin_cancel_booking(p_booking_id uuid, p_reason text default null)
returns setof public.bookings language plpgsql security definer as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'booking_not_found'; end if;

  update public.bookings
  set status = 'cancelled', cancel_reason = p_reason, updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_events (booking_id, tenant_id, kind, to_status, note)
  values (p_booking_id, v_booking.tenant_id, 'status', 'cancelled', p_reason);

  return next v_booking;
end;
$$;

create or replace function public.admin_delete_booking(p_booking_id uuid, p_reason text default null)
returns void language plpgsql security definer as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'booking_not_found'; end if;

  insert into public.booking_events (booking_id, tenant_id, kind, note)
  values (p_booking_id, v_booking.tenant_id, 'deleted', p_reason);

  delete from public.bookings where id = p_booking_id;
end;
$$;

create or replace function public.update_tenant_identity(
  p_tenant_id uuid,
  p_name text default null,
  p_name_fr text default null,
  p_tagline text default null,
  p_tagline_fr text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_email text default null,
  p_address text default null,
  p_city text default null,
  p_brand_color text default null,
  p_logo_url text default null
)
returns void language plpgsql security definer as $$
begin
  update public.tenants
  set
    name = coalesce(p_name, name),
    name_fr = coalesce(p_name_fr, name_fr),
    tagline = coalesce(p_tagline, tagline),
    tagline_fr = coalesce(p_tagline_fr, tagline_fr),
    phone = coalesce(p_phone, phone),
    whatsapp = coalesce(p_whatsapp, whatsapp),
    email = coalesce(p_email, email),
    address = coalesce(p_address, address),
    city = coalesce(p_city, city),
    brand_color = coalesce(p_brand_color, brand_color),
    logo_url = coalesce(p_logo_url, logo_url),
    updated_at = now()
  where id = p_tenant_id;
end;
$$;

create or replace function public.upsert_staff(
  p_tenant_id uuid,
  p_staff_id uuid default null,
  p_display_name text default null,
  p_title text default null,
  p_color text default null,
  p_is_active boolean default null,
  p_sort_order int default null,
  p_service_ids uuid[] default null
)
returns public.staff language plpgsql security definer as $$
declare
  v_staff public.staff;
  v_sid uuid;
begin
  if p_staff_id is null then
    insert into public.staff (tenant_id, display_name, title, color, is_active, sort_order)
    values (
      p_tenant_id,
      coalesce(p_display_name, 'عامل جديد'),
      p_title,
      coalesce(p_color, '#0E7C86'),
      coalesce(p_is_active, true),
      coalesce(p_sort_order, 0)
    )
    returning * into v_staff;
  else
    update public.staff
    set
      display_name = coalesce(p_display_name, display_name),
      title = coalesce(p_title, title),
      color = coalesce(p_color, color),
      is_active = coalesce(p_is_active, is_active),
      sort_order = coalesce(p_sort_order, sort_order)
    where id = p_staff_id and tenant_id = p_tenant_id
    returning * into v_staff;
  end if;

  if p_service_ids is not null then
    delete from public.staff_services where staff_id = v_staff.id;
    foreach v_sid in array p_service_ids loop
      insert into public.staff_services (staff_id, service_id) values (v_staff.id, v_sid);
    end loop;
  end if;

  return v_staff;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Initial Seed (Tenant Zaytouna)
-- ----------------------------------------------------------------------------

insert into public.tenants (id, slug, name, name_fr, tagline, tagline_fr, phone, whatsapp, address, city, brand_color)
values (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'zaytouna',
  'صالون الزيتونة للحلاقة',
  'Salon Zaytouna',
  'حلاقة عصرية وعناية تقليدية بالدار البيضاء',
  'Coiffure moderne & soins traditionnels',
  '+212 522-123456',
  '+212 612-345678',
  'شارع الزرقطوني، معاريف، الدار البيضاء',
  'الدار البيضاء',
  '#0E7C86'
)
on conflict (slug) do update set name = excluded.name;

insert into public.staff (id, tenant_id, display_name, title, color, is_active, sort_order)
values
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'نور الدين', 'ماستر باربر', '#0E7C86', true, 1),
  ('b0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'حمزة', 'مصفف لحية وشعر', '#B2543A', true, 2),
  ('b0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'سفيان', 'أخصائي عناية وصبغة', '#4A6741', true, 3)
on conflict (id) do nothing;

insert into public.services (id, tenant_id, name, duration_min, price_centimes, color, is_active, sort_order)
values
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'حلاقة شعر كلاسيكية', 30, 7000, '#0E7C86', true, 1),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'تشذيب وتحديد اللحية', 20, 4000, '#B2543A', true, 2),
  ('c0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'حلاقة شعر + لحية VIP', 50, 10000, '#C9922B', true, 3)
on conflict (id) do nothing;
