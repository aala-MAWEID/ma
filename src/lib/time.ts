import type { DayKey } from '@/types/domain'

/**
 * Pure time arithmetic on top of Intl + UTC Date (handles Morocco DST shifts).
 * Every formatter is crash-proof: invalid input renders EMPTY, never throws.
 */

export const EMPTY = '—'

export type DateLike = Date | string | number | null | undefined

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime())
}

/** Coerce anything into a usable Date, or null. Never throws. */
export function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null
  if (typeof value === 'number') {
    const n = new Date(value)
    return Number.isFinite(n.getTime()) ? n : null
  }
  const text = String(value).trim()
  if (!text) return null
  const parsed = new Date(text)
  if (Number.isFinite(parsed.getTime())) return parsed
  // "2026-08-25 20:47:59+00" (Postgres style) → ISO, for old Safari
  const iso = text.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const retry = new Date(iso)
  return Number.isFinite(retry.getTime()) ? retry : null
}

function intlLocale(locale: string | undefined): string {
  return locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : 'ar-MA'
}

export function dayKeyOf(d: DateLike, timeZone: string): DayKey {
  const safe = toDate(d) ?? new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(safe)
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${day}`
}

export function todayKey(timeZone: string, now: Date = new Date()): DayKey {
  return dayKeyOf(now, timeZone)
}

/** DayKey + minutes-from-midnight in a timeZone → exact UTC instant. */
export function dayKeyToUtc(day: DayKey, minutes: number, timeZone: string): Date {
  const [yStr, mStr, dStr] = day.split('-')
  const y = parseInt(yStr ?? '1970', 10)
  const m = parseInt(mStr ?? '1', 10)
  const d = parseInt(dStr ?? '1', 10)
  const targetHour = Math.floor(minutes / 60)
  const targetMin = minutes % 60

  let guess = new Date(Date.UTC(y, m - 1, d, targetHour, targetMin, 0, 0))

  for (let iter = 0; iter < 3; iter++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(guess)

    const curY = parseInt(parts.find((p) => p.type === 'year')?.value ?? '0', 10)
    const curM = parseInt(parts.find((p) => p.type === 'month')?.value ?? '0', 10)
    const curD = parseInt(parts.find((p) => p.type === 'day')?.value ?? '0', 10)
    const curH = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
    const curMin = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)

    const curUtc = Date.UTC(curY, curM - 1, curD, curH, curMin, 0, 0)
    const targetUtc = Date.UTC(y, m - 1, d, targetHour, targetMin, 0, 0)
    const diff = targetUtc - curUtc
    if (diff === 0) break
    guess = new Date(guess.getTime() + diff)
  }
  return guess
}

export function minutesOfDay(d: DateLike, timeZone: string): number {
  const safe = toDate(d)
  if (!safe) return 0
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(safe)
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  return h * 60 + m
}

export function weekdayOf(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

export function addDaysToKey(day: DayKey, days: number): DayKey {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days))
  const rm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const rd = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${rm}-${rd}`
}

export function dayRange(from: DayKey, count: number): DayKey[] {
  const list: DayKey[] = []
  for (let i = 0; i < count; i++) list.push(addDaysToKey(from, i))
  return list
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000)
}

/** Half-open [startA,endA) overlaps [startB,endB) */
export function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime()
}

export function minutesToClock(minutes: number): string {
  const safe = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export const formatMinutes = minutesToClock

export function formatTime(
  d: DateLike,
  timeZone: string = 'Africa/Casablanca',
  locale: string = 'ar',
): string {
  const safe = toDate(d)
  if (!safe) return EMPTY
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(safe)
  } catch {
    return EMPTY
  }
}

export function formatDayKey(
  day: DayKey | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!day || typeof day !== 'string') return EMPTY
  const [y, m, d] = day.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return EMPTY
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12, 0, 0))
  if (!Number.isFinite(date.getTime())) return EMPTY
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: 'UTC', ...options }).format(date)
  } catch {
    return EMPTY
  }
}

/**
 * Tolerant signature kept from v16:
 *   formatDateTime(date, 'Africa/Casablanca', 'ar')
 *   formatDateTime(date, 'ar')   ← locale in the 2nd slot
 */
export function formatDateTime(
  d: DateLike,
  timeZoneOrLocale: string = 'Africa/Casablanca',
  maybeLocale: string = 'ar',
): string {
  const safe = toDate(d)
  if (!safe) return EMPTY
  const looksLikeZone = timeZoneOrLocale.includes('/')
  const timeZone = looksLikeZone ? timeZoneOrLocale : 'Africa/Casablanca'
  const locale = looksLikeZone ? maybeLocale : timeZoneOrLocale
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(safe)
  } catch {
    return EMPTY
  }
}

/** Date only, no clock. Used by the customer registry. */
export function formatDateOnly(
  d: DateLike,
  timeZone: string = 'Africa/Casablanca',
  locale: string = 'ar',
): string {
  const safe = toDate(d)
  if (!safe) return EMPTY
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(safe)
  } catch {
    return EMPTY
  }
}

/** "منذ 5 دقائق" / "il y a 5 min" without a library. */
export function formatRelative(d: DateLike, locale: string = 'ar'): string {
  const safe = toDate(d)
  if (!safe) return EMPTY
  const minutes = Math.round((Date.now() - safe.getTime()) / 60_000)
  try {
    const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' })
    if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute')
    const hours = Math.round(minutes / 60)
    if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour')
    return rtf.format(-Math.round(hours / 24), 'day')
  } catch {
    return formatDateTime(safe, 'Africa/Casablanca', locale)
  }
}

export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  return `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`
}

export function relativeDayLabel(day: DayKey, timeZone: string, locale: string): string {
  const today = todayKey(timeZone)
  if (day === today) return locale === 'ar' ? 'اليوم' : "Aujourd'hui"
  if (day === addDaysToKey(today, 1)) return locale === 'ar' ? 'غداً' : 'Demain'
  return formatDayKey(day, locale, { weekday: 'short' })
}
