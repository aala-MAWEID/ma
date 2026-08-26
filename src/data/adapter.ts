import type {
  GuestHello, GuestClaim, GuestFeed, GuestPrefs, QueueCounts,
  AdminCustomersPage, AdminCustomerDetail, AdminCustomerStats, AdminDeviceRow,
} from './guest'
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
export * from './guest'
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
  startsAt: string | null
  endsAt: string | null
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

export type ShopStatus = {
  found: boolean
  open: boolean
  note: string | null
  changedAt: string | null
  waiting: number
  serving: number
  serverTime: string
}

export type QueueBoardRow = {
  pos: number
  id: string
  code: string
  status: string
  staffId: string | null
  staffName: string | null
  staffColor: string | null
  serviceId: string | null
  serviceName: string | null
  durationMin: number | null
  customerName: string | null
  customerPhone: string | null
  skippedCount: number
  rank: number
  createdAt: string | null
  ahead: number
  etaMin: number
}

export type QueueServingRow = {
  id: string
  code: string
  status: string
  staffId: string | null
  staffName: string | null
  staffColor: string | null
  serviceName: string | null
  durationMin: number | null
  customerName: string | null
  customerPhone: string | null
  skippedCount: number
  servedAt: string | null
  remainMin: number
}

export type QueueBoard = {
  shopOpen: boolean
  shopNote: string | null
  enabled: boolean
  avgMin: number
  maxSize: number
  serving: QueueServingRow[]
  waiting: QueueBoardRow[]
  serverTime: string
}

export type QueueTakeResult = {
  id: string
  code: string
  status: string
  pos: number
  ahead: number
  etaMin: number
  serverTime: string
}

export type DeviceIdentity = {
  found: boolean
  deviceToken: string
  identityKey: string | null
  isNew: boolean
  visits: number
  email: string | null
  label: string | null
  sound: boolean
  push: boolean
  activeTickets: number
  serverTime: string
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

  // ---- V17 guest identity (anonymous, no account) ----
  /** Register/refresh this device. Returns the authoritative token. */
  guestHello(
    slug: string,
    deviceToken: string,
    profile?: { userAgent?: string | null; platform?: string | null; locale?: string | null; timeZone?: string | null },
  ): Promise<GuestHello>
  /** Link an existing booking code to this device. */
  guestClaim(slug: string, deviceToken: string, code: string): Promise<GuestClaim>
  /** Notifications + my own tickets. */
  guestFeed(slug: string, deviceToken: string, limit?: number): Promise<GuestFeed>
  guestMarkRead(deviceToken: string, ids?: string[] | null): Promise<{ marked: number }>
  guestSetPrefs(
    slug: string,
    deviceToken: string,
    prefs: { sound?: boolean | null; push?: boolean | null; label?: string | null },
  ): Promise<GuestPrefs>
  /** Public queue counters. NUMBERS ONLY — no other customer is exposed. */
  queueCounts(slug: string, deviceToken?: string | null): Promise<QueueCounts>

  /** The single open/closed switch. Hours never close the shop. */
  shopStatus(slug: string): Promise<ShopStatus>
  setShopOpen(tenantId: string, open: boolean, note?: string | null): Promise<ShopStatus>
  /** Whole dashboard queue in one round trip, already ordered by the server. */
  queueBoard(tenantId: string): Promise<QueueBoard>
  /** Take a number. Name required, phone optional, device token is the identity. */
  queueTake(input: {
    slug: string
    serviceId: string
    staffId?: string | null
    fullName?: string | null
    phone?: string | null
    notes?: string | null
    deviceToken?: string | null
  }): Promise<QueueTakeResult>
  /** Move anybody to an absolute position. 1 = next in the chair. */
  queuePlace(tenantId: string, bookingId: string, position: number): Promise<number>
  queueServe(tenantId: string, bookingId: string): Promise<void>
  queueFinish(
    tenantId: string,
    bookingId: string,
    outcome: 'completed' | 'no_show',
    autoNext?: boolean,
  ): Promise<{ nextId: string | null; nextName: string | null }>
  /** Step 3 of device identity. Returns the authoritative token to store. */
  guestIdentify(input: {
    slug: string
    deviceToken?: string | null
    fingerprint?: string | null
    userAgent?: string | null
    platform?: string | null
    locale?: string | null
    timeZone?: string | null
  }): Promise<DeviceIdentity>
  /** Step 4. Same e-mail on another device = same person, no account. */
  guestLinkEmail(slug: string, deviceToken: string, email: string): Promise<{ identityKey: string; devices: number }>

  // ---- V17 dashboard customer registry ----
  adminCustomers(
    tenantId: string,
    opts?: { search?: string | null; limit?: number; offset?: number },
  ): Promise<AdminCustomersPage>
  adminCustomerDetail(tenantId: string, customerId: string): Promise<AdminCustomerDetail>
  adminCustomerStats(tenantId: string): Promise<AdminCustomerStats>
  adminBlockCustomer(
    tenantId: string,
    customerId: string,
    blocked: boolean,
    reason?: string | null,
  ): Promise<{ isBlocked: boolean; blockedReason: string | null }>
  adminNotifyCustomer(
    tenantId: string,
    bookingId: string,
    title: string,
    body?: string | null,
    urgent?: boolean,
  ): Promise<{ notificationId: string | null; reachable: boolean }>
  adminDevices(tenantId: string, limit?: number): Promise<{ devices: AdminDeviceRow[] }>

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
