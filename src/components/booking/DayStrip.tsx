import { useMemo, useRef } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { addDaysToKey, formatDayKey, relativeDayLabel, todayKey } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { DayKey } from '@/types/domain'

/**
 * A horizontal day picker instead of a month grid. On a phone, a calendar
 * month wastes a screen to show 30 days of which 4 matter; a strip shows the
 * next fortnight with the count of free slots on each day, which is the only
 * number the customer is actually looking for.
 */
export function DayStrip({
  value,
  onPick,
  timeZone,
  counts,
  days = 14,
  closedDays,
}: {
  value: DayKey
  onPick: (day: DayKey) => void
  timeZone: string
  counts: Record<DayKey, number>
  days?: number
  closedDays: Set<DayKey>
}) {
  const { locale } = useLocale()
  const listRef = useRef<HTMLDivElement>(null)
  const start = todayKey(timeZone)

  const items = useMemo(
    () => Array.from({ length: days }, (_, i) => addDaysToKey(start, i)),
    [start, days],
  )

  return (
    <div className="day-strip" ref={listRef} role="tablist">
      {items.map((day) => {
        const count = counts[day] ?? 0
        const closed = closedDays.has(day)
        const disabled = closed || count === 0
        return (
          <button
            key={day}
            role="tab"
            type="button"
            aria-selected={value === day}
            disabled={disabled}
            className={cn('day-chip', value === day && 'is-selected', disabled && 'is-disabled')}
            onClick={() => onPick(day)}
          >
            <span className="day-chip__dow">{relativeDayLabel(day, timeZone, locale)}</span>
            <span className="day-chip__num">{formatDayKey(day, locale, { day: 'numeric' })}</span>
            <span className="day-chip__count">
              {disabled ? '—' : count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
