import type {
  AgendaItem,
  Booking,
  BookingSource,
  Customer,
  HoldResult,
  Permissions,
  QueueTicket,
  Service,
  Session,
  Slot,
  Staff,
  Stats,
  Tenant,
  TenantBundle,
  TenantSettings,
  TimeOff,
  AuthStatus,
  WeekHours,
  WorkingHour,
  ClosedDate,
} from './domain'

export * from './domain'
export type {
  AgendaItem,
  Booking,
  BookingSource,
  Customer,
  HoldResult,
  Permissions,
  QueueTicket,
  Service,
  Session,
  Slot,
  Staff,
  Stats,
  Tenant,
  TenantBundle,
  TenantSettings,
  TimeOff,
  AuthStatus,
  WeekHours,
  WorkingHour,
  ClosedDate,
}

export type AdminBookingInput = {
  tenantId: string
  serviceId: string
  staffId: string
  startsAt: Date
  fullName: string
  phone: string
  email?: string | null
  notes?: string | null
  source?: BookingSource
}

export type AvailabilityQuery = {
  slug: string
  serviceId: string
  staffId?: string | null
  fromDay?: string
  from?: string
  days?: number
}

export type ConfirmInput = {
  bookingId: string
  code: string
  fullName: string
  phone: string
  email?: string | null
  notes?: string | null
  locale?: string
}

export type Decision = 'confirm' | 'decline' | 'complete' | 'no_show'

export interface DataAdapter {
  // ---- public -------------------------------------------------------
  getTenantBundle(slug: string): Promise<TenantBundle>
  getAvailability(
    queryOrSlug: AvailabilityQuery | string,
    serviceId?: string,
    staffId?: string | null,
    fromDay?: string,
    days?: number,
  ): Promise<Slot[]>
  getOpenDays(
    queryOrSlug: AvailabilityQuery | string,
    serviceId?: string,
    staffId?: string | null,
    fromDay?: string,
    days?: number,
  ): Promise<string[] | Record<string, number>>
  holdSlot(
    slug: string,
    serviceId: string,
    staffId: string,
    startsAt: Date,
  ): Promise<HoldResult & Booking>
  releaseHold(bookingId: string, code?: string): Promise<void>
  confirmHold(
    inputOrBookingId: ConfirmInput | string,
    code?: string,
    fullName?: string,
    phone?: string,
    email?: string | null,
    notes?: string | null,
  ): Promise<Booking>
  getBookingByCode(code: string): Promise<AgendaItem | null>
  listBookingsByPhone(slug: string, phone: string): Promise<AgendaItem[]>
  cancelBooking(codeOrId: string, reason?: string | null): Promise<Booking>
  rescheduleBooking(
    codeOrId: string,
    startsAt: Date,
    staffId?: string | null,
    code?: string,
  ): Promise<Booking>

  // ---- admin --------------------------------------------------------
  getAgenda(tenantId: string, from: Date, to: Date): Promise<AgendaItem[]>
  listRequests(tenantId: string): Promise<AgendaItem[]>
  decide(
    bookingId: string,
    decision: Decision,
    reason?: string | null,
  ): Promise<Booking>
  moveBooking(
    bookingId: string,
    startsAt: Date,
    staffId?: string | null,
  ): Promise<AgendaItem>
  createAdminBooking(input: AdminBookingInput): Promise<Booking>
  listCustomers(tenantId: string): Promise<Customer[]>
  listTimeOff(tenantId: string): Promise<TimeOff[]>
  getStats(tenantId: string): Promise<Stats>
  updateSettings(
    tenantId: string,
    patch: Partial<TenantSettings>,
  ): Promise<TenantSettings>
  subscribeBookings(tenantId: string, onChange: () => void): () => void

  // ---- destructive ---------------------------------------------------
  cancelBookingAdmin(bookingId: string, reason?: string | null): Promise<Booking>
  deleteBooking(bookingId: string, reason?: string | null): Promise<void>

  // ---- queue ---------------------------------------------------------
  getQueue(tenantId: string, day?: string): Promise<QueueTicket[]>
  queueJoin(
    slug: string,
    serviceId: string,
    staffId: string,
    fullName: string,
    phone: string,
    notes?: string | null,
  ): Promise<Booking>
  queueNext(
    tenantId: string,
    staffId: string | null,
    closeAs?: 'completed' | 'no_show' | 'cancelled',
  ): Promise<{
    finishedId: string | null
    nextId: string | null
    nextName: string | null
  }>
  queueAdvance(bookingId: string, places?: number): Promise<Booking>
  queueSkip(bookingId: string, places?: number): Promise<Booking>
  queueReorder(
    bookingId: string,
    beforeId: string | null,
    afterId: string | null,
  ): Promise<Booking>
  queueCall(bookingId: string): Promise<Booking>

  // ---- identity ------------------------------------------------------
  updateTenantIdentity(
    tenantId: string,
    patch: {
      name?: string
      nameFr?: string
      tagline?: string
      taglineFr?: string
      phone?: string
      whatsapp?: string
      email?: string
      address?: string
      city?: string
      brandColor?: string
      logoUrl?: string
    },
  ): Promise<void>
  upsertStaff(
    tenantId: string,
    input: {
      staffId?: string | null
      displayName?: string
      title?: string
      color?: string
      isActive?: boolean
      sortOrder?: number
      serviceIds?: string[]
    },
  ): Promise<Staff>
  upsertService(
    tenantId: string,
    input: Partial<Service> & { serviceId?: string | null },
  ): Promise<Service>
  updateMyProfile(patch: {
    displayName?: string
    phone?: string
    locale?: string
  }): Promise<void>

  // ---- session -------------------------------------------------------
  getSession(): Promise<Session | null>
  signIn(email: string, password: string): Promise<Session>
  signInWithGoogle(redirectTo?: string): Promise<void>
  authStatus(slug: string): Promise<AuthStatus>
  claimShop(slug: string): Promise<{ tenantId: string; role: string }>
  signOut(): Promise<void>
  onAuthChange(cb: (s: Session | null) => void): () => void
  permissions(): Permissions
  listAllStaff(tenantId: string): Promise<Staff[]>
  listAllServices(tenantId: string): Promise<Service[]>
  deleteStaff(tenantId: string, staffId: string): Promise<void>
  deleteService(tenantId: string, serviceId: string): Promise<void>
  setWeekHours(tenantId: string, staffId: string | null, week: WeekHours): Promise<WorkingHour[]>
  listClosedDates(tenantId: string): Promise<ClosedDate[]>
  upsertClosedDate(tenantId: string, day: string, label?: string | null): Promise<void>
  deleteClosedDate(tenantId: string, day: string): Promise<void>
}

/** Everything false. The safe default before whoami() has answered. */
export const NO_PERMS: Permissions = {
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
