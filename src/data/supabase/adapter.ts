import { supabase, supabaseConfigProblem } from './client'
import { fromPostgrest, AppError } from '../errors'
import {
  NO_PERMS,
  type AvailabilityQuery,
  type ConfirmInput,
  type DataAdapter,
  type HoldResult,
} from '../adapter'
import type {
  AgendaItem,
  Booking,
  BookingSource,
  Customer,
  Permissions,
  QueueTicket,
  Service,
  Session,
  Slot,
  Staff,
  Stats,
  TenantBundle,
  TenantSettings,
  TimeOff,
} from '../domain'

/* ------------------------------------------------------------------ *
 *  أدوات مشتركة
 * ------------------------------------------------------------------ */

const camelCache = new Map<string, string>()

function toCamel(key: string): string {
  const hit = camelCache.get(key)
  if (hit !== undefined) return hit
  const out = key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase())
  camelCache.set(key, out)
  return out
}

/** يحوّل مفاتيح أي كائن/مصفوفة من snake_case إلى camelCase بعمق. */
function camelizeDeep<T>(input: unknown): T {
  if (Array.isArray(input)) {
    return input.map((v) => camelizeDeep<unknown>(v)) as unknown as T
  }
  if (input !== null && typeof input === 'object' && !(input instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[toCamel(k)] = camelizeDeep<unknown>(v)
    }
    return out as T
  }
  return input as T
}

function todayIso(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** الواجهة كانت ترسل 1970-01-01 عندما لا يُحدَّد اليوم؛ نصححها إلى اليوم. */
function normalizeFromDay(value?: string | null): string {
  const today = todayIso()
  if (!value) return today
  return value < today ? today : value
}

/** فكّ نتيجة PostgREST أو ارمِ AppError مفهوماً. */
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (supabaseConfigProblem) {
    throw new AppError('network', `supabase_not_configured: ${supabaseConfigProblem}`)
  }
  const { data: out, error } = await supabase.rpc(fn, args ?? {})
  if (error) {
    console.error(`[maweid] rpc ${fn} فشل`, { code: error.code, message: error.message, args })
    throw fromPostgrest(error)
  }
  return out as T
}

/* ------------------------------------------------------------------ *
 *  محوّلات الصفوف
 * ------------------------------------------------------------------ */

function toBooking(r: Record<string, any>): Booking {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    customerId: r.customer_id ?? undefined,
    staffId: r.staff_id,
    serviceId: r.service_id,
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    bufferBeforeMin: r.buffer_before_min ?? 0,
    bufferAfterMin: r.buffer_after_min ?? 0,
    status: r.status,
    mode: r.mode ?? 'appointment',
    source: r.source as BookingSource,
    priceCentimes: r.price_centimes ?? 0,
    currency: r.currency ?? 'MAD',
    code: r.code,
    queueRank: r.queue_rank ? Number(r.queue_rank) : undefined,
    skippedCount: r.skipped_count ?? 0,
    servedAt: r.served_at ? new Date(r.served_at) : null,
    holdExpiresAt: r.hold_expires_at ? new Date(r.hold_expires_at) : undefined,
    notesCustomer: r.notes_customer ?? undefined,
    notesInternal: r.notes_internal ?? undefined,
    cancelReason: r.cancel_reason ?? undefined,
    rescheduleOf: r.reschedule_of ?? undefined,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

function toAgendaItem(r: Record<string, any>): AgendaItem {
  const b = toBooking(r)
  return {
    ...b,
    staffName: r.staff_name ?? '—',
    staffColor: r.staff_color ?? undefined,
    serviceName: r.service_name ?? '—',
    serviceColor: r.service_color ?? undefined,
    customerName: r.customer_name ?? undefined,
    customerPhone: r.customer_phone ?? undefined,
  }
}

function toTicket(r: Record<string, any>): QueueTicket {
  return {
    id: r.id,
    position: r.position,
    queueRank: Number(r.queue_rank),
    status: r.status,
    staffId: r.staff_id,
    staffName: r.staff_name,
    staffColor: r.staff_color,
    serviceId: r.service_id,
    serviceName: r.service_name,
    durationMin: r.duration_min,
    customerId: r.customer_id ?? null,
    customerName: r.customer_name ?? null,
    customerPhone: r.customer_phone ?? null,
    code: r.code,
    skippedCount: r.skipped_count ?? 0,
    createdAt: new Date(r.created_at),
    servedAt: r.served_at ? new Date(r.served_at) : null,
    etaMinutes: r.eta_minutes ?? 0,
  }
}

function toCustomer(r: Record<string, any>): Customer {
  const c = camelizeDeep<Record<string, any>>(r)
  return {
    ...c,
    isBlocked: c.isBlocked === true,
    noShowCount: Number(c.noShowCount ?? 0),
    totalBookings: Number(c.totalBookings ?? 0),
    lastVisitAt: c.lastVisitAt ? new Date(c.lastVisitAt) : undefined,
  } as unknown as Customer
}

function toTimeOff(r: Record<string, any>): TimeOff {
  const o = camelizeDeep<Record<string, any>>(r)
  return {
    ...o,
    startsAt: new Date(o.startsAt),
    endsAt: new Date(o.endsAt),
  } as unknown as TimeOff
}

let cachedPerms: Permissions = NO_PERMS

async function readSession(): Promise<Session | null> {
  if (supabaseConfigProblem) {
    cachedPerms = NO_PERMS
    return null
  }
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) {
    cachedPerms = NO_PERMS
    return null
  }

  // whoami() هي المصدر الوحيد للحقيقة: المتصفح لا يقرر من هو المالك.
  const rows = await rpc<any[]>('whoami')
  const me = rows?.[0]
  if (!me) {
    cachedPerms = NO_PERMS
    return null
  }

  cachedPerms = me.perms as Permissions
  return {
    userId: me.user_id,
    email: me.email,
    displayName: me.display_name ?? me.email,
    avatarUrl: me.avatar_url ?? undefined,
    tenantId: me.tenant_id,
    tenantSlug: me.tenant_slug,
    tenantName: me.tenant_name,
    role: me.role,
    isShopOwner: me.is_shop_owner === true,
    perms: me.perms as Permissions,
  }
}

/* ------------------------------------------------------------------ *
 *  المحوّل
 * ------------------------------------------------------------------ */

export const supabaseAdapter: DataAdapter = {
  // ---- عام -------------------------------------------------------------
  async getTenantBundle(slug) {
    const raw = await rpc<any>('get_tenant_bundle', { p_slug: slug })
    if (!raw || !raw.tenant) {
      throw new AppError('tenant_not_found', `slug=${slug}`)
    }
    return camelizeDeep<TenantBundle>(raw)
  },

  async getAvailability(queryOrSlug, serviceId, staffId, fromDay, days) {
    const q =
      typeof queryOrSlug === 'object'
        ? {
            slug: queryOrSlug.slug,
            serviceId: queryOrSlug.serviceId,
            staffId: queryOrSlug.staffId ?? null,
            fromDay: normalizeFromDay(queryOrSlug.fromDay ?? queryOrSlug.from),
            days: queryOrSlug.days ?? 14,
          }
        : {
            slug: queryOrSlug,
            serviceId: serviceId!,
            staffId: staffId ?? null,
            fromDay: normalizeFromDay(fromDay),
            days: days ?? 14,
          }

    const rows = await rpc<any[]>('get_availability', {
      p_slug: q.slug,
      p_service_id: q.serviceId,
      p_staff_id: q.staffId,
      p_from_day: q.fromDay,
      p_days: q.days,
    })
    return (rows ?? []).map(
      (r): Slot => ({
        start: new Date(r.starts_at),
        end: new Date(r.ends_at),
        startsAt: new Date(r.starts_at),
        endsAt: new Date(r.ends_at),
        staffId: r.staff_id,
        staffName: r.staff_name,
      }),
    )
  },

  async getOpenDays(queryOrSlug, serviceId, staffId, fromDay, days) {
    const q =
      typeof queryOrSlug === 'object'
        ? {
            slug: queryOrSlug.slug,
            serviceId: queryOrSlug.serviceId,
            staffId: queryOrSlug.staffId ?? null,
            fromDay: normalizeFromDay(queryOrSlug.fromDay ?? queryOrSlug.from),
            days: queryOrSlug.days ?? 14,
          }
        : {
            slug: queryOrSlug,
            serviceId: serviceId!,
            staffId: staffId ?? null,
            fromDay: normalizeFromDay(fromDay),
            days: days ?? 14,
          }

    const rows = await rpc<any[]>('get_open_days', {
      p_slug: q.slug,
      p_service_id: q.serviceId,
      p_staff_id: q.staffId,
      p_from_day: q.fromDay,
      p_days: q.days,
    })
    return (rows ?? []).map((r) => r.day as string)
  },

  async holdSlot(slug, serviceId, staffId, startsAt) {
    const booking = toBooking(
      await rpc('hold_slot', {
        p_slug: slug,
        p_service_id: serviceId,
        p_staff_id: staffId,
        p_starts_at: startsAt.toISOString(),
      }),
    )
    const expiresAt = booking.holdExpiresAt ?? new Date(Date.now() + 10 * 60_000)
    return {
      ...booking,
      bookingId: booking.id,
      code: booking.code,
      expiresAt,
      holdExpiresAt: expiresAt,
      booking,
    }
  },

  async releaseHold(bookingId, code) {
    await rpc('release_hold', { p_booking_id: bookingId, p_code: code ?? null })
  },

  async confirmHold(inputOrBookingId, code, fullName, phone, email, notes) {
    const input: ConfirmInput =
      typeof inputOrBookingId === 'object'
        ? inputOrBookingId
        : {
            bookingId: inputOrBookingId,
            code: code!,
            fullName: fullName!,
            phone: phone!,
            email,
            notes,
          }

    return toBooking(
      await rpc('confirm_hold', {
        p_booking_id: input.bookingId,
        p_code: input.code,
        p_full_name: input.fullName,
        p_phone: input.phone,
        p_email: input.email ?? null,
        p_notes: input.notes ?? null,
      }),
    )
  },

  async getBookingByCode(code) {
    const rows = await rpc<any[]>('get_booking_by_code', { p_code: code })
    return rows?.[0] ? toAgendaItem(rows[0]) : null
  },

  async listBookingsByPhone(slug, phone) {
    const rows = await rpc<any[]>('list_bookings_by_phone', {
      p_slug: slug,
      p_phone: phone,
    })
    return (rows ?? []).map(toAgendaItem)
  },

  async cancelBooking(codeOrId, reason = null) {
    return toBooking(await rpc('cancel_by_code', { p_code: codeOrId, p_reason: reason }))
  },

  async rescheduleBooking(codeOrId, startsAt, _staffId, _code) {
    return toBooking(
      await rpc('reschedule_by_code', {
        p_code: codeOrId,
        p_starts_at: startsAt.toISOString(),
      }),
    )
  },

  // ---- لوحة التحكم ------------------------------------------------------
  async getAgenda(tenantId, from, to) {
    const rows = await rpc<any[]>('get_agenda', {
      p_tenant_id: tenantId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    })
    return (rows ?? []).map(toAgendaItem)
  },

  async listRequests(tenantId) {
    const rows = await rpc<any[]>('list_requests', { p_tenant_id: tenantId })
    return (rows ?? []).map(toAgendaItem)
  },

  async decide(bookingId, decision, reason = null) {
    return toBooking(
      await rpc('admin_decide', {
        p_booking_id: bookingId,
        p_decision: decision,
        p_reason: reason,
      }),
    )
  },

  async moveBooking(bookingId, startsAt, staffId = null) {
    return toAgendaItem(
      await rpc('admin_move_booking', {
        p_booking_id: bookingId,
        p_starts_at: startsAt.toISOString(),
        p_staff_id: staffId,
      }),
    )
  },

  async createAdminBooking(i) {
    return toBooking(
      await rpc('admin_create_booking', {
        p_tenant_id: i.tenantId,
        p_service_id: i.serviceId,
        p_staff_id: i.staffId,
        p_starts_at: i.startsAt.toISOString(),
        p_full_name: i.fullName,
        p_phone: i.phone,
        p_email: i.email ?? null,
        p_notes: i.notes ?? null,
        p_source: i.source ?? 'admin',
      }),
    )
  },

  async listCustomers(tenantId) {
    const rows = await rpc<any[]>('list_customers', { p_tenant_id: tenantId })
    return (Array.isArray(rows) ? rows : []).map(toCustomer)
  },

  async listTimeOff(tenantId) {
    const rows = await rpc<any[]>('list_time_off', { p_tenant_id: tenantId })
    return (Array.isArray(rows) ? rows : []).map(toTimeOff)
  },

  async getStats(tenantId) {
    const rows = await rpc<any[]>('get_stats', { p_tenant_id: tenantId })
    const s = rows?.[0] ?? {}
    return {
      todayCount: s.today_count ?? 0,
      pendingCount: s.pending_count ?? 0,
      queueCount: s.queue_count ?? 0,
      weekCount: s.week_count ?? 0,
      weekRevenueCentimes: Number(s.week_revenue_centimes ?? 0),
      noShowRate: Number(s.no_show_rate ?? 0),
    } as Stats
  },

  async updateSettings(tenantId, patch) {
    const snake: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(patch)) {
      snake[k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())] = v
    }
    const out = await rpc<any>('update_settings', {
      p_tenant_id: tenantId,
      p_patch: snake,
    })
    return camelizeDeep<TenantSettings>(out)
  },

  subscribeBookings(tenantId, onChange) {
    const channel = supabase
      .channel(`bookings:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => onChange(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  },

  // ---- عمليات حسّاسة -----------------------------------------------------
  async cancelBookingAdmin(bookingId, reason) {
    return toBooking(
      await rpc('admin_cancel_booking', {
        p_booking_id: bookingId,
        p_reason: reason,
      }),
    )
  },

  async deleteBooking(bookingId, reason) {
    await rpc('admin_delete_booking', {
      p_booking_id: bookingId,
      p_reason: reason,
    })
  },

  // ---- الطابور ------------------------------------------------------------
  async getQueue(tenantId, day) {
    const rows = await rpc<any[]>('get_queue', {
      p_tenant_id: tenantId,
      p_day: day ?? null,
    })
    return (rows ?? []).map(toTicket)
  },

  async queueJoin(slug, serviceId, staffId, fullName, phone, notes = null) {
    return toBooking(
      await rpc('queue_join', {
        p_slug: slug,
        p_service_id: serviceId,
        p_staff_id: staffId,
        p_full_name: fullName,
        p_phone: phone,
        p_notes: notes,
      }),
    )
  },

  async queueNext(tenantId, staffId, closeAs = 'completed') {
    const rows = await rpc<any[]>('queue_next', {
      p_tenant_id: tenantId,
      p_staff_id: staffId,
      p_close_as: closeAs,
    })
    const r = rows?.[0]
    return {
      finishedId: r?.finished_id ?? null,
      nextId: r?.next_id ?? null,
      nextName: r?.next_name ?? null,
    }
  },

  async queueAdvance(bookingId, places) {
    return toBooking(
      await rpc('queue_advance', {
        p_booking_id: bookingId,
        p_places: places ?? null,
      }),
    )
  },

  async queueSkip(bookingId, places = 1) {
    return toBooking(
      await rpc('queue_skip', {
        p_booking_id: bookingId,
        p_places: places,
      }),
    )
  },

  async queueReorder(bookingId, beforeId, afterId) {
    return toBooking(
      await rpc('queue_reorder', {
        p_booking_id: bookingId,
        p_before_id: beforeId,
        p_after_id: afterId,
      }),
    )
  },

  async queueCall(bookingId) {
    return toBooking(await rpc('queue_call', { p_booking_id: bookingId }))
  },

  // ---- الهوية والإعدادات ---------------------------------------------------
  async updateTenantIdentity(tenantId, p) {
    await rpc('update_tenant_identity', {
      p_tenant_id: tenantId,
      p_name: p.name ?? null,
      p_name_fr: p.nameFr ?? null,
      p_tagline: p.tagline ?? null,
      p_tagline_fr: p.taglineFr ?? null,
      p_phone: p.phone ?? null,
      p_whatsapp: p.whatsapp ?? null,
      p_email: p.email ?? null,
      p_address: p.address ?? null,
      p_city: p.city ?? null,
      p_brand_color: p.brandColor ?? null,
      p_logo_url: p.logoUrl ?? null,
    })
  },

  async upsertStaff(tenantId, i) {
    const out = await rpc<any>('upsert_staff', {
      p_tenant_id: tenantId,
      p_staff_id: i.staffId ?? null,
      p_display_name: i.displayName ?? null,
      p_title: i.title ?? null,
      p_color: i.color ?? null,
      p_is_active: i.isActive ?? null,
      p_sort_order: i.sortOrder ?? null,
      p_service_ids: i.serviceIds ?? null,
    })
    return camelizeDeep<Staff>(out)
  },

  async upsertService(tenantId, i) {
    const out = await rpc<any>('upsert_service', {
      p_tenant_id: tenantId,
      p_service_id: i.serviceId ?? null,
      p_name: i.name ?? null,
      p_name_fr: (i as any).nameFr ?? null,
      p_description: i.description ?? null,
      p_duration_min: i.durationMin ?? null,
      p_price_centimes: i.priceCentimes ?? null,
      p_buffer_before_min: i.bufferBeforeMin ?? null,
      p_buffer_after_min: i.bufferAfterMin ?? null,
      p_color: i.color ?? null,
      p_is_active: i.isActive ?? null,
      p_sort_order: i.sortOrder ?? null,
    })
    return camelizeDeep<Service>(out)
  },

  async updateMyProfile(patch) {
    await rpc('update_my_profile', {
      p_display_name: patch.displayName ?? null,
      p_phone: patch.phone ?? null,
      p_locale: patch.locale ?? null,
      p_avatar_url: null,
    })
  },

  // ---- الجلسة --------------------------------------------------------------
  getSession: readSession,

  async signIn(email, password) {
    if (supabaseConfigProblem) {
      throw new AppError('network', `supabase_not_configured: ${supabaseConfigProblem}`)
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw fromPostgrest(error)
    const s = await readSession()
    // تسجيل الدخول لا يعني الانتماء: حساب بلا سطر في tenant_members لا يدخل اللوحة.
    if (!s) throw new AppError('forbidden')
    return s
  },

  async signOut() {
    cachedPerms = NO_PERMS
    await supabase.auth.signOut()
  },

  onAuthChange(cb) {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void readSession().then(cb).catch(() => cb(null))
    })
    return () => sub.subscription.unsubscribe()
  },

  permissions() {
    return cachedPerms
  },
}
