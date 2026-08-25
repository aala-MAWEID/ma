import { useMemo, useRef } from 'react'
import { useLocale } from '@/contexts/LocaleContext'
import { addDaysToKey, formatDayKey, relativeDayLabel, todayKey } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { DayKey } from '@/types/domain'

export interface DayStripProps {
  value: DayKey
  onPick: (day: DayKey) => void
  timeZone: string
  counts: Record<DayKey, number>
  days?: number
  closedDays: Set<DayKey>
  closedLabels?: Record<DayKey, string>
  loading?: boolean
}

/**
 * A horizontal day picker instead of a month grid. On a phone, a calendar
 * month wastes a screen to show 30 days of which 4 matter; a strip shows the
 * window with the count of free slots on each day.
 */
export function DayStrip({
  value,
  onPick,
  timeZone,
  counts,
  days = 14,
  closedDays,
  closedLabels = {},
  loading = false,
}: DayStripProps) {
  const { locale, t } = useLocale()
  const listRef = useRef<HTMLDivElement>(null)
  const start = todayKey(timeZone)

  const items = useMemo(
    () => Array.from({ length: days }, (_, i) => addDaysToKey(start, i)),
    [start, days],
  )

  return (
    <div className="day-strip" ref={listRef} role="tablist">
      {items.map((day) => {
        const closed = closedDays.has(day)
        const count = counts[day]
        const isUnknown = count === undefined && loading
        const isZero = !closed && !isUnknown && count === 0
        const disabled = closed || isZero || isUnknown

        const titleText = closed
          ? (closedLabels[day] || t('common.closedNow'))
          : isZero
            ? (t('booking.noSlots') || '0')
            : count !== undefined
              ? `${count} ${t('booking.slotsAvailable') || ''}`
              : ''

        return (
          <button
            key={day}
            role="tab"
            type="button"
            aria-selected={value === day}
            disabled={disabled}
            title={titleText}
            className={cn(
              'day-chip',
              value === day && 'is-selected',
              disabled && 'is-disabled',
              closed && 'is-closed',
            )}
            onClick={() => onPick(day)}
          >
            <span className="day-chip__dow">{relativeDayLabel(day, timeZone, locale)}</span>
            <span className="day-chip__num">{formatDayKey(day, locale, { day: 'numeric' })}</span>
            <span className="day-chip__count">
              {closed ? '—' : isUnknown ? '…' : (count ?? 0)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
