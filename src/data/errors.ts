export type ErrorCode =
  // existing
  | 'tenant_not_found'
  | 'service_not_found'
  | 'booking_not_found'
  | 'staff_cannot_perform_service'
  | 'slot_taken'
  | 'hold_expired'
  | 'hold_already_used'
  | 'too_soon'
  | 'too_far'
  | 'closed_that_day'
  | 'outside_hours'
  | 'staff_unavailable'
  | 'not_reschedulable'
  | 'not_movable'
  | 'already_closed'
  | 'cutoff_passed'
  | 'cancel_disabled'
  | 'reschedule_disabled'
  | 'too_many_active'
  | 'customer_blocked'
  | 'invalid_phone'
  | 'invalid_name'
  | 'forbidden'
  | 'network'
  | 'unknown'
  // new in phase 2
  | 'settings_missing'
  | 'staff_not_found'
  | 'email_required'
  | 'queue_disabled'
  | 'queue_full'
  | 'not_a_queue_ticket'
  | 'already_serving'
  | 'bad_queue_bounds'
  | 'bad_decision'
  | 'bad_close_status'
  | 'invalid_color'
  | 'invalid_duration'
  | 'unsupported'
  | 'auth_failed'
  | 'invalid_price'
  | 'invalid_hours'
  | 'invalid_weekday'
  | 'invalid_day'
  | 'staff_has_bookings'
  | 'service_has_bookings'
  | 'bad_order'
  | 'shop_already_claimed'

export class AppError extends Error {
  readonly code: ErrorCode
  constructor(code: ErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'AppError'
    this.code = code
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError
}

export function errorCodeOf(e: unknown): ErrorCode {
  if (isAppError(e)) return e.code
  return 'unknown'
}

export function errorKey(e: unknown): string {
  return `error.${errorCodeOf(e)}`
}

const KNOWN = new Set<string>([
  'tenant_not_found',
  'service_not_found',
  'booking_not_found',
  'staff_cannot_perform_service',
  'slot_taken',
  'hold_expired',
  'hold_already_used',
  'too_soon',
  'too_far',
  'closed_that_day',
  'outside_hours',
  'staff_unavailable',
  'not_reschedulable',
  'not_movable',
  'already_closed',
  'cutoff_passed',
  'cancel_disabled',
  'reschedule_disabled',
  'too_many_active',
  'customer_blocked',
  'invalid_phone',
  'invalid_name',
  'forbidden',
  'settings_missing',
  'staff_not_found',
  'email_required',
  'queue_disabled',
  'queue_full',
  'not_a_queue_ticket',
  'already_serving',
  'bad_queue_bounds',
  'bad_decision',
  'bad_close_status',
  'invalid_color',
  'invalid_duration',
  'auth_failed',
  'invalid_price',
  'invalid_hours',
  'invalid_weekday',
  'invalid_day',
  'staff_has_bookings',
  'service_has_bookings',
  'bad_order',
  'shop_already_claimed',
  'unsupported',
  'network',
  'unknown',
])

/**
 * Translate a PostgREST failure into an AppError.
 *
 * The SQL side is disciplined about this: every deliberate refusal is raised
 * with a bare code as the message, P0001 for a rule and P0002 for a missing
 * row. The one case that arrives without a message is 23P01 — the exclusion
 * constraint firing — which is always, by construction, a double booking.
 */
export function fromPostgrest(e: unknown): AppError {
  const err = e as { code?: string; message?: string } | null
  if (!err) return new AppError('unknown')

  if (err.code === '23P01') return new AppError('slot_taken')
  if (err.code === '42501') return new AppError('forbidden')
  if (err.code === 'PGRST301' || err.code === '401') return new AppError('forbidden')

  const raw = (err.message ?? '').trim()
  const first = raw.split(/[\s:]/)[0] ?? ''
  if (KNOWN.has(first)) return new AppError(first as ErrorCode, raw)
  if (KNOWN.has(raw)) return new AppError(raw as ErrorCode, raw)

  if (/fetch|network|Failed to fetch/i.test(raw)) return new AppError('network', raw)
  return new AppError('unknown', raw)
}
