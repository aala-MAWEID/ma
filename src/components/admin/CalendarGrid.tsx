import { useEffect, useMemo, useRef } from 'react'
import { BookingChip } from '@/components/admin/BookingChip'
import { useDragBooking, type DragProposal } from '@/hooks/useDragBooking'
import { useTick } from '@/hooks'
import { useLocale } from '@/contexts/LocaleContext'
import { CALENDAR_END_HOUR, CALENDAR_START_HOUR } from '@/config/constants'
import { minutesOfDay, minutesToClock, todayKey } from '@/lib/time'
import type { AgendaItem, DayKey, Staff, UUID } from '@/types/domain'

/**
 * The day view: one column per person, one row per hour, appointments
 * positioned by arithmetic rather than by layout.
 *
 * Everything about the geometry comes from `--cal-hour-height`. Change that
 * one token and the grid, the chips, the now-line and the drag snapping all
 * stay consistent, because they all divide by the same number.
 */
export function CalendarGrid({
  day,
  timeZone,
  columns,
  byStaff,
  snapMin,
  onOpen,
  onMove,
}: {
  day: DayKey
  timeZone: string
  columns: Staff[]
  byStaff: Map<UUID, AgendaItem[]>
  snapMin: number
  onOpen: (item: AgendaItem) => void
  onMove: (proposal: DragProposal) => Promise<boolean>
}) {
  const { t } = useLocale()
  const scrollRef = useRef<HTMLDivElement>(null)
  const hours = useMemo(
    () =>
      Array.from(
        { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
        (_, i) => CALENDAR_START_HOUR + i,
      ),
    [],
  )

  const drag = useDragBooking({
    day,
    timeZone,
    startHour: CALENDAR_START_HOUR,
    snapMin,
    onCommit: onMove,
  })

  // now-line, refreshed every minute
  useTick(60_000)
  const isToday = day === todayKey(timeZone)
  const nowMinutes = minutesOfDay(new Date(), timeZone)
  const nowVisible =
    isToday && nowMinutes >= CALENDAR_START_HOUR * 60 && nowMinutes <= CALENDAR_END_HOUR * 60

  // open on the current hour instead of at 08:00
  useEffect(() => {
    if (!nowVisible || !scrollRef.current) return
    const offset = ((nowMinutes - CALENDAR_START_HOUR * 60) / 60) * 64 - 120
    scrollRef.current.scrollTop = Math.max(0, offset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  const columnIds = columns.map((c) => c.id)
  const toPx = (minutes: number) =>
    ((minutes - CALENDAR_START_HOUR * 60) / 60) * (drag.pxPerMinute() * 60)

  return (
    <div className="calendar" ref={scrollRef}>
      <div className="calendar__head">
        <div className="calendar__gutter-head" />
        {columns.map((person) => (
          <div
            key={person.id}
            className="calendar__col-head"
            style={{ ['--col-color' as string]: person.color }}
          >
            <span className="calendar__col-name">{person.displayName}</span>
            <span className="calendar__col-count">{byStaff.get(person.id)?.length ?? 0}</span>
          </div>
        ))}
      </div>

      <div className="calendar__body" ref={drag.bodyRef}>
        <div className="calendar__gutter">
          {hours.map((hour) => (
            <div key={hour} className="calendar__hour-label">
              {minutesToClock(hour * 60)}
            </div>
          ))}
        </div>

        {columns.map((person) => (
          <div
            key={person.id}
            className="calendar__col"
            data-staff-column={person.id}
            data-drop-target={drag.dropStaffId === person.id ? 'true' : undefined}
          >
            {hours.map((hour) => (
              <div key={hour} className="calendar__hour" aria-hidden="true" />
            ))}

            {(byStaff.get(person.id) ?? []).map((item) => {
              const startMin = minutesOfDay(item.startsAt, timeZone)
              const endMin = minutesOfDay(item.endsAt, timeZone)
              const isDragged = drag.drag?.bookingId === item.id && drag.drag.moved
              const shownStart = isDragged ? drag.drag!.minutes : startMin
              const shownStaff = isDragged ? drag.drag!.staffId : item.staffId
              if (shownStaff !== person.id) return null

              return (
                <BookingChip
                  key={item.id}
                  item={item}
                  topPx={toPx(shownStart)}
                  heightPx={Math.max(22, ((endMin - startMin) / 60) * drag.pxPerMinute() * 60)}
                  timeZone={timeZone}
                  dragging={isDragged}
                  onOpen={onOpen}
                  onPointerDown={(e) => drag.handlers.onPointerDown(e, item, startMin)}
                  onPointerMove={drag.handlers.onPointerMove}
                  onPointerUp={(e) => void drag.handlers.onPointerUp(e)}
                  onPointerCancel={drag.handlers.onPointerCancel}
                  onKeyDown={(e) => void drag.keyboardMove(e, item, startMin, columnIds)}
                />
              )
            })}

            {/* ghost of the original position while dragging */}
            {drag.drag?.moved && drag.drag.originStaffId === person.id && (
              <div
                className="chip__ghost"
                aria-hidden="true"
                style={{ insetBlockStart: `${toPx(drag.drag.originMinutes)}px` }}
              />
            )}
          </div>
        ))}

        {nowVisible && (
          <div className="calendar__now" style={{ insetBlockStart: `${toPx(nowMinutes)}px` }}>
            <span className="calendar__now-label">{minutesToClock(nowMinutes)}</span>
          </div>
        )}
      </div>

      <p className="calendar__hint">{t('admin.dragHint')}</p>
    </div>
  )
}
