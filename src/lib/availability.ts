/**
 * THE SLOT ENGINE.
 *
 * One pure function. No React, no fetch, no `Date.now()` — `now` is an
 * argument. That is what makes it testable at 3am and what makes it portable:
 * in phase 2 this exact algorithm is reimplemented as a SQL function and the
 * test suite below becomes the contract both must satisfy.
 *
 * ALGORITHM
 *   1. walk each day in [from, from+days)
 *   2. skip days listed in closedDays
 *   3. for each staff member, resolve the weekly windows for that weekday
 *      (a staff-specific row overrides the tenant-wide row for that weekday)
 *   4. slice each window into candidate starts every `granularityMin`,
 *      keeping only those where start + duration still fits inside the window
 *   5. drop candidates earlier than now + minNoticeMin
 *   6. drop candidates whose buffered range collides with a busy block
 *   7. drop candidates overlapping time off
 *   8. drop the whole day once maxPerDay is reached
 *
 * COMPLEXITY  O(days × staff × windows × slots × busy). For a real salon
 * (14 days × 3 staff × 2 windows × 36 slots × 40 bookings) that is ~120k
 * comparisons — about 3ms. Do not optimise it before it is slow.
 */

import type { DayKey, Slot, UUID, WorkingHour } from '@/types/domain'
import {
  addMinutes,
  dayKeyToUtc,
  dayRange,
  overlaps,
  weekdayOf,
} from '@/lib/time'

export interface StaffCandidate {
  id: UUID
  name: string
  sortOrder: number
  /** resolved: staff override if present, otherwise the service duration */
  durationMin: number
}

/** A range that is already expanded by the service buffers. */
export interface BusyBlock {
  staffId: UUID
  start: Date
  end: Date
}

export interface TimeOffBlock {
  /** null = the whole business is away */
  staffId: UUID | null
  start: Date
  end: Date
}

export interface AvailabilityInput {
  now: Date
  timeZone: string
  from: DayKey
  days: number
  granularityMin: number
  minNoticeMin: number
  maxAdvanceDays: number
  todayKey: DayKey
  bufferBeforeMin: number
  bufferAfterMin: number
  maxPerDay?: number | undefined
  staff: StaffCandidate[]
  workingHours: WorkingHour[]
  closedDays: ReadonlySet<DayKey>
  timeOff: TimeOffBlock[]
  busy: BusyBlock[]
  /** how many of this service are already booked per day, for maxPerDay */
  bookedPerDay?: Readonly<Record<DayKey, number>>
}

/**
 * Resolve the weekly windows that apply to one staff member on one weekday.
 * A staff-specific row wins over the tenant-wide row FOR THAT WEEKDAY ONLY, so
 * a colourist who declares only Saturday hours still inherits the shop hours
 * Monday to Friday.
 */
export function windowsFor(
  hours: WorkingHour[],
  staffId: UUID,
  weekday: number,
): Array<{ opensMin: number; closesMin: number }> {
  const own = hours.filter((h) => h.staffId === staffId && h.weekday === weekday)
  if (own.length > 0) {
    return own.map((h) => ({ opensMin: h.opensMin, closesMin: h.closesMin }))
  }
  return hours
    .filter((h) => h.staffId === null && h.weekday === weekday)
    .map((h) => ({ opensMin: h.opensMin, closesMin: h.closesMin }))
}

export function computeAvailability(input: AvailabilityInput): Slot[] {
  const {
    now,
    timeZone,
    from,
    days,
    granularityMin,
    minNoticeMin,
    bufferBeforeMin,
    bufferAfterMin,
    maxPerDay,
    staff,
    workingHours,
    closedDays,
    timeOff,
    busy,
    bookedPerDay,
  } = input

  if (staff.length === 0 || days <= 0) return []

  const earliest = addMinutes(now, minNoticeMin).getTime()
  const horizon = maxAdvanceKey(input)
  const out: Slot[] = []

  // Index busy blocks by staff so the inner loop is not a full scan.
  const busyByStaff = new Map<UUID, BusyBlock[]>()
  for (const b of busy) {
    const list = busyByStaff.get(b.staffId)
    if (list) list.push(b)
    else busyByStaff.set(b.staffId, [b])
  }

  for (const day of dayRange(from, days)) {
    if (day > horizon) break
    if (closedDays.has(day)) continue

    if (maxPerDay != null && (bookedPerDay?.[day] ?? 0) >= maxPerDay) continue

    const weekday = weekdayOf(day)
    let placedToday = bookedPerDay?.[day] ?? 0

    for (const person of staff) {
      const windows = windowsFor(workingHours, person.id, weekday)
      if (windows.length === 0) continue

      const personBusy = busyByStaff.get(person.id) ?? []

      for (const w of windows) {
        // step 4: last start that still fits inside the window
        const lastStart = w.closesMin - person.durationMin

        for (let m = w.opensMin; m <= lastStart; m += granularityMin) {
          const start = dayKeyToUtc(day, m, timeZone)

          // step 5: minimum notice
          if (start.getTime() < earliest) continue

          const end = addMinutes(start, person.durationMin)

          // step 6: buffered collision with an existing booking
          const blockStart = addMinutes(start, -bufferBeforeMin)
          const blockEnd = addMinutes(end, bufferAfterMin)
          let collides = false
          for (const b of personBusy) {
            if (overlaps(blockStart, blockEnd, b.start, b.end)) {
              collides = true
              break
            }
          }
          if (collides) continue

          // step 7: time off, personal or business-wide
          let away = false
          for (const t of timeOff) {
            if (t.staffId !== null && t.staffId !== person.id) continue
            if (overlaps(start, end, t.start, t.end)) {
              away = true
              break
            }
          }
          if (away) continue

          out.push({
            start,
            end,
            startsAt: start,
            endsAt: end,
            staffId: person.id,
            staffName: person.name,
          })

          if (maxPerDay != null) {
            placedToday += 1
            if (placedToday >= maxPerDay) break
          }
        }
        if (maxPerDay != null && placedToday >= maxPerDay) break
      }
      if (maxPerDay != null && placedToday >= maxPerDay) break
    }
  }

  const order = new Map(staff.map((s) => [s.id, s.sortOrder]))
  return out.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      (order.get(a.staffId) ?? 0) - (order.get(b.staffId) ?? 0),
  )
}

function maxAdvanceKey(input: AvailabilityInput): DayKey {
  const { todayKey: t, maxAdvanceDays } = input
  const [y, m, d] = t.split('-').map(Number)
  const last = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + maxAdvanceDays))
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}-${String(
    last.getUTCDate(),
  ).padStart(2, '0')}`
}

/**
 * Collapse a flat slot list to one entry per distinct start time, keeping the
 * first eligible staff member. This is what the customer sees when
 * showStaffPicker is off: "15:30", not "15:30 with Amine, 15:30 with Karim".
 */
export function dedupeByStart(slots: Slot[]): Slot[] {
  const seen = new Set<number>()
  const out: Slot[] = []
  for (const s of slots) {
    const t = s.start.getTime()
    if (seen.has(t)) continue
    seen.add(t)
    out.push(s)
  }
  return out
}

export function groupByDay(
  slots: Slot[],
  timeZone: string,
  dayKeyFn: (d: Date, tz: string) => DayKey,
): Map<DayKey, Slot[]> {
  const map = new Map<DayKey, Slot[]>()
  for (const s of slots) {
    const key = dayKeyFn(s.start, timeZone)
    const list = map.get(key)
    if (list) list.push(s)
    else map.set(key, [s])
  }
  return map
}
