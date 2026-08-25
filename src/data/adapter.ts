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
  PublicQueue,
  TurnStatus,
  TimeOffRow,
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
  PublicQueue,
  TurnStatus,
  TimeOffRow,
}

export type Decision = 'approve' | 'reject' | 'confirm' | 'decline' | 'complete' | 'no_show'

export type ConfirmInput = {
  bookingId: string
  code: string
  fullName: string
  phone: string
  email?: string
  locale?: string
  notes?: string
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
  serviceId: string | null
  staffId?: string | null
  from?: string // YYYY-MM-DD
  day?: string // YYYY-MM-DD
  days?: number
  timeZone?: string
  collapse?: boolean
}

export type DayScheduleRow = {
  position: number
  id: string
  code: string
  status: string
  mode: string
  startsAt: string
  endsAt: string
  gapBeforeMin: number | null
  staffId: string
  staffName: string
  staffColor: string | null
  serviceId: string
  serviceName: string
  customerName: string | null
  customerPhone: string | null
  priceCentimes: number | null
  currency: string | null
  notesCustomer: string | null
}

export type MyBookingRow = {
  id: string
  code: string
  status: string
  mode: string
  startsAt: string
  endsAt: string
  serviceName: string
  staffName: string
  staffColor: string | null
  priceCentimes: number | null
  currency: string | null
  tenantSlug: string
  tenantName: string
  canCancel: boolean
}

export interface DataAdapter {
  // ---- public reads -------------------------------------------------------
  getTenantBundle(slug: string): Promise<TenantBundle>
  getAvailability(
    queryOrSlug: AvailabilityQuery | string,
    serviceId?: string | null,
    staffId?: string | null,
    fromDay?: string,
    days?: number,
  ): Promise<Slot[]>
  getBookingByCode(code: string): Promise<AgendaItem>
  getQueue(tenantId: string, day?: string): Promise<QueueTicket[]>
  listBookingsByPhone(tenantId: string, phone: string): Promise<AgendaItem[]>

  // ---- public writes ------------------------------------------------------
  holdSlot(
    slugOrInput:
      | string
      | {
          tenantId: string
          serviceId: string
          staffId: string
          startsAt: Date
        },
    serviceId?: string,
    staffId?: string,
    startsAt?: Date,
  ): Promise<HoldResult>

  releaseHold(bookingId: string, code?: string): Promise<void>

  confirmBooking(
    inputOrBookingId: ConfirmInput | string,
    code?: string,
    fullName?: string,
    phone?: string,
    email?: string,
    notes?: string,
  ): Promise<AgendaItem>

  confirmHold(input: ConfirmInput): Promise<Booking>

  joinQueue(input: {
    tenantId: string
    serviceId: string
    staffId?: string | null
    fullName: string
    phone: string
    notes?: string | null
  }): Promise<QueueTicket>

  queueJoin(
    slug: string,
    serviceId: string,
    staffId: string | null,
    fullName: string,
    phone: string,
    notes?: string | null,
  ): Promise<Booking>

  queueNext(
    tenantId: string,
    staffId?: string | null,
    closeAs?: 'completed' | 'no_show',
  ): Promise<{ nextId: string | null; nextName: string | null }>

  queueAdvance(bookingId: string, places?: number): Promise<void>
  queueSkip(bookingId: string, places?: number): Promise<void>
  queueCall(bookingId: string): Promise<void>
  queueMove(bookingId: string, beforeId?: string | null, afterId?: string | null): Promise<void>

  cancelBooking(id: string, code: string, reason?: string): Promise<void>
  cancelByCode(code: string, reason?: string): Promise<void>
  cancelBookingAdmin(bookingId: string, reason?: string | null): Promise<void>
  deleteBooking(bookingId: string, reason?: string | null): Promise<void>

  rescheduleBooking(
    codeOrInput:
      | string
      | {
          code: string
          newStartsAt: Date
          newStaffId?: string
        },
    startsAt?: Date,
    staffId?: string,
    oldCode?: string,
  ): Promise<AgendaItem | Booking>

  // ---- admin reads --------------------------------------------------------
  getAgenda(tenantId: string, from: Date, to: Date): Promise<AgendaItem[]>
  getCustomers(tenantId: string, search?: string): Promise<Customer[]>
  listCustomers(tenantId: string): Promise<Customer[]>
  getStats(tenantId: string): Promise<Stats>
  listRequests(tenantId: string): Promise<AgendaItem[]>

  // ---- admin writes -------------------------------------------------------
  createAdminBooking(input: AdminBookingInput): Promise<AgendaItem>
  updateBookingStatus(
    tenantId: string,
    id: string,
    status: string,
    reason?: string,
  ): Promise<AgendaItem>
  decide(bookingId: string, decision: Decision, reason?: string): Promise<AgendaItem>
  moveBooking(
    tenantIdOrBookingId: string,
    idOrStartsAt: string | Date,
    startsAtOrStaffId?: Date | string,
    staffId?: string,
  ): Promise<AgendaItem>
  adminCancelBooking(tenantId: string, id: string, reason?: string): Promise<void>
  adminDeleteBooking(tenantId: string, id: string, reason?: string): Promise<void>
  subscribeBookings(tenantId: string, onChange: () => void): () => void

  // settings & master data
  updateTenantSettings(
    tenantId: string,
    patch: Partial<TenantSettings>,
  ): Promise<TenantSettings>
  updateSettings(
    tenantId: string,
    patch: Partial<TenantSettings>,
  ): Promise<TenantSettings>
  setHoursMode(
    tenantId: string,
    mode: 'scheduled' | 'always_open',
    showHours: boolean,
  ): Promise<void>
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
  setStaffAvatar(tenantId: string, staffId: string, url: string | null): Promise<Staff>
  uploadStaffPhoto(tenantId: string, staffId: string, file: File): Promise<Staff>
  upsertStaff(
    tenantId: string,
    input: {
      staffId?: string | null
      displayName?: string
      title?: string
      titleFr?: string
      color?: string
      avatarUrl?: string
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
  reorderStaff(tenantId: string, ids: string[]): Promise<unknown[]>
  reorderServices(tenantId: string, ids: string[]): Promise<unknown[]>
  setStaffServices(tenantId: string, staffId: string, serviceIds: string[]): Promise<unknown[]>
  getDaySchedule(tenantId: string, day: string): Promise<DayScheduleRow[]>
  myBookings(slug?: string): Promise<MyBookingRow[]>
  cancelMyBooking(code: string, reason?: string): Promise<void>
  setWeekHours(tenantId: string, staffId: string | null, week: WeekHours): Promise<WorkingHour[]>
  listClosedDates(tenantId: string): Promise<ClosedDate[]>
  upsertClosedDate(tenantId: string, day: string, label?: string | null): Promise<unknown>
  deleteClosedDate(tenantId: string, day: string): Promise<unknown>

  /** لوحة الطابور للزائر غير المسجّل — أرقام فقط */
  queuePublic(slug: string, day?: string | null): Promise<PublicQueue>
  /** حالة دور صاحب الرمز */
  turnStatus(code: string): Promise<TurnStatus>
  /** إجازات وغياب الموظفين */
  listTimeOff(tenantId: string): Promise<TimeOffRow[]>
  upsertTimeOff(input: {
    tenantId: string
    id?: string | null
    staffId?: string | null
    startsAt: Date
    endsAt: Date
    reason?: string | null
  }): Promise<TimeOffRow>
  deleteTimeOff(tenantId: string, id: string): Promise<void>
  setServicePriceVisibility(
    tenantId: string,
    serviceId: string,
    hidden: boolean,
  ): Promise<void>
  getSettingsSchema(): Promise<Record<string, import('./domain').SettingFieldSchema>>
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
