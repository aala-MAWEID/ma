/**
 * In-memory database with localStorage persistence and a change emitter.
 *
 * This is deliberately shaped like a real database: one flat collection per
 * table, no nesting, ids everywhere. When the Supabase adapter arrives it
 * replaces the queries, not the shape.
 *
 * Dates survive the JSON round trip via a revive step keyed on field name —
 * anything ending in `At` or named `startsAt`/`endsAt` becomes a Date again.
 */

import type {
  Booking,
  BookingEvent,
  ClosedDate,
  Customer,
  Service,
  Session,
  Staff,
  StaffService,
  Tenant,
  TenantSettings,
  TimeOff,
  WorkingHour,
} from '@/types/domain'
import {
  buildSeed,
  services as seedServices,
  settings as seedSettings,
  staff as seedStaff,
  staffServices as seedStaffServices,
  tenant as seedTenant,
  workingHours as seedHours,
} from '@/data/mock/seed'

export interface MockDb {
  tenant: Tenant
  settings: TenantSettings
  staff: Staff[]
  services: Service[]
  staffServices: StaffService[]
  workingHours: WorkingHour[]
  closedDates: ClosedDate[]
  timeOff: TimeOff[]
  customers: Customer[]
  bookings: Booking[]
  events: BookingEvent[]
  session: Session | null
}

import { safeStorage } from '@/lib/safeStorage'

const KEY = 'maweid.db.v1'
const DATE_FIELDS = /(At|startsAt|endsAt)$/

function fresh(): MockDb {
  const { closedDates, timeOff, customers, bookings } = buildSeed()
  return {
    tenant: seedTenant,
    settings: seedSettings,
    staff: seedStaff,
    services: seedServices,
    staffServices: seedStaffServices,
    workingHours: seedHours,
    closedDates,
    timeOff,
    customers,
    bookings,
    events: [],
    session: null,
  }
}

function revive(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && DATE_FIELDS.test(_key)) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? value : d
  }
  return value
}

function load(): MockDb {
  try {
    const raw = safeStorage.get(KEY)
    if (!raw) return fresh()
    return JSON.parse(raw, revive) as MockDb
  } catch {
    return fresh()
  }
}

let db: MockDb = load()
const listeners = new Set<() => void>()

function persist(): void {
  try {
    safeStorage.set(KEY, JSON.stringify(db))
  } catch {
    /* quota or private mode — memory still works */
  }
}

export const store = {
  read(): MockDb {
    return db
  },

  /** Mutate then notify. Every write in the adapter goes through this. */
  write(mutate: (draft: MockDb) => void): void {
    mutate(db)
    persist()
    for (const fn of listeners) fn()
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  reset(): void {
    db = fresh()
    persist()
    for (const fn of listeners) fn()
  },
}

/** Cross-tab sync, so two browser windows behave like two real devices. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return
    db = JSON.parse(e.newValue, revive) as MockDb
    for (const fn of listeners) fn()
  })
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function bookingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1
  let out = 'ZY'
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}
