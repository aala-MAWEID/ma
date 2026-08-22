import { forwardRef, type KeyboardEvent, type PointerEvent } from 'react'
import { STATUS_META } from '@/config/constants'
import { useLocale } from '@/context/LocaleContext'
import { formatTime } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { AgendaItem } from '@/types/domain'

/**
 * One appointment on the calendar.
 *
 * `touch-action: none` in the stylesheet is what makes dragging work on a
 * phone: without it the browser claims the gesture for scrolling and the chip
 * never moves. `inset-block-start` and `block-size` are set inline because
 * they are data, not design.
 */
export const BookingChip = forwardRef<
  HTMLDivElement,
  {
    item: AgendaItem
    topPx: number
    heightPx: number
    timeZone: string
    dragging?: boolean
    onOpen: (item: AgendaItem) => void
    onPointerDown: (e: PointerEvent<HTMLElement>) => void
    onPointerMove: (e: PointerEvent<HTMLElement>) => void
    onPointerUp: (e: PointerEvent<HTMLElement>) => void
    onPointerCancel: () => void
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  }
>(function BookingChip(
  {
    item,
    topPx,
    heightPx,
    timeZone,
    dragging,
    onOpen,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
  },
  ref,
) {
  const { t, locale } = useLocale()
  const meta = STATUS_META[item.status]

  return (
    <div
      ref={ref}
      className={cn('chip')}
      data-status={item.status}
      data-dragging={dragging ? 'true' : undefined}
      style={{
        insetBlockStart: `${topPx}px`,
        blockSize: `${heightPx}px`,
        ['--chip-color' as string]: item.serviceColor ?? meta.color,
      }}
      role="button"
      tabIndex={0}
      aria-label={`${item.customerName ?? ''} · ${item.serviceName} · ${formatTime(item.startsAt, timeZone, locale)} · ${t(meta.key)}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(item)
          return
        }
        onKeyDown(e)
      }}
      onDoubleClick={() => onOpen(item)}
    >
      <span className="chip__time">{formatTime(item.startsAt, timeZone, locale)}</span>
      <span className="chip__name">{item.customerName ?? t('common.empty')}</span>
      {heightPx > 44 && <span className="chip__service">{item.serviceName}</span>}
    </div>
  )
})
