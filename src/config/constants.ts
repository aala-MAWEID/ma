import type { BookingStatus, TenantSettings } from '@/types/domain'

export const DEFAULT_TENANT_SLUG = 'zaytouna'

export const CALENDAR_START_HOUR = 8
export const CALENDAR_END_HOUR = 21

export const BLOCKING_STATUSES: BookingStatus[] = ['held', 'pending', 'confirmed']
export const MOVABLE_STATUSES: BookingStatus[] = ['pending', 'confirmed']

export const BOOKING_STEPS = ['service', 'staff', 'time', 'details', 'done'] as const
export type BookingStep = (typeof BOOKING_STEPS)[number]

export const SLOT_PERIODS = [
  { key: 'morning', from: 0, to: 720 },
  { key: 'afternoon', from: 720, to: 1080 },
  { key: 'evening', from: 1080, to: 1440 },
] as const

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export const STATUS_META: Record<BookingStatus, { key: string; color: string }> = {
  held: { key: 'status.held', color: 'var(--st-held)' },
  pending: { key: 'status.pending', color: 'var(--st-pending)' },
  confirmed: { key: 'status.confirmed', color: 'var(--st-confirmed)' },
  serving: { key: 'status.serving', color: 'var(--st-confirmed)' },
  completed: { key: 'status.completed', color: 'var(--st-completed)' },
  cancelled: { key: 'status.cancelled', color: 'var(--st-cancelled)' },
  declined: { key: 'status.declined', color: 'var(--st-declined)' },
  no_show: { key: 'status.no_show', color: 'var(--st-noshow)' },
}

export const DEFAULT_SETTINGS: TenantSettings = {
  slotGranularityMin: 15,
  minNoticeMin: 120,
  maxAdvanceDays: 30,
  holdTtlMin: 10,
  autoConfirm: false,
  cancelCutoffMin: 240,
  rescheduleCutoffMin: 240,
  allowCustomerCancel: true,
  allowCustomerReschedule: true,
  requireEmail: false,
  allowAnyStaff: true,
  showStaffPicker: true,
  maxActivePerCustomer: 3,
  blockAfterNoShows: 2,
}
