-- =====================================================================
--  MAWEID · ADMIN CONTROL PACK V5.2
--  يُنفّذ بعد MAWEID-SUPABASE-FIXED.sql
--  قابل للتنفيذ مرات بلا خطأ: القسم ٠ يحذف النسخ القديمة أولاً ثم يُعاد الإنشاء.
--  إن كنت قد نفّذت V4 من قبل فهذا الملف يحلّ محلّها كاملاً.
--
--  مبني حرفياً على أعمدة جداولك الحقيقية:
--   staff(display_name,title,title_fr,color,avatar_url,is_active,sort_order)
--   services(name,name_fr,description,duration_min,buffer_before_min,
--            buffer_after_min,price_centimes,color,is_active,sort_order)
--   staff_services(staff_id,service_id,duration_override_min)   ← لا يوجد عمود سعر
--   working_hours(tenant_id,staff_id,weekday,opens_min,closes_min) + مانع تقاطع wh_no_overlap
--   closed_dates(tenant_id,day,reason) + unique(tenant_id,day)
--   customers(user_id,full_name,phone,email,…) + unique(tenant_id,phone)
--   bookings(status,mode,starts_at,ends_at,code,cancel_reason,…)
-- =====================================================================

-- =====================================================================
--  ٠) تنظيف إجباري قبل الإنشاء  —  لا تحذف هذا المقطع
--  إن كنت قد نفّذت نسخة V4 من قبل، فبعض الدوال موجودة بنوع إرجاع
--  مختلف (مثال: delete_closed_date كانت void والأن jsonb)،
--  و PostgreSQL يمنع create or replace من تغيير نوع الإرجاع → ERROR 42P13.
--  هنا نحذف كل النسخ القديمة للـ١٩ اسماً التالية فقط (بكل تحمّلاتها)،
--  ولا نلمس أي دالة أخرى في قاعدتك. ولا واحد من هذه الأسماء موجود
--  في MAWEID-SUPABASE.sql الأساسي، فلا خطر على المخطط القديم.
--  الصلاحيات تُعاد كاملة في القسم ١١ بعد إعادة الإنشاء.
-- =====================================================================
do $drop$
declare r record;
begin
  for r in
    select pg_catalog.quote_ident(n.nspname) || '.' ||
           pg_catalog.quote_ident(p.proname) || '(' ||
           pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' as sig
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where p.prokind = 'f'
       and ( (n.nspname = 'public' and p.proname in (
                'my_profile', 'auth_status', 'claim_shop',
                'list_all_staff', 'list_all_services',
                'delete_staff', 'delete_service',
                'reorder_staff', 'reorder_services', 'set_staff_services',
                'set_week_hours', 'list_closed_dates', 'upsert_closed_date',
                'delete_closed_date', 'get_day_schedule',
                'link_my_customer_rows', 'my_bookings', 'cancel_my_booking'))
          or (n.nspname = 'maweid' and p.proname in ('ensure_profile')) )
  loop
    raise notice 'dropping %', r.sig;
    execute 'drop function if exists ' || r.sig;
  end loop;
end
$drop$;


-- =====================================================================
--  ١) ملف الحساب — سبب الصفحة البيضاء الأول
--  whoami() تدور على public.profiles. لو دخل حساب جوجل ولم يُنشأ له سطر
--  في profiles (لأن الـ trigger لم يُركّب) → whoami() ترجع فارغاً دائماً.
-- =====================================================================
create or replace function maweid.ensure_profile()
returns public.profiles
language plpgsql volatile security definer set search_path = ''
as $$
declare
  u  auth.users%rowtype;
  pr public.profiles%rowtype;
  nm text;
  av text;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into u from auth.users where id = auth.uid();
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  nm := coalesce(
          nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
          nullif(btrim(u.raw_user_meta_data->>'name'), ''),
          nullif(btrim(u.raw_user_meta_data->>'display_name'), ''),
          split_part(coalesce(u.email, 'user'), '@', 1));

  av := nullif(btrim(coalesce(u.raw_user_meta_data->>'avatar_url',
                              u.raw_user_meta_data->>'picture')), '');

  insert into public.profiles (id, email, display_name, avatar_url)
  values (u.id,
          coalesce(u.email, u.id::text || '@local')::extensions.citext,
          nm, av)
  on conflict (id) do update set
    display_name = coalesce(nullif(btrim(public.profiles.display_name), ''), excluded.display_name),
    avatar_url   = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at   = now()
  returning * into pr;

  return pr;
end;
$$;


create or replace function public.my_profile()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare pr public.profiles%rowtype;
begin
  pr := maweid.ensure_profile();
  return jsonb_build_object(
    'id', pr.id, 'email', pr.email::text, 'displayName', pr.display_name,
    'phone', pr.phone, 'avatarUrl', pr.avatar_url, 'locale', pr.locale);
end;
$$;


-- =====================================================================
--  ٢) حالة الحساب أمام محل معيّن (طلب واحد يجيب كل شيء)
-- =====================================================================
create or replace function public.auth_status(p_slug text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  pr        public.profiles%rowtype;
  t         public.tenants%rowtype;
  m         public.tenant_members%rowtype;
  has_owner boolean := false;
begin
  if auth.uid() is null then
    return jsonb_build_object('authenticated', false, 'isMember', false, 'canClaim', false);
  end if;

  pr := maweid.ensure_profile();

  if p_slug is not null then
    select * into t from public.tenants where slug = btrim(p_slug);
  end if;

  if t.id is not null then
    select exists (select 1 from public.tenant_members x
                    where x.tenant_id = t.id and x.role = 'owner') into has_owner;
    select * into m from public.tenant_members
     where tenant_id = t.id and user_id = pr.id;
  end if;

  return jsonb_build_object(
    'authenticated',  true,
    'userId',         pr.id,
    'email',          pr.email::text,
    'displayName',    pr.display_name,
    'avatarUrl',      pr.avatar_url,
    'tenantId',       t.id,
    'tenantSlug',     t.slug,
    'tenantName',     t.name,
    'tenantFound',    (t.id is not null),
    'tenantHasOwner', has_owner,
    'isMember',       (m.id is not null),
    'role',           m.role,
    'canClaim',       (t.id is not null and not has_owner and m.id is null));
end;
$$;


create or replace function public.claim_shop(p_slug text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  pr public.profiles%rowtype;
  t  public.tenants%rowtype;
  m  public.tenant_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  pr := maweid.ensure_profile();

  select * into t from public.tenants where slug = btrim(p_slug);
  if not found then
    raise exception 'tenant_not_found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.tenant_members x
              where x.tenant_id = t.id and x.role = 'owner' and x.user_id <> pr.id) then
    raise exception 'shop_already_claimed' using errcode = '42501';
  end if;

  insert into public.tenant_members (tenant_id, user_id, role)
  values (t.id, pr.id, 'owner')
  on conflict (tenant_id, user_id) do update set role = 'owner'
  returning * into m;

  return jsonb_build_object('tenantId', t.id, 'tenantSlug', t.slug,
                            'tenantName', t.name, 'userId', pr.id, 'role', m.role);
end;
$$;


-- =====================================================================
--  ٣) قوائم اللوحة — تشمل المعطّل
--  get_tenant_bundle تفلتر is_active، فالموظف أو الخدمة بعد التعطيل
--  تختفي من اللوحة نفسها ولا يمكن إعادة تفعيلها أبداً.
-- =====================================================================
create or replace function public.list_all_staff(p_tenant_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_member(p_tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'tenantId', x.tenant_id,
             'displayName', x.display_name,
             'title', x.title, 'titleFr', x.title_fr,
             'color', x.color, 'avatarUrl', x.avatar_url,
             'isActive', x.is_active, 'sortOrder', x.sort_order,
             'serviceIds', coalesce((select jsonb_agg(ss.service_id)
                                      from public.staff_services ss
                                     where ss.staff_id = x.id), '[]'::jsonb),
             'bookingCount', (select count(*) from public.bookings b
                               where b.staff_id = x.id
                                 and b.status in ('held','pending','confirmed','serving')))
           order by x.sort_order, x.display_name)
      from public.staff x
     where x.tenant_id = p_tenant_id), '[]'::jsonb);
end;
$$;


create or replace function public.list_all_services(p_tenant_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_member(p_tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'tenantId', x.tenant_id,
             'name', x.name, 'nameFr', x.name_fr,
             'description', x.description,
             'category', 'general',
             'durationMin', x.duration_min,
             'bufferBeforeMin', x.buffer_before_min,
             'bufferAfterMin', x.buffer_after_min,
             'priceCentimes', x.price_centimes,
             'requiresApproval', false,
             'color', x.color,
             'isActive', x.is_active, 'sortOrder', x.sort_order,
             'staffIds', coalesce((select jsonb_agg(ss.staff_id)
                                    from public.staff_services ss
                                   where ss.service_id = x.id), '[]'::jsonb),
             'bookingCount', (select count(*) from public.bookings b
                               where b.service_id = x.id
                                 and b.status in ('held','pending','confirmed','serving')))
           order by x.sort_order, x.name)
      from public.services x
     where x.tenant_id = p_tenant_id), '[]'::jsonb);
end;
$$;


-- =====================================================================
--  ٤) الحذف الحقيقي — ممنوع مع وجود مواعيد قائمة
-- =====================================================================
create or replace function public.delete_staff(p_tenant_id uuid, p_staff_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform maweid.require(p_tenant_id, 'edit_staff');

  if exists (select 1 from public.bookings b
              where b.staff_id = p_staff_id
                and b.status in ('held','pending','confirmed','serving')) then
    raise exception 'staff_has_bookings' using errcode = 'P0001';
  end if;

  delete from public.staff_services where staff_id = p_staff_id;
  delete from public.working_hours  where staff_id = p_staff_id;
  delete from public.staff where id = p_staff_id and tenant_id = p_tenant_id;
  if not found then
    raise exception 'staff_not_found' using errcode = 'P0002';
  end if;
end;
$$;


create or replace function public.delete_service(p_tenant_id uuid, p_service_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform maweid.require(p_tenant_id, 'edit_services');

  if exists (select 1 from public.bookings b
              where b.service_id = p_service_id
                and b.status in ('held','pending','confirmed','serving')) then
    raise exception 'service_has_bookings' using errcode = 'P0001';
  end if;

  delete from public.staff_services where service_id = p_service_id;
  delete from public.services where id = p_service_id and tenant_id = p_tenant_id;
  if not found then
    raise exception 'service_not_found' using errcode = 'P0002';
  end if;
end;
$$;


-- =====================================================================
--  ٥) الترتيب — المالك يرتّب العرض في الموقع بالسحب أو بالأسهم
--  يُمرّر مصفوفة المعرّفات بالترتيب المرغوب فيُكتب sort_order = 1,2,3…
-- =====================================================================
create or replace function public.reorder_staff(p_tenant_id uuid, p_ids uuid[])
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform maweid.require(p_tenant_id, 'edit_staff');

  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'bad_order' using errcode = 'P0001';
  end if;

  update public.staff s
     set sort_order = o.ord, updated_at = now()
    from unnest(p_ids) with ordinality as o(id, ord)
   where s.id = o.id and s.tenant_id = p_tenant_id;

  return public.list_all_staff(p_tenant_id);
end;
$$;


create or replace function public.reorder_services(p_tenant_id uuid, p_ids uuid[])
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform maweid.require(p_tenant_id, 'edit_services');

  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'bad_order' using errcode = 'P0001';
  end if;

  update public.services s
     set sort_order = o.ord, updated_at = now()
    from unnest(p_ids) with ordinality as o(id, ord)
   where s.id = o.id and s.tenant_id = p_tenant_id;

  return public.list_all_services(p_tenant_id);
end;
$$;


-- =====================================================================
--  ٦) ربط الخدمات بالحلاق — من يقدر على ماذا
--  جدول staff_services فيه duration_override_min فقط (لا يوجد عمود سعر)
-- =====================================================================
create or replace function public.set_staff_services(
  p_tenant_id uuid, p_staff_id uuid, p_service_ids uuid[]
) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform maweid.require(p_tenant_id, 'edit_staff');

  if not exists (select 1 from public.staff
                  where id = p_staff_id and tenant_id = p_tenant_id) then
    raise exception 'staff_not_found' using errcode = 'P0002';
  end if;

  delete from public.staff_services where staff_id = p_staff_id;

  if p_service_ids is not null then
    insert into public.staff_services (staff_id, service_id)
    select p_staff_id, sv.id
      from public.services sv
     where sv.tenant_id = p_tenant_id
       and sv.id = any(p_service_ids)
    on conflict (staff_id, service_id) do nothing;
  end if;

  return public.list_all_staff(p_tenant_id);
end;
$$;


-- =====================================================================
--  ٧) ساعات العمل وأيام العطلة
--  working_hours عليه مانع تقاطع wh_no_overlap، لهذا نحذف اليوم أولاً ثم نكتب.
--  اليوم بلا نوافذ = مغلق.
-- =====================================================================
create or replace function public.set_week_hours(
  p_tenant_id uuid, p_staff_id uuid, p_week jsonb
) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  d jsonb; w jsonb; wd smallint; o int; c int;
begin
  perform maweid.require(p_tenant_id, 'edit_settings');

  for d in select * from jsonb_array_elements(coalesce(p_week, '[]'::jsonb)) loop
    wd := (d->>'weekday')::smallint;
    if wd is null or wd < 0 or wd > 6 then
      raise exception 'invalid_weekday' using errcode = 'P0001';
    end if;

    delete from public.working_hours
     where tenant_id = p_tenant_id
       and weekday = wd
       and staff_id is not distinct from p_staff_id;

    for w in select * from jsonb_array_elements(coalesce(d->'windows', '[]'::jsonb)) loop
      o := coalesce((w->>'opens_min')::int, (w->>'opensMin')::int);
      c := coalesce((w->>'closes_min')::int, (w->>'closesMin')::int);

      if o is null or c is null or o < 0 or c > 1440 or c <= o then
        raise exception 'invalid_hours' using errcode = 'P0001';
      end if;

      insert into public.working_hours (tenant_id, staff_id, weekday, opens_min, closes_min)
      values (p_tenant_id, p_staff_id, wd, o, c);
    end loop;
  end loop;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', wh.id, 'tenantId', wh.tenant_id, 'staffId', wh.staff_id,
             'weekday', wh.weekday, 'opensMin', wh.opens_min, 'closesMin', wh.closes_min)
           order by wh.weekday, wh.opens_min)
      from public.working_hours wh
     where wh.tenant_id = p_tenant_id), '[]'::jsonb);
end;
$$;


create or replace function public.list_closed_dates(p_tenant_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_member(p_tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'tenantId', cd.tenant_id,
             'day', to_char(cd.day, 'YYYY-MM-DD'),
             'label', cd.reason) order by cd.day)
      from public.closed_dates cd
     where cd.tenant_id = p_tenant_id), '[]'::jsonb);
end;
$$;


-- closed_dates فيه unique(tenant_id, day) لهذا on conflict يعمل مباشرة.
create or replace function public.upsert_closed_date(
  p_tenant_id uuid, p_day date, p_reason text default null
) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform maweid.require(p_tenant_id, 'edit_settings');

  if p_day is null then
    raise exception 'invalid_day' using errcode = 'P0001';
  end if;

  insert into public.closed_dates (tenant_id, day, reason)
  values (p_tenant_id, p_day, nullif(btrim(p_reason), ''))
  on conflict (tenant_id, day) do update set reason = excluded.reason;

  return public.list_closed_dates(p_tenant_id);
end;
$$;


create or replace function public.delete_closed_date(p_tenant_id uuid, p_day date)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform maweid.require(p_tenant_id, 'edit_settings');
  delete from public.closed_dates where tenant_id = p_tenant_id and day = p_day;
  return public.list_closed_dates(p_tenant_id);
end;
$$;


-- =====================================================================
--  ٨) ترتيب مواعيد اليوم للوحة
--  يرجع المواعيد مرتّبة بالوقت مع رقم الدور (slot_no) والفراغات بين المواعيد.
--  التوقيت يُحسَب بتوقيت المحل (tenants.time_zone) لا بتوقيت المتصفّح.
-- =====================================================================
create or replace function public.get_day_schedule(p_tenant_id uuid, p_day date)
returns table (
  slot_no int,
  id uuid, code text,
  status public.booking_status, mode public.booking_mode,
  starts_at timestamptz, ends_at timestamptz,
  gap_before_min int,
  staff_id uuid, staff_name text, staff_color text,
  service_id uuid, service_name text,
  customer_name text, customer_phone text,
  price_centimes int, currency text,
  notes_customer text
)
language plpgsql stable security definer set search_path = ''
as $$
declare tz text;
begin
  if not public.is_member(p_tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select t.time_zone into tz from public.tenants t where t.id = p_tenant_id;
  tz := coalesce(tz, 'Africa/Casablanca');

  return query
  with day_rows as (
    select b.*, st.display_name as st_name, st.color as st_color,
           sv.name as sv_name, c.full_name as c_name, c.phone as c_phone
      from public.bookings b
      join public.staff    st on st.id = b.staff_id
      join public.services sv on sv.id = b.service_id
      left join public.customers c on c.id = b.customer_id
     where b.tenant_id = p_tenant_id
       and b.status not in ('held','cancelled','declined')
       and (b.starts_at at time zone tz)::date = p_day
  )
  select (row_number() over (order by r.starts_at, r.st_name))::int,
         r.id, r.code, r.status, r.mode, r.starts_at, r.ends_at,
         (extract(epoch from (r.starts_at - lag(r.ends_at)
            over (partition by r.staff_id order by r.starts_at))) / 60)::int,
         r.staff_id, r.st_name, r.st_color,
         r.service_id, r.sv_name,
         r.c_name, r.c_phone,
         r.price_centimes, r.currency,
         r.notes_customer
    from day_rows r
   order by r.starts_at, r.st_name;
end;
$$;


-- =====================================================================
--  ٩) مواعيد الحساب الداخل بجوجل + الإلغاء الذاتي
--  customers فيه user_id و email — نربط السطور القديمة بالحساب عبر البريد.
-- =====================================================================
create or replace function public.link_my_customer_rows()
returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  pr public.profiles%rowtype;
  n  int := 0;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  pr := maweid.ensure_profile();

  update public.customers c
     set user_id = pr.id, updated_at = now()
   where c.user_id is null
     and c.email is not null
     and c.email = pr.email;

  get diagnostics n = row_count;
  return n;
end;
$$;


create or replace function public.my_bookings(p_slug text default null)
returns table (
  id uuid, code text,
  status public.booking_status, mode public.booking_mode,
  starts_at timestamptz, ends_at timestamptz,
  service_name text, staff_name text, staff_color text,
  price_centimes int, currency text,
  tenant_slug text, tenant_name text,
  can_cancel boolean
)
language plpgsql volatile security definer set search_path = ''
as $$
declare pr public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  pr := maweid.ensure_profile();
  perform public.link_my_customer_rows();

  return query
  select b.id, b.code, b.status, b.mode, b.starts_at, b.ends_at,
         sv.name, st.display_name, st.color,
         b.price_centimes, b.currency,
         t.slug, t.name,
         (s.allow_customer_cancel
          and b.status in ('pending','confirmed')
          and (b.mode = 'queue'
               or b.starts_at >= now() + pg_catalog.make_interval(mins => s.cancel_cutoff_min)))
    from public.bookings b
    join public.customers c on c.id = b.customer_id
    join public.tenants   t on t.id = b.tenant_id
    join public.services sv on sv.id = b.service_id
    join public.staff    st on st.id = b.staff_id
    left join public.tenant_settings s on s.tenant_id = b.tenant_id
   where b.status <> 'held'
     and (p_slug is null or t.slug = btrim(p_slug))
     and (c.user_id = pr.id or (c.email is not null and c.email = pr.email))
   order by b.starts_at desc
   limit 100;
end;
$$;


-- الإلغاء من طرف العميل نفسه: يتحقق من الملكية ثم يطبّق قواعد cancel_by_code
-- (allow_customer_cancel و cancel_cutoff_min و already_closed).
create or replace function public.cancel_my_booking(p_code text, p_reason text default null)
returns public.bookings
language plpgsql volatile security definer set search_path = ''
as $$
declare
  pr public.profiles%rowtype;
  b  public.bookings%rowtype;
  c  public.customers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  pr := maweid.ensure_profile();
  perform public.link_my_customer_rows();

  select * into b from public.bookings where upper(code) = upper(btrim(p_code));
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  select * into c from public.customers where id = b.customer_id;
  if not found
     or not (c.user_id = pr.id or (c.email is not null and c.email = pr.email)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return public.cancel_by_code(p_code, coalesce(nullif(btrim(p_reason), ''), 'cancelled by customer'));
end;
$$;


-- =====================================================================
--  ١٠) معلومات الاتصال في أسفل الموقع
--  الفوتر يقرأ tenants.email و tenants.whatsapp و tenants.phone — لا شيء مكتوب في الكود.
--  رقم واتساب لـ wa.me يجب أن يكون أرقاماً فقط برمز الدولة بلا + ولا مسافات.
-- =====================================================================
update public.tenants
   set email      = 'octopus.web00@gmail.com'::extensions.citext,
       whatsapp   = pg_catalog.regexp_replace(coalesce(whatsapp, phone, ''), '[^0-9]', '', 'g'),
       updated_at = now()
 where slug = 'zaytouna';

-- إن كان الرقم محلياً (يبدأ بـ 0) فحوّله إلى الصيغة الدولية المغربية 212…
update public.tenants
   set whatsapp = '212' || pg_catalog.substr(whatsapp, 2)
 where slug = 'zaytouna'
   and whatsapp like '0%';


-- =====================================================================
--  ١١) الصلاحيات
-- =====================================================================
grant execute on function public.my_profile()                                to authenticated;
grant execute on function public.auth_status(text)                           to authenticated;
grant execute on function public.claim_shop(text)                            to authenticated;
grant execute on function public.list_all_staff(uuid)                        to authenticated;
grant execute on function public.list_all_services(uuid)                     to authenticated;
grant execute on function public.delete_staff(uuid, uuid)                    to authenticated;
grant execute on function public.delete_service(uuid, uuid)                  to authenticated;
grant execute on function public.reorder_staff(uuid, uuid[])                 to authenticated;
grant execute on function public.reorder_services(uuid, uuid[])              to authenticated;
grant execute on function public.set_staff_services(uuid, uuid, uuid[])      to authenticated;
grant execute on function public.set_week_hours(uuid, uuid, jsonb)           to authenticated;
grant execute on function public.list_closed_dates(uuid)                     to authenticated;
grant execute on function public.upsert_closed_date(uuid, date, text)        to authenticated;
grant execute on function public.delete_closed_date(uuid, date)              to authenticated;
grant execute on function public.get_day_schedule(uuid, date)                to authenticated;
grant execute on function public.link_my_customer_rows()                     to authenticated;
grant execute on function public.my_bookings(text)                           to authenticated;
grant execute on function public.cancel_my_booking(text, text)               to authenticated;


-- =====================================================================
--  ١٢) مُشغّل إنشاء الملف تلقائياً (يُتجاوز إن مُنعت الصلاحية)
-- =====================================================================
do $trig$
begin
  begin
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function maweid.handle_new_user();
    raise notice 'trigger on_auth_user_created installed';
  exception when others then
    raise notice 'trigger not installed (%) -- ensure_profile() تغطي الحالة', sqlerrm;
  end;
end
$trig$;

notify pgrst, 'reload schema';
