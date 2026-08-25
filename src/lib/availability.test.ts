import { describe, expect, it } from 'vitest'
import { computeAvailability, windowsFor } from '@/lib/availability'
import type { AvailabilityInput, StaffCandidate } from '@/lib/availability'
import type { WorkingHour } from '@/types/domain'
import { dayKeyToUtc } from '@/lib/time'

const TZ = 'Africa/Casablanca'
const TENANT = 't1'

const amine: StaffCandidate = { id: 's1', name: 'أمين', sortOrder: 1, durationMin: 30 }

function hour(staffId: string | null, weekday: number, o: number, c: number): WorkingHour {
  return {
    id: `${staffId}-${weekday}-${o}`,
    tenantId: TENANT,
    staffId,
    weekday: weekday as WorkingHour['weekday'],
    opensMin: o,
    closesMin: c,
  }
}

/** 2026-09-07 is a Monday. */
const MONDAY = '2026-09-07'

function base(over: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    now: dayKeyToUtc('2026-09-01', 8 * 60, TZ),
    timeZone: TZ,
    from: MONDAY,
    days: 1,
    granularityMin: 15,
    minNoticeMin: 0,
    maxAdvanceDays: 60,
    todayKey: '2026-09-01',
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    maxPerDay: undefined,
    staff: [amine],
    workingHours: [hour(null, 1, 540, 720)], // Monday 09:00-12:00
    closedDays: new Set(),
    timeOff: [],
    busy: [],
    ...over,
  }
}

describe('windowsFor', () => {
  it('falls back to tenant-wide hours', () => {
    expect(windowsFor([hour(null, 1, 540, 720)], 's1', 1)).toEqual([
      { opensMin: 540, closesMin: 720 },
    ])
  })

  it('lets a staff row override the tenant row for that weekday only', () => {
    const hours = [hour(null, 1, 540, 720), hour(null, 2, 540, 720), hour('s1', 1, 600, 900)]
    expect(windowsFor(hours, 's1', 1)).toEqual([{ opensMin: 600, closesMin: 900 }])
    expect(windowsFor(hours, 's1', 2)).toEqual([{ opensMin: 540, closesMin: 720 }])
  })
})

describe('computeAvailability', () => {
  it('slices a window into slots that fit', () => {
    const slots = computeAvailability(base())
    // 09:00 -> 11:30 inclusive, every 15 min, 30-min service => 11 slots
    expect(slots).toHaveLength(11)
    expect(slots[0]!.start.getTime()).toBe(dayKeyToUtc(MONDAY, 540, TZ).getTime())
    expect(slots.at(-1)!.start.getTime()).toBe(dayKeyToUtc(MONDAY, 690, TZ).getTime())
  })

  it('never produces a slot that overruns closing time', () => {
    const slots = computeAvailability(base({ staff: [{ ...amine, durationMin: 90 }] }))
    const close = dayKeyToUtc(MONDAY, 720, TZ).getTime()
    for (const s of slots) expect(s.end.getTime()).toBeLessThanOrEqual(close)
  })

  it('honours minimum notice', () => {
    const slots = computeAvailability(
      base({
        now: dayKeyToUtc(MONDAY, 9 * 60, TZ),
        todayKey: MONDAY,
        minNoticeMin: 120,
      }),
    )
    expect(slots[0]!.start.getTime()).toBe(dayKeyToUtc(MONDAY, 660, TZ).getTime())
  })

  it('removes slots blocked by an existing booking', () => {
    const slots = computeAvailability(
      base({
        busy: [
          {
            staffId: 's1',
            start: dayKeyToUtc(MONDAY, 600, TZ),
            end: dayKeyToUtc(MONDAY, 630, TZ),
          },
        ],
      }),
    )
    const starts = slots.map((s) => s.start.getTime())
    expect(starts).not.toContain(dayKeyToUtc(MONDAY, 600, TZ).getTime())
    expect(starts).not.toContain(dayKeyToUtc(MONDAY, 585, TZ).getTime()) // would overrun
  })

  it('extends the block by the service buffers', () => {
    const withBuffer = computeAvailability(
      base({
        bufferAfterMin: 15,
        busy: [
          {
            staffId: 's1',
            start: dayKeyToUtc(MONDAY, 600, TZ),
            end: dayKeyToUtc(MONDAY, 630, TZ),
          },
        ],
      }),
    )
    const starts = withBuffer.map((s) => s.start.getTime())
    // 09:30 (570) + 30 + 15 buffer = 10:15, which now overlaps the 10:00 booking
    expect(starts).not.toContain(dayKeyToUtc(MONDAY, 570, TZ).getTime())
  })

  it('respects time off that belongs to the whole business', () => {
    const slots = computeAvailability(
      base({
        timeOff: [
          {
            staffId: null,
            start: dayKeyToUtc(MONDAY, 540, TZ),
            end: dayKeyToUtc(MONDAY, 660, TZ),
          },
        ],
      }),
    )
    expect(slots[0]!.start.getTime()).toBe(dayKeyToUtc(MONDAY, 660, TZ).getTime())
  })

  it('returns nothing on a closed day', () => {
    expect(computeAvailability(base({ closedDays: new Set([MONDAY]) }))).toHaveLength(0)
  })

  it('stops at the booking horizon', () => {
    const slots = computeAvailability(
      base({ from: MONDAY, days: 1, todayKey: '2026-09-01', maxAdvanceDays: 3 }),
    )
    expect(slots).toHaveLength(0)
  })

  it('sorts by time then by staff order', () => {
    const slots = computeAvailability(
      base({
        staff: [
          { id: 's2', name: 'كريم', sortOrder: 2, durationMin: 30 },
          amine,
        ],
      }),
    )
    expect(slots[0]!.staffId).toBe('s1')
    expect(slots[1]!.staffId).toBe('s2')
  })
})
