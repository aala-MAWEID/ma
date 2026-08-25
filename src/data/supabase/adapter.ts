import { supabase, supabaseConfigProblem } from './client'
import { fromPostgrest, AppError } from '../errors'
import {
  NO_PERMS,
  type AdminBookingInput,
  type AvailabilityQuery,
  type ConfirmInput,
  type DataAdapter,
  type DayScheduleRow,
  type Decision,
  type HoldResult,
  type MyBookingRow,
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
  AuthStatus,
  WeekHours,
  WorkingHour,
  ClosedDate,
  PublicQueue,
  TurnStatus,
  TimeOffRow,
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
  async getTenantBundle(slug: string): Promise<TenantBundle> {
    const raw = await rpc<any>('get_tenant_bundle', { p_slug: slug })
    if (!raw || !raw.tenant) {
      throw new AppError('tenant_not_found', `slug=${slug}`)
    }
    return camelizeDeep<TenantBundle>(raw)
  },

  async getAvailability(queryOrSlug, serviceId, staffId, fromDay, days): Promise<Slot[]> {
    const q =
      typeof queryOrSlug === 'object'
        ? {
            slug: queryOrSlug.slug,
            serviceId: queryOrSlug.serviceId,
            staffId: queryOrSlug.staffId ?? null,
            fromDay: normalizeFromDay(queryOrSlug.day ?? queryOrSlug.from),
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

  async holdSlot(slugOrInput, serviceId, staffId, startsAt): Promise<HoldResult> {
    const pSlug = typeof slugOrInput === 'string' ? slugOrInput : slugOrInput.tenantId
    const pServiceId = typeof slugOrInput === 'string' ? serviceId! : slugOrInput.serviceId
    const pStaffId = typeof slugOrInput === 'string' ? staffId! : slugOrInput.staffId
    const pStartsAt = typeof slugOrInput === 'string' ? startsAt! : slugOrInput.startsAt

    const out = await rpc<any>('hold_slot', {
      p_slug: pSlug,
      p_service_id: pServiceId,
      p_staff_id: pStaffId,
      p_starts_at: pStartsAt.toISOString(),
    })

    // الدالة returns table ⇒ مصفوفة. وأسماء الأعمدة: booking_id, code, expires_at.
    const row = (Array.isArray(out) ? out[0] : out) as
      | { booking_id?: string; code?: string; expires_at?: string }
      | undefined

    if (!row?.booking_id || !row.code) throw new AppError('slot_taken')

    const parsed = row.expires_at ? new Date(row.expires_at) : null
    const expiresAt =
      parsed && Number.isFinite(parsed.getTime())
        ? parsed
        : new Date(Date.now() + 10 * 60_000)

    return {
      bookingId: row.booking_id,
      code: row.code,
      expiresAt,
      holdExpiresAt: expiresAt,
      startsAt: pStartsAt,
      serviceId: pServiceId,
      staffId: pStaffId,
    } as HoldResult
  },

  async releaseHold(bookingId: string, code?: string): Promise<void> {
    await rpc('release_hold', { p_booking_id: bookingId, p_code: code ?? null })
  },

  async confirmBooking(
    inputOrBookingId: ConfirmInput | string,
    code?: string,
    fullName?: string,
    phone?: string,
    email?: string,
    notes?: string,
  ): Promise<AgendaItem> {
    const input: ConfirmInput =
      typeof inputOrBookingId === 'object'
        ? inputOrBookingId
        : {
            bookingId: inputOrBookingId,
            code: code ?? '',
            fullName: fullName ?? '',
            phone: phone ?? '',
            email,
            notes,
          }

    return toAgendaItem(
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

  async confirmHold(input: ConfirmInput): Promise<Booking> {
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

  async getBookingByCode(code: string): Promise<AgendaItem> {
    const rows = await rpc<any[]>('get_booking_by_code', { p_code: code })
    if (!rows || rows.length === 0) throw new AppError('booking_not_found')
    return toAgendaItem(rows[0])
  },

  async listBookingsByPhone(slug: string, phone: string): Promise<AgendaItem[]> {
    const rows = await rpc<any[]>('list_bookings_by_phone', {
      p_slug: slug,
      p_phone: phone,
    })
    return (rows ?? []).map(toAgendaItem)
  },

  async cancelBooking(id: string, code?: string, reason?: string): Promise<void> {
    const targetCode = code ?? id
    await rpc('cancel_by_code', { p_code: targetCode, p_reason: reason ?? null })
  },

  async cancelByCode(code: string, reason?: string): Promise<void> {
    await rpc('cancel_by_code', { p_code: code, p_reason: reason ?? null })
  },

  async cancelBookingAdmin(bookingId: string, reason?: string | null): Promise<void> {
    await rpc('admin_cancel_booking', {
      p_booking_id: bookingId,
      p_reason: reason ?? null,
    })
  },

  async deleteBooking(bookingId: string, reason?: string | null): Promise<void> {
    await rpc('admin_delete_booking', {
      p_booking_id: bookingId,
      p_reason: reason ?? null,
    })
  },

  async rescheduleBooking(
    codeOrInput:
      | string
      | {
          code: string
          newStartsAt: Date
          newStaffId?: string
        },
    startsAt?: Date,
    staffId?: string,
    _oldCode?: string,
  ): Promise<AgendaItem | Booking> {
    const code = typeof codeOrInput === 'string' ? codeOrInput : codeOrInput.code
    const nextStartsAt = typeof codeOrInput === 'string' ? startsAt! : codeOrInput.newStartsAt
    const targetStaff = typeof codeOrInput === 'string' ? staffId ?? null : codeOrInput.newStaffId ?? null
    return toAgendaItem(
      await rpc('reschedule_by_code', {
        p_code: code,
        p_starts_at: nextStartsAt.toISOString(),
        p_staff_id: targetStaff,
      }),
    )
  },

  // ---- لوحة التحكم ------------------------------------------------------
  async getAgenda(tenantId: string, from: Date, to: Date): Promise<AgendaItem[]> {
    const rows = await rpc<any[]>('get_agenda', {
      p_tenant_id: tenantId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    })
    return (rows ?? []).map(toAgendaItem)
  },

  async listRequests(tenantId: string): Promise<AgendaItem[]> {
    const rows = await rpc<any[]>('list_requests', { p_tenant_id: tenantId })
    return (rows ?? []).map(toAgendaItem)
  },

  async decide(bookingId: string, decision: Decision, reason?: string): Promise<AgendaItem> {
    return toAgendaItem(
      await rpc('admin_decide', {
        p_booking_id: bookingId,
        p_decision: decision,
        p_reason: reason ?? null,
      }),
    )
  },

  async moveBooking(
    tenantIdOrBookingId: string,
    idOrStartsAt: string | Date,
    startsAtOrStaffId?: Date | string,
    staffId?: string,
  ): Promise<AgendaItem> {
    const bookingId = typeof idOrStartsAt === 'string' ? idOrStartsAt : tenantIdOrBookingId
    const startsAt =
      typeof idOrStartsAt === 'string' ? (startsAtOrStaffId as Date) : (idOrStartsAt as Date)
    const targetStaff = typeof startsAtOrStaffId === 'string' ? startsAtOrStaffId : staffId ?? null

    return toAgendaItem(
      await rpc('admin_move_booking', {
        p_booking_id: bookingId,
        p_starts_at: startsAt.toISOString(),
        p_staff_id: targetStaff,
      }),
    )
  },

  async createAdminBooking(i: AdminBookingInput): Promise<AgendaItem> {
    return toAgendaItem(
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

  async updateBookingStatus(
    tenantId: string,
    id: string,
    status: string,
    reason?: string,
  ): Promise<AgendaItem> {
    return toAgendaItem(
      await rpc('update_booking_status', {
        p_tenant_id: tenantId,
        p_booking_id: id,
        p_status: status,
        p_reason: reason ?? null,
      }),
    )
  },

  async adminCancelBooking(tenantId: string, id: string, reason?: string): Promise<void> {
    await rpc('admin_cancel_booking', {
      p_tenant_id: tenantId,
      p_booking_id: id,
      p_reason: reason ?? null,
    })
  },

  async adminDeleteBooking(tenantId: string, id: string, reason?: string): Promise<void> {
    await rpc('admin_delete_booking', {
      p_tenant_id: tenantId,
      p_booking_id: id,
      p_reason: reason ?? null,
    })
  },

  async getCustomers(tenantId: string, _search?: string): Promise<Customer[]> {
    const rows = await rpc<any[]>('list_customers', { p_tenant_id: tenantId })
    return (Array.isArray(rows) ? rows : []).map(toCustomer)
  },

  async listCustomers(tenantId: string): Promise<Customer[]> {
    const rows = await rpc<any[]>('list_customers', { p_tenant_id: tenantId })
    return (Array.isArray(rows) ? rows : []).map(toCustomer)
  },

  async getStats(tenantId: string): Promise<Stats> {
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

  async updateSettings(tenantId: string, patch: Partial<TenantSettings>): Promise<TenantSettings> {
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

  async updateTenantSettings(
    tenantId: string,
    patch: Partial<TenantSettings>,
  ): Promise<TenantSettings> {
    return this.updateSettings(tenantId, patch)
  },

  subscribeBookings(tenantId: string, onChange: () => void) {
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

  // ---- الطابور ------------------------------------------------------------
  async getQueue(tenantId: string, day?: string): Promise<QueueTicket[]> {
    const rows = await rpc<any[]>('get_queue', {
      p_tenant_id: tenantId,
      p_day: day ?? null,
    })
    return (rows ?? []).map(toTicket)
  },

  async joinQueue(input: {
    tenantId: string
    serviceId: string
    staffId?: string | null
    fullName: string
    phone: string
    notes?: string | null
  }): Promise<QueueTicket> {
    const raw = await rpc<any>('queue_join', {
      p_slug: input.tenantId,
      p_service_id: input.serviceId,
      p_staff_id: input.staffId ?? null,
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_notes: input.notes ?? null,
    })
    return toTicket(raw)
  },

  async queueJoin(
    slug: string,
    serviceId: string,
    staffId: string | null,
    fullName: string,
    phone: string,
    notes?: string | null,
  ): Promise<Booking> {
    return toBooking(
      await rpc('queue_join', {
        p_slug: slug,
        p_service_id: serviceId,
        p_staff_id: staffId,
        p_full_name: fullName,
        p_phone: phone,
        p_notes: notes ?? null,
      }),
    )
  },

  async queueNext(
    tenantId: string,
    staffId?: string | null,
    closeAs: 'completed' | 'no_show' = 'completed',
  ): Promise<{ nextId: string | null; nextName: string | null }> {
    const rows = await rpc<any[]>('queue_next', {
      p_tenant_id: tenantId,
      p_staff_id: staffId ?? null,
      p_close_as: closeAs,
    })
    const r = rows?.[0]
    return {
      nextId: r?.next_id ?? null,
      nextName: r?.next_name ?? null,
    }
  },

  async queueAdvance(bookingId: string, places?: number): Promise<void> {
    await rpc('queue_advance', {
      p_booking_id: bookingId,
      p_places: places ?? null,
    })
  },

  async queueSkip(bookingId: string, places: number = 1): Promise<void> {
    await rpc('queue_skip', {
      p_booking_id: bookingId,
      p_places: places,
    })
  },

  async queueMove(
    bookingId: string,
    beforeId?: string | null,
    afterId?: string | null,
  ): Promise<void> {
    await rpc('queue_reorder', {
      p_booking_id: bookingId,
      p_before_id: beforeId ?? null,
      p_after_id: afterId ?? null,
    })
  },

  async queueCall(bookingId: string): Promise<void> {
    await rpc('queue_call', { p_booking_id: bookingId })
  },

  // ---- الهوية والإعدادات ---------------------------------------------------
  async updateTenantIdentity(tenantId: string, p: Record<string, unknown>): Promise<void> {
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

  async upsertStaff(tenantId: string, i: Record<string, unknown>): Promise<Staff> {
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

  async upsertService(tenantId: string, i: Record<string, unknown>): Promise<Service> {
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

  async updateMyProfile(patch: Record<string, unknown>): Promise<void> {
    await rpc('update_my_profile', {
      p_display_name: patch.displayName ?? null,
      p_phone: patch.phone ?? null,
      p_locale: patch.locale ?? null,
      p_avatar_url: null,
    })
  },

  // ---- الجلسة --------------------------------------------------------------
  getSession: readSession,

  async signInWithGoogle(redirectTo?: string): Promise<void> {
    const target = redirectTo ?? window.location.href
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: target,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) throw new AppError('auth_failed', error.message)
  },

  async authStatus(slug: string): Promise<AuthStatus> {
    return (await rpc('auth_status', { p_slug: slug })) as AuthStatus
  },

  async claimShop(slug: string): Promise<{ tenantId: string; role: string }> {
    return (await rpc('claim_shop', { p_slug: slug })) as { tenantId: string; role: string }
  },

  async listAllStaff(tenantId: string): Promise<Staff[]> {
    return (await rpc('list_all_staff', { p_tenant_id: tenantId })) as Staff[]
  },

  async listAllServices(tenantId: string): Promise<Service[]> {
    return (await rpc('list_all_services', { p_tenant_id: tenantId })) as Service[]
  },

  async deleteStaff(tenantId: string, staffId: string): Promise<void> {
    await rpc('delete_staff', { p_tenant_id: tenantId, p_staff_id: staffId })
  },

  async deleteService(tenantId: string, serviceId: string): Promise<void> {
    await rpc('delete_service', { p_tenant_id: tenantId, p_service_id: serviceId })
  },

  async reorderStaff(tenantId: string, ids: string[]): Promise<unknown[]> {
    return (await rpc('reorder_staff', { p_tenant_id: tenantId, p_ids: ids })) as unknown[]
  },

  async reorderServices(tenantId: string, ids: string[]): Promise<unknown[]> {
    return (await rpc('reorder_services', { p_tenant_id: tenantId, p_ids: ids })) as unknown[]
  },

  async setStaffServices(
    tenantId: string,
    staffId: string,
    serviceIds: string[],
  ): Promise<unknown[]> {
    return (await rpc('set_staff_services', {
      p_tenant_id: tenantId,
      p_staff_id: staffId,
      p_service_ids: serviceIds,
    })) as unknown[]
  },

  async getDaySchedule(tenantId: string, day: string): Promise<DayScheduleRow[]> {
    return (await rpc('get_day_schedule', { p_tenant_id: tenantId, p_day: day })) as never
  },

  async myBookings(slug?: string): Promise<MyBookingRow[]> {
    return (await rpc('my_bookings', { p_slug: slug ?? null })) as never
  },

  async cancelMyBooking(code: string, reason?: string): Promise<void> {
    await rpc('cancel_my_booking', { p_code: code, p_reason: reason ?? null })
  },

  async setWeekHours(
    tenantId: string,
    staffId: string | null,
    week: WeekHours,
  ): Promise<WorkingHour[]> {
    const payload = week.map((d) => ({
      weekday: d.weekday,
      windows: d.windows.map((w) => ({ opens_min: w.opensMin, closes_min: w.closesMin })),
    }))
    return (await rpc('set_week_hours', {
      p_tenant_id: tenantId,
      p_staff_id: staffId,
      p_week: payload,
    })) as WorkingHour[]
  },

  async listClosedDates(tenantId: string): Promise<ClosedDate[]> {
    return (await rpc('list_closed_dates', { p_tenant_id: tenantId })) as ClosedDate[]
  },

  async upsertClosedDate(
    tenantId: string,
    day: string,
    label?: string | null,
  ): Promise<unknown> {
    return await rpc('upsert_closed_date', {
      p_tenant_id: tenantId,
      p_day: day,
      p_reason: label ?? null,
    })
  },

  async deleteClosedDate(tenantId: string, day: string): Promise<unknown> {
    return await rpc('delete_closed_date', { p_tenant_id: tenantId, p_day: day })
  },

  async queuePublic(slug: string, day?: string | null): Promise<PublicQueue> {
    return (await rpc('queue_public', { p_slug: slug, p_day: day ?? null })) as PublicQueue
  },

  async turnStatus(code: string): Promise<TurnStatus> {
    return (await rpc('turn_status', { p_code: code })) as TurnStatus
  },

  async listTimeOff(tenantId: string): Promise<TimeOffRow[]> {
    return ((await rpc('list_time_off', { p_tenant_id: tenantId })) ?? []) as TimeOffRow[]
  },

  async upsertTimeOff(input: {
    tenantId: string
    id?: string | null
    staffId?: string | null
    startsAt: Date
    endsAt: Date
    reason?: string | null
  }): Promise<TimeOffRow> {
    return (await rpc('upsert_time_off', {
      p_tenant_id: input.tenantId,
      p_id: input.id ?? null,
      p_staff_id: input.staffId ?? null,
      p_starts_at: input.startsAt.toISOString(),
      p_ends_at: input.endsAt.toISOString(),
      p_reason: input.reason ?? null,
    })) as TimeOffRow
  },

  async deleteTimeOff(tenantId: string, id: string): Promise<void> {
    await rpc('delete_time_off', { p_tenant_id: tenantId, p_id: id })
  },

  async signIn(email: string, password: string): Promise<Session> {
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

  async signOut(): Promise<void> {
    cachedPerms = NO_PERMS
    await supabase.auth.signOut()
  },

  onAuthChange(cb: (s: Session | null) => void): () => void {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void readSession().then(cb).catch(() => cb(null))
    })
    return () => sub.subscription.unsubscribe()
  },

  permissions(): Permissions {
    return cachedPerms
  },
}
