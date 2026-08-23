export type UUID = string
export type DayKey = string // YYYY-MM-DD
export type Locale = 'ar' | 'fr' | 'en'

export type BookingSource = 'web' | 'admin' | 'whatsapp' | 'phone' | 'walk_in'

export type BookingMode = 'appointment' | 'queue'

export type BookingStatus =
  | 'held'
  | 'pending'
  | 'confirmed'
  | 'serving'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'no_show'

export type MemberRole = 'owner' | 'manager' | 'staff'

/** Mirrors the nine boolean columns on tenant_members. */
export interface Permissions {
  view_all: boolean
  decide: boolean
  move: boolean
  reorder_queue: boolean
  cancel: boolean
  delete: boolean
  edit_services: boolean
  edit_staff: boolean
  edit_settings: boolean
}

export interface Session {
  userId: string
  email: string
  displayName: string
  avatarUrl?: string
  tenantId: string
  tenantSlug: string
  tenantName: string
  role: MemberRole
  /** true only for the account bound by maweid.bind_owner() */
  isShopOwner: boolean
  perms: Permissions
}

/** One person waiting, as returned by get_queue(). */
export interface QueueTicket {
  id: string
  position: number
  queueRank: number
  status: BookingStatus
  staffId: string
  staffName: string
  staffColor: string
  serviceId: string
  serviceName: string
  durationMin: number
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  code: string
  skippedCount: number
  createdAt: Date
  servedAt: Date | null
  etaMinutes: number
}

export interface Tenant {
  id: UUID
  slug: string
  name: string
  nameFr?: string
  tagline?: string
  taglineFr?: string
  addressLine?: string
  address?: string
  city: string
  phone: string
  whatsapp?: string
  email?: string
  timeZone: string
  currency: string
  lat?: number
  lng?: number
  brandColor: string
  defaultLocale: Locale
  locales: Locale[]
  logoUrl?: string
  isPublished: boolean
}

export interface TenantSettings {
  slotGranularityMin?: number
  slot_granularity_min?: number
  minNoticeMin?: number
  min_notice_min?: number
  maxAdvanceDays?: number
  max_advance_days?: number
  holdTtlMin?: number
  hold_ttl_min?: number
  autoConfirm?: boolean
  auto_confirm?: boolean
  cancelCutoffMin?: number
  cancel_cutoff_min?: number
  rescheduleCutoffMin?: number
  reschedule_cutoff_min?: number
  allowCustomerCancel?: boolean
  allow_customer_cancel?: boolean
  allowCustomerReschedule?: boolean
  allow_customer_reschedule?: boolean
  requireEmail?: boolean
  require_email?: boolean
  allowAnyStaff?: boolean
  allow_any_staff?: boolean
  showStaffPicker?: boolean
  show_staff_picker?: boolean
  maxActivePerCustomer?: number
  max_active_per_customer?: number
  blockAfterNoShows?: number
  block_after_no_shows?: number
  queue_enabled?: boolean
  queueEnabled?: boolean
  queue_max_size?: number
  queueMaxSize?: number
}

export interface Staff {
  id: UUID
  tenantId: UUID
  displayName: string
  title?: string
  titleFr?: string
  color: string
  avatarUrl?: string
  isActive: boolean
  sortOrder: number
}

export interface Service {
  id: UUID
  tenantId: UUID
  name: string
  nameFr?: string
  description?: string
  category: string
  durationMin: number
  bufferBeforeMin: number
  bufferAfterMin: number
  priceCentimes: number
  priceFrom?: boolean
  requiresApproval: boolean
  color?: string
  isActive: boolean
  sortOrder: number
  maxPerDay?: number
}

export interface StaffService {
  staffId: UUID
  serviceId: UUID
  durationOverrideMin?: number
  priceOverrideCentimes?: number
}

export interface WorkingHour {
  id: string
  tenantId: UUID
  staffId: UUID | null
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6
  opensMin: number
  closesMin: number
}

export interface ClosedDate {
  tenantId: UUID
  day: DayKey
  label?: string
}

export interface TimeOff {
  id: string
  tenantId: UUID
  staffId: UUID | null
  startsAt: Date
  endsAt: Date
  reason?: string
}

export interface Customer {
  id: UUID
  tenantId: UUID
  fullName: string
  phone: string
  email?: string
  locale: Locale
  isBlocked: boolean
  noShowCount: number
  totalBookings: number
  createdAt: Date
}

export interface Booking {
  id: UUID
  tenantId: UUID
  customerId?: UUID
  staffId: UUID
  serviceId: UUID
  startsAt: Date
  endsAt: Date
  bufferBeforeMin: number
  bufferAfterMin: number
  status: BookingStatus
  mode?: BookingMode
  source: BookingSource
  priceCentimes: number
  currency: string
  code: string
  queueRank?: number
  skippedCount?: number
  servedAt?: Date | null
  holdExpiresAt?: Date
  notesCustomer?: string
  notesInternal?: string
  cancelReason?: string
  rescheduleOf?: UUID
  createdAt: Date
  updatedAt: Date
}

export interface BookingEvent {
  id: string
  bookingId: UUID
  actorLabel?: string
  kind:
    | 'created'
    | 'status'
    | 'moved'
    | 'queued'
    | 'reordered'
    | 'skipped'
    | 'served'
    | 'note'
    | 'deleted'
  fromStatus?: BookingStatus
  toStatus?: BookingStatus
  fromStartsAt?: Date
  toStartsAt?: Date
  note?: string
  createdAt: Date
}

export interface Slot {
  startsAt: Date
  endsAt: Date
  start: Date
  end: Date
  staffId: UUID
  staffName?: string
}

export interface AgendaItem extends Booking {
  staffName: string
  staffColor?: string
  serviceName: string
  serviceColor?: string
  customerName?: string
  customerPhone?: string
}

export interface Stats {
  todayCount: number
  pendingCount: number
  queueCount: number
  weekCount: number
  weekRevenueCentimes: number
  noShowRate: number
}

export interface HoldResult {
  bookingId: UUID
  code: string
  expiresAt: Date
  booking: Booking
  holdExpiresAt: Date
}

export interface TenantBundle {
  tenant: Tenant
  settings: TenantSettings
  services: Service[]
  staff: Staff[]
  staffServices: StaffService[]
  workingHours: WorkingHour[]
  closedDates: ClosedDate[]
}

export type AuthStatus = {
  authenticated: boolean
  userId?: string
  email?: string
  displayName?: string | null
  avatarUrl?: string | null
  tenantId?: string | null
  tenantSlug?: string | null
  tenantName?: string | null
  tenantFound?: boolean
  tenantHasOwner?: boolean
  isMember: boolean
  role?: string | null
  canClaim: boolean
}

export type HourWindow = { opensMin: number; closesMin: number }
export type WeekHours = Array<{ weekday: number; windows: HourWindow[] }>
