export type GuestNotification = {
  id: string
  kind: string
  title: string
  body: string | null
  urgent: boolean
  sound: boolean
  code?: string | null
  payload: Record<string, unknown> | null
  bookingId: string | null
  createdAt: string | null
  readAt: string | null
}

export type GuestTurn = { ahead: number | null; waitMin: number | null; slotNo?: number | null }

export type GuestTicket = {
  id: string
  code: string
  mode: string
  status: string
  startsAt: string | null
  endsAt: string | null
  serviceName: string | null
  staffName: string | null
  staffColor: string | null
  priceCentimes: number | null
  turn: GuestTurn | null
}

export type GuestHello = {
  deviceToken: string
  isNew: boolean
  visits: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  soundEnabled: boolean
  pushEnabled: boolean
  label: string | null
  known: boolean
  customer: { fullName: string | null; phone: string | null; locale: string | null; isBlocked: boolean } | null
  unread: number
  serverTime: string
}

export type GuestClaim = {
  bookingId: string
  code: string
  status: string
  mode: string
  startsAt: string | null
  customerId: string | null
  linkedHistory: number
  serverTime: string
}

export type GuestFeed = {
  deviceToken: string
  known: boolean
  visits: number
  soundEnabled: boolean
  pushEnabled: boolean
  unread: number
  notifications: GuestNotification[]
  tickets: GuestTicket[]
  serverTime: string
}

export type GuestPrefs = { soundEnabled: boolean; pushEnabled: boolean; label: string | null }

/** Numbers only. Never contains another customer's data. */
export type QueueCounts = {
  found: boolean
  enabled: boolean
  shopOpen?: boolean
  waiting: number
  serving: number
  avgMin: number
  maxSize: number | null
  ahead: number | null
  waitMin: number | null
  myStatus: string | null
  myCode: string | null
  myTicketNo: number | null
  serverTime: string
}

export type AdminCustomerRow = {
  id: string
  tenantId: string
  fullName: string | null
  phone: string | null
  email: string | null
  locale: string | null
  isBlocked: boolean
  blockedReason: string | null
  noShowCount: number
  totalBookings: number
  completedCount: number
  cancelledCount: number
  queueCount: number
  activeCount: number
  spentCentimes: number
  firstBookingAt: string | null
  lastBookingAt: string | null
  lastVisitAt: string | null
  devices: number
  deviceVisits: number
  lastSeenAt: string | null
  unread: number
  isKnownDevice: boolean
  createdAt: string | null
}

export type AdminCustomersPage = {
  rows: AdminCustomerRow[]
  total: number
  limit: number
  offset: number
  search: string | null
  orphanBookings: number
  serverTime: string
}

export type AdminCustomerStats = {
  customers: number
  blocked: number
  devices: number
  knownDevices: number
  queueWaiting: number
  pending: number
  serving: number
  repeatCustomers: number
  unreadNotifications: number
  topCustomers: Array<{
    id: string
    fullName: string | null
    phone: string | null
    visits: number
    spentCentimes: number
  }>
  serverTime: string
}

export type AdminDeviceRow = {
  deviceToken: string
  label: string | null
  customerId: string | null
  customerName: string | null
  platform: string | null
  locale: string | null
  timeZone: string | null
  visits: number
  bookings: number
  firstSeenAt: string | null
  lastSeenAt: string | null
}

export type AdminCustomerDetail = {
  customer: {
    id: string
    fullName: string | null
    phone: string | null
    email: string | null
    locale: string | null
    isBlocked: boolean
    blockedReason: string | null
    noShowCount: number
    createdAt: string | null
    lastSeenAt: string | null
  }
  devices: AdminDeviceRow[]
  bookings: Array<{
    id: string
    code: string
    mode: string
    status: string
    startsAt: string | null
    endsAt: string | null
    priceCentimes: number | null
    currency: string | null
    serviceName: string | null
    staffName: string | null
    source: string | null
    notesCustomer: string | null
  }>
  notifications: Array<{
    id: string
    kind: string
    title: string
    body: string | null
    urgent: boolean
    createdAt: string | null
    deliveredAt: string | null
    readAt: string | null
  }>
  serverTime: string
}
