/**
 * The in-memory backend.
 *
 * It enforces EXACTLY the rules the database will enforce in phase 2:
 *   • a held / pending / confirmed booking occupies its slot, buffers included
 *   • a pending request blocks the slot — otherwise two people request 15:00,
 *     the owner approves both, and two people show up
 *   • holds expire and are swept before every availability read
 *   • every write emits an audit event
 *
 * Network latency is simulated so loading states are real during development.
 */

import type {
  AdminBookingInput,
  AvailabilityQuery,
  ConfirmInput,
  DataAdapter,
  Decision,
  HoldResult,
  Stats,
  TenantBundle,
  AuthStatus,
  WeekHours,
} from '@/data/adapter'
import { AppError } from '@/data/errors'
import type {
  AgendaItem,
  Booking,
  Customer,
  DayKey,
  QueueTicket,
  Service,
  Session,
  Slot,
  Staff,
  TenantSettings,
  TimeOff,
  UUID,
} from '@/types/domain'
import { BLOCKING_STATUSES, MOVABLE_STATUSES } from '@/config/constants'
import { computeAvailability, windowsFor } from '@/lib/availability'
import type { BusyBlock, StaffCandidate } from '@/lib/availability'
import {
  addMinutes,
  dayKeyOf,
  minutesOfDay,
  overlaps,
  todayKey,
  weekdayOf,
} from '@/lib/time'
import { normalizePhone } from '@/lib/validation'
import { bookingCode, store, uid } from '@/data/mock/store'
import { DEMO_OWNER } from '@/data/mock/seed'

const LATENCY_MS = 180

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

/** Sweep expired holds. Called before every read that depends on occupancy. */
function sweep(): void {
  const now = Date.now()
  const db = store.read()
  const stale = db.bookings.some(
    (b) => b.status === 'held' && (b.holdExpiresAt?.getTime() ?? 0) <= now,
  )
  if (!stale) return
  store.write((d) => {
    d.bookings = d.bookings.filter(
      (b) => !(b.status === 'held' && (b.holdExpiresAt?.getTime() ?? 0) <= now),
    )
  })
}

/** The buffered range a booking occupies. Mirrors the SQL `block` column. */
function blockOf(b: Booking): BusyBlock {
  return {
    staffId: b.staffId,
    start: addMinutes(b.startsAt, -b.bufferBeforeMin),
    end: addMinutes(b.endsAt, b.bufferAfterMin),
  }
}

function busyBlocks(exceptId?: UUID): BusyBlock[] {
  return store
    .read()
    .bookings.filter((b) => BLOCKING_STATUSES.includes(b.status) && b.id !== exceptId)
    .map(blockOf)
}

function timeOffBlocks(): Array<{ staffId: UUID | null; start: Date; end: Date }> {
  return store.read().timeOff.map((t: TimeOff) => ({
    staffId: t.staffId,
    start: t.startsAt,
    end: t.endsAt,
  }))
}

/** Staff who can perform this service, with their resolved duration. */
function candidatesFor(serviceId: UUID, staffId: UUID | null): StaffCandidate[] {
  const db = store.read()
  const service = db.services.find((s) => s.id === serviceId)
  if (!service) throw new AppError('service_not_found')

  const staffPool = staffId ? db.staff.filter((s) => s.id === staffId) : db.staff
  const activeStaff = staffPool.filter((s) => s.isActive)

  return activeStaff
    .filter((s) => db.staffServices.some((ss) => ss.staffId === s.id && ss.serviceId === serviceId))
    .map((s) => {
      const link = db.staffServices.find((ss) => ss.staffId === s.id && ss.serviceId === serviceId)
      return {
        id: s.id,
        name: s.displayName,
        sortOrder: s.sortOrder,
        durationMin: link?.durationOverrideMin ?? service.durationMin,
      }
    })
}

/** Hydrate a booking row into the rich AgendaItem with resolved names and colors. */
function hydrate(b: Booking): AgendaItem {
  const db = store.read()
  const service = db.services.find((s) => s.id === b.serviceId)
  const staff = db.staff.find((s) => s.id === b.staffId)
  const customer = b.customerId ? db.customers.find((c) => c.id === b.customerId) : undefined

  return {
    ...b,
    staffName: staff?.displayName ?? '—',
    staffColor: staff?.color,
    serviceName: service?.name ?? '—',
    serviceColor: service?.color,
    customerName: customer?.fullName,
    customerPhone: customer?.phone,
  }
}

function logEvent(
  bookingId: UUID,
  kind:
    | 'created'
    | 'status'
    | 'moved'
    | 'queued'
    | 'reordered'
    | 'skipped'
    | 'served'
    | 'note'
    | 'deleted',
  patch: Partial<Booking> & {
    fromStatus?: Booking['status']
    toStatus?: Booking['status']
    fromStartsAt?: Date
    toStartsAt?: Date
    note?: string
  } = {},
): void {
  const actor = store.read().session ? 'owner' : 'customer'
  store.write((d) => {
    d.events.push({
      id: uid('ev'),
      bookingId,
      actorLabel: actor,
      kind,
      fromStatus: patch.fromStatus,
      toStatus: patch.toStatus,
      fromStartsAt: patch.fromStartsAt,
      toStartsAt: patch.toStartsAt,
      note: patch.note,
      createdAt: new Date(),
    })
  })
}

/**
 * The single validator for every booking attempt: holds, confirms, moves,
 * and admin creations all run through this.
 */
function assertBookable(
  serviceId: UUID,
  staffId: UUID,
  startsAt: Date,
  bypassNotice = false,
  ignoreBookingId?: UUID,
): {
  durationMin: number
  bufferBeforeMin: number
  bufferAfterMin: number
  priceCentimes: number
} {
  const db = store.read()
  const tz = db.tenant.timeZone
  const service = db.services.find((s) => s.id === serviceId && s.isActive)
  if (!service) throw new AppError('service_not_found')

  const staff = db.staff.find((s) => s.id === staffId && s.isActive)
  if (!staff) throw new AppError('staff_unavailable')

  const link = db.staffServices.find((ss) => ss.staffId === staffId && ss.serviceId === serviceId)
  if (!link) throw new AppError('service_not_found')

  const durationMin = link.durationOverrideMin ?? service.durationMin
  const priceCentimes = link.priceOverrideCentimes ?? service.priceCentimes
  const bufferBeforeMin = service.bufferBeforeMin
  const bufferAfterMin = service.bufferAfterMin

  const day = dayKeyOf(startsAt, tz)
  const now = new Date()
  const today = todayKey(tz)

  // closed date
  if (db.closedDates.some((c) => c.day === day)) {
    throw new AppError('slot_taken')
  }

  // advance days
  const [y, m, dNum] = today.split('-').map(Number)
  const maxAdvance = (db.settings.maxAdvanceDays ?? 30) * 86_400_000
  if (startsAt.getTime() > Date.now() + maxAdvance) {
    throw new AppError('too_far')
  }

  // notice
  const minNotice = bypassNotice ? 0 : (db.settings.minNoticeMin ?? 120) * 60_000
  if (startsAt.getTime() < Date.now() + minNotice) {
    throw new AppError('too_soon')
  }

  const startMin = minutesOfDay(startsAt, tz)
  const endMin = startMin + durationMin
  const weekday = weekdayOf(day)

  // working hours
  const windows = windowsFor(db.workingHours, staffId, weekday)
  const fits = windows.some((w) => startMin >= w.opensMin && endMin <= w.closesMin)
  if (!fits) throw new AppError('slot_taken')

  // time off
  const endsAt = addMinutes(startsAt, durationMin)
  const off = db.timeOff.some((t) => {
    if (t.staffId !== null && t.staffId !== staffId) return false
    return overlaps(startsAt, endsAt, t.startsAt, t.endsAt)
  })
  if (off) throw new AppError('slot_taken')

  // existing bookings
  const blockStart = addMinutes(startsAt, -bufferBeforeMin)
  const blockEnd = addMinutes(endsAt, bufferAfterMin)
  const busy = db.bookings.some((b) => {
    if (b.id === ignoreBookingId) return false
    if (b.staffId !== staffId) return false
    if (!BLOCKING_STATUSES.includes(b.status)) return false
    const bStart = addMinutes(b.startsAt, -b.bufferBeforeMin)
    const bEnd = addMinutes(b.endsAt, b.bufferAfterMin)
    return overlaps(blockStart, blockEnd, bStart, bEnd)
  })
  if (busy) throw new AppError('slot_taken')

  // daily cap
  if (service.maxPerDay != null) {
    const count = db.bookings.filter(
      (b) =>
        b.serviceId === serviceId &&
        b.id !== ignoreBookingId &&
        BLOCKING_STATUSES.includes(b.status) &&
        dayKeyOf(b.startsAt, tz) === day,
    ).length
    if (count >= service.maxPerDay) throw new AppError('slot_taken')
  }

  return { durationMin, bufferBeforeMin, bufferAfterMin, priceCentimes }
}

export const mockAdapter: DataAdapter = {
  // ---- public reads -------------------------------------------------------
  async getTenantBundle(slug: string) {
    const db = store.read()
    if (db.tenant.slug !== slug) throw new AppError('tenant_not_found')
    return delay<TenantBundle>({
      tenant: db.tenant,
      settings: db.settings,
      staff: db.staff.filter((s) => s.isActive),
      services: db.services.filter((s) => s.isActive),
      staffServices: db.staffServices,
      workingHours: db.workingHours,
      closedDates: db.closedDates,
    })
  },

  async getAvailability(queryOrSlug, serviceId, staffId, fromDay, days) {
    sweep()
    const db = store.read()

    const q: { slug: string; serviceId: string; staffId: string | null; from: string; days: number } =
      typeof queryOrSlug === 'object'
        ? {
            slug: queryOrSlug.slug,
            serviceId: queryOrSlug.serviceId,
            staffId: queryOrSlug.staffId ?? null,
            from: queryOrSlug.from ?? queryOrSlug.fromDay ?? '1970-01-01',
            days: queryOrSlug.days ?? 14,
          }
        : {
            slug: queryOrSlug,
            serviceId: serviceId!,
            staffId: staffId ?? null,
            from: fromDay ?? '1970-01-01',
            days: days ?? 14,
          }

    const service = db.services.find((s) => s.id === q.serviceId)
    if (!service) throw new AppError('service_not_found')

    const slots = computeAvailability({
      now: new Date(),
      timeZone: db.tenant.timeZone,
      from: q.from,
      days: q.days,
      granularityMin: db.settings.slotGranularityMin ?? 15,
      minNoticeMin: db.settings.minNoticeMin ?? 120,
      maxAdvanceDays: db.settings.maxAdvanceDays ?? 30,
      todayKey: todayKey(db.tenant.timeZone),
      bufferBeforeMin: service.bufferBeforeMin,
      bufferAfterMin: service.bufferAfterMin,
      maxPerDay: service.maxPerDay,
      staff: candidatesFor(q.serviceId, q.staffId),
      workingHours: db.workingHours,
      closedDays: new Set(db.closedDates.map((c) => c.day)),
      timeOff: timeOffBlocks(),
      busy: busyBlocks(),
    })
    return delay<Slot[]>(slots)
  },

  async getOpenDays(queryOrSlug, serviceId, staffId, fromDay, days) {
    const slots = await this.getAvailability(queryOrSlug, serviceId, staffId, fromDay, days)
    const tz = store.read().tenant.timeZone
    const openSet = new Set<string>()
    for (const s of slots) {
      openSet.add(dayKeyOf(s.start, tz))
    }
    return delay<string[]>(Array.from(openSet))
  },

  // ---- booking flow -------------------------------------------------------
  async holdSlot(slug, serviceId, staffId, startsAt) {
    sweep()
    const db = store.read()
    if (db.tenant.slug !== slug) throw new AppError('tenant_not_found')

    const g = assertBookable(serviceId, staffId, startsAt, false)
    const id = uid('b')
    const code = bookingCode()
    const expiresAt = new Date(Date.now() + (db.settings.holdTtlMin ?? 10) * 60_000)

    const booking: Booking = {
      id,
      tenantId: db.tenant.id,
      staffId,
      serviceId,
      startsAt,
      endsAt: addMinutes(startsAt, g.durationMin),
      bufferBeforeMin: g.bufferBeforeMin,
      bufferAfterMin: g.bufferAfterMin,
      status: 'held',
      source: 'web',
      priceCentimes: g.priceCentimes,
      currency: db.tenant.currency,
      code,
      holdExpiresAt: expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    store.write((d) => {
      d.bookings.push(booking)
    })

    return delay<HoldResult & Booking>({
      ...booking,
      bookingId: id,
      code,
      expiresAt,
      holdExpiresAt: expiresAt,
      booking,
    })
  },

  async releaseHold(bookingId, _code) {
    store.write((d) => {
      d.bookings = d.bookings.filter((b) => !(b.id === bookingId && b.status === 'held'))
    })
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

    const db = store.read()
    const booking = db.bookings.find((b) => b.id === input.bookingId)
    if (!booking || booking.code !== input.code) throw new AppError('booking_not_found')
    if (booking.status !== 'held') throw new AppError('hold_already_used')
    if ((booking.holdExpiresAt?.getTime() ?? 0) <= Date.now()) {
      throw new AppError('hold_expired')
    }

    const normPhone = normalizePhone(input.phone)
    if (!normPhone) throw new AppError('invalid_phone')
    if (input.fullName.trim().length < 2) throw new AppError('invalid_name')

    let customer = db.customers.find((c) => c.phone === normPhone)
    if (customer?.isBlocked) throw new AppError('customer_blocked')

    const activeCount = db.bookings.filter(
      (b) =>
        b.customerId === customer?.id &&
        (b.status === 'pending' || b.status === 'confirmed') &&
        b.startsAt.getTime() > Date.now(),
    ).length
    if (customer && activeCount >= (db.settings.maxActivePerCustomer ?? 3)) {
      throw new AppError('too_many_active')
    }

    const service = db.services.find((s) => s.id === booking.serviceId)
    const autoConfirm = db.settings.autoConfirm && !service?.requiresApproval
    const nextStatus: Booking['status'] = autoConfirm ? 'confirmed' : 'pending'

    store.write((d) => {
      if (!customer) {
        customer = {
          id: uid('c'),
          tenantId: d.tenant.id,
          fullName: input.fullName.trim(),
          phone: normPhone,
          email: input.email?.trim() || undefined,
          locale: (input.locale as Customer['locale']) ?? 'ar',
          isBlocked: false,
          noShowCount: 0,
          totalBookings: 0,
          createdAt: new Date(),
        }
        d.customers.push(customer)
      } else {
        customer.fullName = input.fullName.trim()
        if (input.email) customer.email = input.email.trim()
      }

      const target = d.bookings.find((b) => b.id === input.bookingId)!
      target.customerId = customer.id
      target.notesCustomer = input.notes?.trim() || undefined
      target.status = nextStatus
      target.holdExpiresAt = undefined
      target.updatedAt = new Date()
      if (nextStatus === 'confirmed') customer.totalBookings += 1
    })

    logEvent(input.bookingId, 'created', { toStatus: nextStatus })
    return delay(store.read().bookings.find((b) => b.id === input.bookingId)!)
  },

  // ---- customer -----------------------------------------------------------
  async getBookingByCode(code) {
    const b = store.read().bookings.find((x) => x.code === code.trim().toUpperCase())
    if (!b) return delay(null)
    return delay(hydrate(b))
  },

  async listBookingsByPhone(_slug, phone) {
    const normalized = normalizePhone(phone)
    if (!normalized) throw new AppError('invalid_phone')
    const db = store.read()
    const customer = db.customers.find((c) => c.phone === normalized)
    if (!customer) return delay<AgendaItem[]>([])
    const list = db.bookings
      .filter((b) => b.customerId === customer.id && b.status !== 'held')
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .map(hydrate)
    return delay(list)
  },

  async cancelBooking(codeOrId, reason = null) {
    const db = store.read()
    const b = db.bookings.find((x) => x.code === codeOrId || x.id === codeOrId)
    if (!b) throw new AppError('booking_not_found')

    const isMember = db.session?.tenantId === b.tenantId
    if (['cancelled', 'declined', 'completed', 'no_show'].includes(b.status)) {
      throw new AppError('already_closed')
    }
    if (!isMember) {
      if (!db.settings.allowCustomerCancel) throw new AppError('cancel_disabled')
      if (b.startsAt.getTime() - (db.settings.cancelCutoffMin ?? 240) * 60_000 < Date.now()) {
        throw new AppError('cutoff_passed')
      }
    }

    store.write((d) => {
      const t = d.bookings.find((x) => x.id === b.id)!
      t.status = 'cancelled'
      t.cancelReason = reason ?? undefined
      t.updatedAt = new Date()
    })
    logEvent(b.id, 'status', { fromStatus: b.status, toStatus: 'cancelled', note: reason ?? undefined })
    return delay(store.read().bookings.find((x) => x.id === b.id)!)
  },

  async rescheduleBooking(codeOrId, startsAt, staffId, _code) {
    const db = store.read()
    const b = db.bookings.find((x) => x.code === codeOrId || x.id === codeOrId)
    if (!b) throw new AppError('booking_not_found')

    const isMember = db.session?.tenantId === b.tenantId
    if (!MOVABLE_STATUSES.includes(b.status)) throw new AppError('not_reschedulable')
    if (!isMember) {
      if (!db.settings.allowCustomerReschedule) throw new AppError('reschedule_disabled')
      if (b.startsAt.getTime() - (db.settings.rescheduleCutoffMin ?? 240) * 60_000 < Date.now()) {
        throw new AppError('cutoff_passed')
      }
    }

    const nextStaff = staffId ?? b.staffId
    const g = assertBookable(b.serviceId, nextStaff, startsAt, isMember, b.id)

    const newId = uid('b')
    const newCode = bookingCode()
    store.write((d) => {
      const old = d.bookings.find((x) => x.id === b.id)!
      old.status = 'cancelled'
      old.cancelReason = 'rescheduled'
      old.updatedAt = new Date()
      d.bookings.push({
        ...old,
        id: newId,
        code: newCode,
        staffId: nextStaff,
        startsAt,
        endsAt: addMinutes(startsAt, g.durationMin),
        status: b.status,
        cancelReason: undefined,
        rescheduleOf: b.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })
    logEvent(newId, 'moved', { fromStartsAt: b.startsAt, toStartsAt: startsAt })
    return delay(store.read().bookings.find((x) => x.id === newId)!)
  },

  // ---- owner / admin ------------------------------------------------------
  async getAgenda(tenantId, from, to) {
    sweep()
    const list = store
      .read()
      .bookings.filter(
        (b) =>
          b.tenantId === tenantId &&
          b.status !== 'held' &&
          b.startsAt.getTime() < to.getTime() &&
          b.endsAt.getTime() > from.getTime(),
      )
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map(hydrate)
    return delay(list)
  },

  async listRequests(tenantId) {
    const list = store
      .read()
      .bookings.filter((b) => b.tenantId === tenantId && b.status === 'pending')
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map(hydrate)
    return delay(list)
  },

  async decide(bookingId, decision: Decision, reason = null) {
    const db = store.read()
    const b = db.bookings.find((x) => x.id === bookingId)
    if (!b) throw new AppError('booking_not_found')
    if (db.session?.tenantId !== b.tenantId) throw new AppError('forbidden')

    const next: Booking['status'] =
      decision === 'confirm' ? 'confirmed'
      : decision === 'decline' ? 'declined'
      : decision === 'complete' ? 'completed'
      : 'no_show'

    store.write((d) => {
      const t = d.bookings.find((x) => x.id === bookingId)!
      t.status = next
      if (decision === 'decline') t.cancelReason = reason ?? undefined
      t.updatedAt = new Date()

      if (next === 'no_show' && t.customerId) {
        const c = d.customers.find((x) => x.id === t.customerId)
        if (c) {
          c.noShowCount += 1
          if (c.noShowCount >= (d.settings.blockAfterNoShows ?? 2)) c.isBlocked = true
        }
      }
      if (next === 'confirmed' && t.customerId) {
        const c = d.customers.find((x) => x.id === t.customerId)
        if (c) c.totalBookings += 1
      }
    })
    logEvent(bookingId, 'status', { fromStatus: b.status, toStatus: next, note: reason ?? undefined })
    return delay(store.read().bookings.find((x) => x.id === bookingId)!)
  },

  async moveBooking(bookingId, startsAt, staffId) {
    const db = store.read()
    const b = db.bookings.find((x) => x.id === bookingId)
    if (!b) throw new AppError('booking_not_found')
    if (db.session?.tenantId !== b.tenantId) throw new AppError('forbidden')
    if (!MOVABLE_STATUSES.includes(b.status)) throw new AppError('not_movable')

    const nextStaff = staffId ?? b.staffId
    const g = assertBookable(b.serviceId, nextStaff, startsAt, true, b.id)

    store.write((d) => {
      const t = d.bookings.find((x) => x.id === bookingId)!
      t.startsAt = startsAt
      t.endsAt = addMinutes(startsAt, g.durationMin)
      t.staffId = nextStaff
      t.updatedAt = new Date()
    })
    logEvent(bookingId, 'moved', { fromStartsAt: b.startsAt, toStartsAt: startsAt })
    return delay(hydrate(store.read().bookings.find((x) => x.id === bookingId)!))
  },

  async createAdminBooking(input: AdminBookingInput) {
    const db = store.read()
    if (db.session?.tenantId !== input.tenantId) throw new AppError('forbidden')

    const g = assertBookable(input.serviceId, input.staffId, input.startsAt, true)
    const phone = normalizePhone(input.phone)
    if (!phone) throw new AppError('invalid_phone')

    const id = uid('b')
    store.write((d) => {
      let customer = d.customers.find((c) => c.phone === phone)
      if (!customer) {
        customer = {
          id: uid('c'),
          tenantId: input.tenantId,
          fullName: input.fullName.trim(),
          phone,
          email: input.email ?? undefined,
          locale: 'ar',
          isBlocked: false,
          noShowCount: 0,
          totalBookings: 0,
          createdAt: new Date(),
        }
        d.customers.push(customer)
      }
      d.bookings.push({
        id,
        tenantId: input.tenantId,
        customerId: customer.id,
        staffId: input.staffId,
        serviceId: input.serviceId,
        startsAt: input.startsAt,
        endsAt: addMinutes(input.startsAt, g.durationMin),
        bufferBeforeMin: g.bufferBeforeMin,
        bufferAfterMin: g.bufferAfterMin,
        status: 'confirmed',
        source: input.source ?? 'admin',
        priceCentimes: g.priceCentimes,
        currency: d.tenant.currency,
        notesInternal: input.notes ?? undefined,
        code: bookingCode(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })
    logEvent(id, 'created', { toStatus: 'confirmed' })
    return delay(store.read().bookings.find((x) => x.id === id)!)
  },

  async listCustomers(tenantId) {
    const list = store
      .read()
      .customers.filter((c) => c.tenantId === tenantId)
      .sort((a, b) => b.totalBookings - a.totalBookings)
    return delay(list)
  },

  async listTimeOff(tenantId) {
    return delay(store.read().timeOff.filter((t) => t.tenantId === tenantId))
  },

  async getStats(tenantId) {
    const db = store.read()
    const tz = db.tenant.timeZone
    const today = todayKey(tz)
    const weekAgo = Date.now() - 7 * 86_400_000
    const mine = db.bookings.filter((b) => b.tenantId === tenantId)

    const week = mine.filter(
      (b) =>
        b.startsAt.getTime() >= weekAgo &&
        ['confirmed', 'completed'].includes(b.status),
    )
    const closed = mine.filter((b) => ['completed', 'no_show'].includes(b.status))

    return delay<Stats>({
      todayCount: mine.filter(
        (b) => dayKeyOf(b.startsAt, tz) === today && b.status !== 'cancelled',
      ).length,
      pendingCount: mine.filter((b) => b.status === 'pending').length,
      queueCount: mine.filter((b) => ['pending', 'confirmed', 'serving'].includes(b.status) && (b.mode === 'queue' || b.source === 'walk_in')).length,
      weekCount: week.length,
      weekRevenueCentimes: week.reduce((sum, b) => sum + b.priceCentimes, 0),
      noShowRate: closed.length
        ? mine.filter((b) => b.status === 'no_show').length / closed.length
        : 0,
    })
  },

  async updateSettings(tenantId, patch) {
    let updated: TenantSettings | null = null
    store.write((d) => {
      if (d.tenant.id === tenantId) {
        d.settings = { ...d.settings, ...patch }
        updated = d.settings
      }
    })
    if (!updated) throw new AppError('tenant_not_found')
    return delay(updated)
  },

  // ---- destructive --------------------------------------------------------
  async cancelBookingAdmin(bookingId, reason) {
    let updated: Booking | null = null
    store.write((d) => {
      const b = d.bookings.find((x) => x.id === bookingId)
      if (!b) return
      b.status = 'cancelled'
      b.cancelReason = reason ?? undefined
      b.updatedAt = new Date()
      updated = b
      d.events.push({
        id: uid('ev'),
        bookingId,
        actorLabel: 'admin',
        kind: 'status',
        toStatus: 'cancelled',
        note: reason ?? undefined,
        createdAt: new Date(),
      })
    })
    if (!updated) throw new AppError('booking_not_found')
    return delay(updated)
  },

  async deleteBooking(bookingId, reason) {
    let found = false
    store.write((d) => {
      const idx = d.bookings.findIndex((x) => x.id === bookingId)
      if (idx !== -1) {
        d.bookings.splice(idx, 1)
        found = true
        d.events.push({
          id: uid('ev'),
          bookingId,
          actorLabel: 'admin',
          kind: 'deleted',
          note: reason ?? undefined,
          createdAt: new Date(),
        })
      }
    })
    if (!found) throw new AppError('booking_not_found')
    return delay(undefined)
  },

  // ---- queue --------------------------------------------------------------
  async getQueue(tenantId) {
    const s = store.read()
    const staffMap = new Map(s.staff.map((st) => [st.id, st]))
    const srvMap = new Map(s.services.map((sv) => [sv.id, sv]))
    const custMap = new Map(s.customers.map((c) => [c.id, c]))

    const queueBookings = s.bookings
      .filter((b) => b.tenantId === tenantId && (b.mode === 'queue' || b.source === 'walk_in' || ['pending', 'confirmed', 'serving'].includes(b.status)))
      .sort((a, b) => {
        if (a.status === 'serving' && b.status !== 'serving') return -1
        if (b.status === 'serving' && a.status !== 'serving') return 1
        return (a.queueRank ?? 1000) - (b.queueRank ?? 1000)
      })

    const tickets: QueueTicket[] = queueBookings.map((b, i) => {
      const st = staffMap.get(b.staffId)
      const sv = srvMap.get(b.serviceId)
      const c = b.customerId ? custMap.get(b.customerId) : null
      return {
        id: b.id,
        position: i + 1,
        queueRank: b.queueRank ?? (i + 1) * 1000,
        status: b.status,
        staffId: b.staffId,
        staffName: st?.displayName ?? 'أي شخص',
        staffColor: st?.color ?? '#0E7C86',
        serviceId: b.serviceId,
        serviceName: sv?.name ?? 'خدمة',
        durationMin: sv?.durationMin ?? 30,
        customerId: b.customerId ?? null,
        customerName: c?.fullName ?? (b.notesCustomer ? b.notesCustomer.split('\n')[0]! : 'زبون'),
        customerPhone: c?.phone ?? null,
        code: b.code,
        skippedCount: b.skippedCount ?? 0,
        createdAt: b.createdAt,
        servedAt: b.servedAt ?? null,
        etaMinutes: Math.max(0, i * 20),
      }
    })
    return delay(tickets)
  },

  async queueJoin(slug, serviceId, staffId, fullName, phone, notes = null) {
    const s = store.read()
    if (s.tenant.slug !== slug) throw new AppError('tenant_not_found')
    const srv = s.services.find((x) => x.id === serviceId)
    if (!srv) throw new AppError('service_not_found')

    let customer = s.customers.find((c) => c.phone === phone)
    if (!customer) {
      customer = {
        id: uid('c'),
        tenantId: s.tenant.id,
        fullName,
        phone,
        locale: 'ar',
        isBlocked: false,
        noShowCount: 0,
        totalBookings: 1,
        createdAt: new Date(),
      }
      store.write((d) => d.customers.push(customer!))
    }

    const now = new Date()
    const maxRank = s.bookings.reduce((max, b) => Math.max(max, b.queueRank ?? 0), 0)
    const booking: Booking = {
      id: uid('b'),
      tenantId: s.tenant.id,
      customerId: customer.id,
      staffId,
      serviceId,
      startsAt: now,
      endsAt: addMinutes(now, srv.durationMin),
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      status: 'confirmed',
      mode: 'queue',
      source: 'walk_in',
      priceCentimes: srv.priceCentimes,
      currency: s.tenant.currency,
      code: bookingCode(),
      queueRank: maxRank + 1000,
      notesCustomer: notes ?? undefined,
      createdAt: now,
      updatedAt: now,
    }

    store.write((d) => {
      d.bookings.push(booking)
      d.events.push({
        id: uid('ev'),
        bookingId: booking.id,
        actorLabel: 'customer',
        kind: 'queued',
        createdAt: now,
      })
    })

    return delay(booking)
  },

  async queueNext(tenantId, staffId, closeAs = 'completed') {
    let finishedId: string | null = null
    let nextId: string | null = null
    let nextName: string | null = null

    store.write((d) => {
      const serving = d.bookings.find(
        (b) => b.tenantId === tenantId && b.status === 'serving' && (!staffId || b.staffId === staffId),
      )
      if (serving) {
        serving.status = closeAs
        serving.updatedAt = new Date()
        finishedId = serving.id
      }

      const next = d.bookings
        .filter(
          (b) =>
            b.tenantId === tenantId &&
            ['pending', 'confirmed'].includes(b.status) &&
            (!staffId || b.staffId === staffId),
        )
        .sort((a, b) => (a.queueRank ?? 1000) - (b.queueRank ?? 1000))[0]

      if (next) {
        next.status = 'serving'
        next.servedAt = new Date()
        next.updatedAt = new Date()
        nextId = next.id
        const cust = d.customers.find((c) => c.id === next.customerId)
        nextName = cust?.fullName ?? 'زبون'
      }
    })

    return delay({ finishedId, nextId, nextName })
  },

  async queueAdvance(bookingId, places) {
    let updated: Booking | null = null
    store.write((d) => {
      const b = d.bookings.find((x) => x.id === bookingId)
      if (!b) return
      if (places == null) {
        const minRank = d.bookings.reduce((min, cur) => Math.min(min, cur.queueRank ?? 1000), 1000)
        b.queueRank = minRank - 1000
      } else {
        b.queueRank = (b.queueRank ?? 1000) - places * 1000
      }
      b.updatedAt = new Date()
      updated = b
    })
    if (!updated) throw new AppError('booking_not_found')
    return delay(updated)
  },

  async queueSkip(bookingId, places = 1) {
    let updated: Booking | null = null
    store.write((d) => {
      const b = d.bookings.find((x) => x.id === bookingId)
      if (!b) return
      b.queueRank = (b.queueRank ?? 1000) + places * 1000
      b.skippedCount = (b.skippedCount ?? 0) + places
      b.updatedAt = new Date()
      updated = b
    })
    if (!updated) throw new AppError('booking_not_found')
    return delay(updated)
  },

  async queueReorder(bookingId, beforeId, afterId) {
    let updated: Booking | null = null
    store.write((d) => {
      const b = d.bookings.find((x) => x.id === bookingId)
      if (!b) return
      const r1 = beforeId ? d.bookings.find((x) => x.id === beforeId)?.queueRank : null
      const r2 = afterId ? d.bookings.find((x) => x.id === afterId)?.queueRank : null

      if (r1 != null && r2 != null) {
        b.queueRank = (r1 + r2) / 2
      } else if (r1 != null) {
        b.queueRank = r1 + 1000
      } else if (r2 != null) {
        b.queueRank = r2 - 1000
      } else {
        b.queueRank = 1000
      }
      b.updatedAt = new Date()
      updated = b
    })
    if (!updated) throw new AppError('booking_not_found')
    return delay(updated)
  },

  async queueCall(bookingId) {
    let updated: Booking | null = null
    store.write((d) => {
      const b = d.bookings.find((x) => x.id === bookingId)
      if (!b) return
      b.status = 'serving'
      b.servedAt = new Date()
      b.updatedAt = new Date()
      updated = b
    })
    if (!updated) throw new AppError('booking_not_found')
    return delay(updated)
  },

  // ---- identity -----------------------------------------------------------
  async updateTenantIdentity(tenantId, patch) {
    store.write((d) => {
      if (d.tenant.id === tenantId) {
        Object.assign(d.tenant, patch)
      }
    })
    return delay(undefined)
  },

  async upsertStaff(tenantId, input) {
    let result: Staff | null = null
    store.write((d) => {
      if (input.staffId) {
        const s = d.staff.find((x) => x.id === input.staffId)
        if (s) {
          if (input.displayName != null) s.displayName = input.displayName
          if (input.title != null) s.title = input.title
          if (input.color != null) s.color = input.color
          if (input.isActive != null) s.isActive = input.isActive
          if (input.sortOrder != null) s.sortOrder = input.sortOrder
          result = s
        }
      } else {
        const s: Staff = {
          id: uid('st'),
          tenantId,
          displayName: input.displayName ?? 'عامل جديد',
          title: input.title ?? undefined,
          color: input.color ?? '#0E7C86',
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? d.staff.length + 1,
        }
        d.staff.push(s)
        result = s
      }
    })
    if (!result) throw new AppError('staff_not_found')
    return delay(result)
  },

  async upsertService(tenantId, input) {
    let result: Service | null = null
    store.write((d) => {
      if (input.serviceId) {
        const s = d.services.find((x) => x.id === input.serviceId)
        if (s) {
          Object.assign(s, input)
          result = s
        }
      } else {
        const s: Service = {
          id: uid('sv'),
          tenantId,
          name: input.name ?? 'خدمة جديدة',
          nameFr: (input as any).nameFr ?? undefined,
          description: input.description ?? undefined,
          category: input.category ?? 'general',
          durationMin: input.durationMin ?? 30,
          bufferBeforeMin: input.bufferBeforeMin ?? 0,
          bufferAfterMin: input.bufferAfterMin ?? 0,
          priceCentimes: input.priceCentimes ?? 5000,
          requiresApproval: input.requiresApproval ?? false,
          color: input.color ?? undefined,
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? d.services.length + 1,
        }
        d.services.push(s)
        result = s
      }
    })
    if (!result) throw new AppError('service_not_found')
    return delay(result)
  },

  async updateMyProfile(patch) {
    store.write((d) => {
      if (d.session) {
        if (patch.displayName) d.session.displayName = patch.displayName
      }
    })
    return delay(undefined)
  },

  // ---- live ---------------------------------------------------------------
  subscribeBookings(_tenantId, onChange) {
    return store.subscribe(onChange)
  },

  async signInWithGoogle() {
    throw new Error('Mock backend does not support Google sign in.')
  },
  
  async authStatus(slug: string) {
    const s = store.read().session
    return delay({
      authenticated: !!s,
      userId: s?.userId,
      email: s?.email,
      displayName: s?.displayName,
      tenantId: s?.tenantId,
      tenantSlug: s?.tenantSlug,
      tenantName: s?.tenantName,
      tenantFound: true,
      tenantHasOwner: true,
      isMember: s?.tenantSlug === slug,
      role: s?.tenantSlug === slug ? s?.role : null,
      canClaim: false,
    })
  },

  async claimShop(slug: string) {
    throw new Error('Not supported in mock.')
  },

  async listAllStaff(tenantId: string) {
    return delay(store.read().staff.filter((s) => s.tenantId === tenantId))
  },

  async listAllServices(tenantId: string) {
    return delay(store.read().services.filter((s) => s.tenantId === tenantId))
  },

  async deleteStaff(tenantId: string, staffId: string) {
    store.write((d) => {
      d.staff = d.staff.filter((s) => s.id !== staffId)
    })
    return delay(undefined)
  },

  async deleteService(tenantId: string, serviceId: string) {
    store.write((d) => {
      d.services = d.services.filter((s) => s.id !== serviceId)
    })
    return delay(undefined)
  },

  async setWeekHours(tenantId: string, staffId: string | null, week: WeekHours) {
    throw new Error('Not implemented in mock')
  },

  async listClosedDates(tenantId: string) {
    return delay(store.read().closedDates.filter((c) => c.tenantId === tenantId))
  },

  async upsertClosedDate(tenantId: string, day: string, label?: string | null) {
    store.write((d) => {
      const idx = d.closedDates.findIndex((c) => c.day === day && c.tenantId === tenantId)
      if (idx !== -1) {
        d.closedDates[idx] = { ...d.closedDates[idx]!, label: label ?? undefined }
      } else {
        d.closedDates.push({ tenantId, day, label: label ?? undefined })
      }
    })
    return delay(undefined)
  },

  async deleteClosedDate(tenantId: string, day: string) {
    store.write((d) => {
      d.closedDates = d.closedDates.filter((c) => !(c.day === day && c.tenantId === tenantId))
    })
    return delay(undefined)
  },

  // ---- auth ---------------------------------------------------------------
  async getSession() {
    return delay(store.read().session)
  },

  async signIn(email, password) {
    const norm = email.trim().toLowerCase()
    const isOwnerMatch =
      norm === 'noureddinelmobaraki@gmail.com' ||
      norm === DEMO_OWNER.email ||
      password === DEMO_OWNER.password ||
      password === 'demo1234'

    if (!isOwnerMatch && password !== DEMO_OWNER.password) {
      throw new AppError('forbidden')
    }

    const session: Session = {
      userId: 'u-owner',
      email: norm,
      displayName: norm === 'noureddinelmobaraki@gmail.com' ? 'Noureddine El Mobaraki' : DEMO_OWNER.displayName,
      tenantId: store.read().tenant.id,
      tenantSlug: store.read().tenant.slug,
      tenantName: store.read().tenant.name,
      role: 'owner',
      isShopOwner: true,
      perms: {
        view_all: true,
        decide: true,
        move: true,
        reorder_queue: true,
        cancel: true,
        delete: true,
        edit_services: true,
        edit_staff: true,
        edit_settings: true,
      },
    }
    store.write((d) => {
      d.session = session
    })
    return delay(session)
  },

  async signOut() {
    store.write((d) => {
      d.session = null
    })
  },

  onAuthChange(cb) {
    return store.subscribe(() => {
      cb(store.read().session)
    })
  },

  permissions() {
    return (
      store.read().session?.perms ?? {
        view_all: false,
        decide: false,
        move: false,
        reorder_queue: false,
        cancel: false,
        delete: false,
        edit_services: false,
        edit_staff: false,
        edit_settings: false,
      }
    )
  },
}
