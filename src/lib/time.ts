import type { DayKey } from '@/types/domain'

/**
 * 22 pure time arithmetic functions using only Intl and UTC Date.
 * Handles Morocco's Ramadan DST shifts gracefully.
 */

export function dayKeyOf(d: Date, timeZone: string): DayKey {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)

  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${day}`
}

export function todayKey(timeZone: string, now: Date = new Date()): DayKey {
  return dayKeyOf(now, timeZone)
}

/**
 * Convert a DayKey (YYYY-MM-DD) + minutes from midnight in a specific timeZone
 * to the exact UTC Date instant.
 */
export function dayKeyToUtc(day: DayKey, minutes: number, timeZone: string): Date {
  const [yStr, mStr, dStr] = day.split('-')
  const y = parseInt(yStr ?? '1970', 10)
  const m = parseInt(mStr ?? '1', 10)
  const d = parseInt(dStr ?? '1', 10)
  const targetHour = Math.floor(minutes / 60)
  const targetMin = minutes % 60

  // Initial estimate in UTC
  let guess = new Date(Date.UTC(y, m - 1, d, targetHour, targetMin, 0, 0))

  // Iteratively adjust using Intl wall clock formatting in the target timeZone
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

    const curUtcTime = Date.UTC(curY, curM - 1, curD, curH, curMin, 0, 0)
    const targetUtcTime = Date.UTC(y, m - 1, d, targetHour, targetMin, 0, 0)
    const diff = targetUtcTime - curUtcTime

    if (diff === 0) break
    guess = new Date(guess.getTime() + diff)
  }

  return guess
}

export function minutesOfDay(d: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(d)

  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  return h * 60 + m
}

export function weekdayOf(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1))
  return date.getUTCDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
}

export function addDaysToKey(day: DayKey, days: number): DayKey {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days))
  const resY = date.getUTCFullYear()
  const resM = String(date.getUTCMonth() + 1).padStart(2, '0')
  const resD = String(date.getUTCDate()).padStart(2, '0')
  return `${resY}-${resM}-${resD}`
}

export function dayRange(from: DayKey, count: number): DayKey[] {
  const list: DayKey[] = []
  for (let i = 0; i < count; i++) {
    list.push(addDaysToKey(from, i))
  }
  return list
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000)
}

/** Half-open interval [startA, endA) overlaps [startB, endB) */
export function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime()
}

export function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const formatMinutes = minutesToClock

export function formatTime(d: Date, timeZone: string, locale: string = 'ar'): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d)
}

export function formatDayKey(
  day: DayKey,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12, 0, 0))
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
    timeZone: 'UTC',
    ...options,
  }).format(date)
}

export function formatDateTime(
  d: Date,
  timeZoneOrLocale: string = 'Africa/Casablanca',
  maybeLocale: string = 'ar',
): string {
  const timeZone = timeZoneOrLocale.includes('/') ? timeZoneOrLocale : 'Africa/Casablanca'
  const locale = timeZoneOrLocale.includes('/') ? maybeLocale : timeZoneOrLocale

  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-MA' : 'fr-FR', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d)
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function relativeDayLabel(day: DayKey, timeZone: string, locale: string): string {
  const today = todayKey(timeZone)
  if (day === today) {
    return locale === 'ar' ? 'اليوم' : "Aujourd'hui"
  }
  if (day === addDaysToKey(today, 1)) {
    return locale === 'ar' ? 'غداً' : 'Demain'
  }
  return formatDayKey(day, locale, { weekday: 'short' })
}
