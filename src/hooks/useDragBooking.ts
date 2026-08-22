import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { MOVABLE_STATUSES } from '@/config/constants'
import { dayKeyToUtc } from '@/lib/time'
import type { AgendaItem, DayKey, UUID } from '@/types/domain'

/**
 * DRAG AND DROP, WRITTEN BY HAND.
 *
 * No dnd library. Three reasons:
 *   1. this grid has exactly one drag type; a general library is 40kB to solve
 *      a problem we do not have
 *   2. pointer events already unify mouse, touch and stylus
 *   3. setPointerCapture means the gesture keeps working when the finger
 *      leaves the chip — which is the entire difficulty, and libraries hide it
 *
 * GEOMETRY CONTRACT
 *   pxPerMinute = --cal-hour-height / 60
 *   a vertical delta becomes a minute delta, snapped to `snapMin`
 *   a horizontal move is resolved by hit-testing [data-staff-column] under
 *   the pointer, so reassigning to another person is the same gesture
 *
 * ACCESSIBILITY
 *   Dragging is never the only way. A focused chip responds to arrow keys:
 *   Up/Down shift by one snap step, Left/Right change column, Enter commits,
 *   Escape cancels. Same code path, same validation.
 */

export interface DragProposal {
  bookingId: UUID
  startsAt: Date
  staffId: UUID
  /** minutes from midnight, for the ghost label */
  minutes: number
}

interface DragState extends DragProposal {
  originMinutes: number
  originStaffId: UUID
  pointerId: number
  startClientY: number
  durationMin: number
  moved: boolean
}

export interface UseDragBookingArgs {
  day: DayKey
  timeZone: string
  startHour: number
  snapMin: number
  onCommit: (proposal: DragProposal) => Promise<boolean>
}

/** Movement under this many pixels is a click, not a drag. */
const THRESHOLD_PX = 4

export function useDragBooking({
  day,
  timeZone,
  startHour,
  snapMin,
  onCommit,
}: UseDragBookingArgs) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const pxPerMinute = useRef(64 / 60)

  dragRef.current = drag

  // Read the geometry from CSS so the token stays the single source of truth.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const raw = getComputedStyle(el).getPropertyValue('--cal-hour-height').trim()
    const px = Number.parseFloat(raw)
    if (Number.isFinite(px) && px > 0) pxPerMinute.current = px / 60
  }, [])

  const snap = useCallback(
    (minutes: number) => Math.round(minutes / snapMin) * snapMin,
    [snapMin],
  )

  const staffColumnAt = useCallback((clientX: number, clientY: number): UUID | null => {
    const el = document
      .elementsFromPoint(clientX, clientY)
      .find((n) => n instanceof HTMLElement && n.dataset.staffColumn) as HTMLElement | undefined
    return el?.dataset.staffColumn ?? null
  }, [])

  const begin = useCallback(
    (event: PointerEvent<HTMLElement>, item: AgendaItem, minutes: number) => {
      if (!MOVABLE_STATUSES.includes(item.status)) return
      if (event.button !== 0 && event.pointerType === 'mouse') return

      event.currentTarget.setPointerCapture(event.pointerId)
      const durationMin = Math.round(
        (item.endsAt.getTime() - item.startsAt.getTime()) / 60_000,
      )

      setDrag({
        bookingId: item.id,
        startsAt: item.startsAt,
        staffId: item.staffId,
        minutes,
        originMinutes: minutes,
        originStaffId: item.staffId,
        pointerId: event.pointerId,
        startClientY: event.clientY,
        durationMin,
        moved: false,
      })
    },
    [],
  )

  const update = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const current = dragRef.current
      if (!current || current.pointerId !== event.pointerId) return

      const dy = event.clientY - current.startClientY
      if (!current.moved && Math.abs(dy) < THRESHOLD_PX) return

      const deltaMin = dy / pxPerMinute.current
      const minutes = clampToDay(
        snap(current.originMinutes + deltaMin),
        startHour,
        current.durationMin,
      )
      const staffId = staffColumnAt(event.clientX, event.clientY) ?? current.staffId

      setDrag({
        ...current,
        moved: true,
        minutes,
        staffId,
        startsAt: dayKeyToUtc(day, minutes, timeZone),
      })
    },
    [snap, startHour, staffColumnAt, day, timeZone],
  )

  const finish = useCallback(
    async (event: PointerEvent<HTMLElement>) => {
      const current = dragRef.current
      if (!current || current.pointerId !== event.pointerId) return
      setDrag(null)

      const unchanged =
        !current.moved ||
        (current.minutes === current.originMinutes &&
          current.staffId === current.originStaffId)
      if (unchanged) return

      await onCommit({
        bookingId: current.bookingId,
        startsAt: current.startsAt,
        staffId: current.staffId,
        minutes: current.minutes,
      })
    },
    [onCommit],
  )

  const cancel = useCallback(() => setDrag(null), [])

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current) cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  /** Keyboard equivalent of the whole gesture, for one focused chip. */
  const keyboardMove = useCallback(
    async (
      event: KeyboardEvent<HTMLElement>,
      item: AgendaItem,
      minutes: number,
      columns: UUID[],
    ) => {
      if (!MOVABLE_STATUSES.includes(item.status)) return
      const index = columns.indexOf(item.staffId)
      let nextMinutes = minutes
      let nextStaff = item.staffId

      switch (event.key) {
        case 'ArrowUp':
          nextMinutes = minutes - snapMin
          break
        case 'ArrowDown':
          nextMinutes = minutes + snapMin
          break
        case 'ArrowLeft':
          nextStaff = columns[Math.max(0, index - 1)] ?? item.staffId
          break
        case 'ArrowRight':
          nextStaff = columns[Math.min(columns.length - 1, index + 1)] ?? item.staffId
          break
        default:
          return
      }
      event.preventDefault()

      const durationMin = Math.round(
        (item.endsAt.getTime() - item.startsAt.getTime()) / 60_000,
      )
      const clamped = clampToDay(nextMinutes, startHour, durationMin)

      await onCommit({
        bookingId: item.id,
        startsAt: dayKeyToUtc(day, clamped, timeZone),
        staffId: nextStaff,
        minutes: clamped,
      })
    },
    [snapMin, startHour, onCommit, day, timeZone],
  )

  return {
    bodyRef,
    drag,
    isDragging: (id: UUID) => drag?.bookingId === id && drag.moved,
    dropStaffId: drag?.moved ? drag.staffId : null,
    handlers: {
      onPointerDown: begin,
      onPointerMove: update,
      onPointerUp: finish,
      onPointerCancel: cancel,
    },
    keyboardMove,
    pxPerMinute: () => pxPerMinute.current,
  }
}

function clampToDay(minutes: number, startHour: number, durationMin: number): number {
  const min = startHour * 60
  const max = 24 * 60 - durationMin
  return Math.min(Math.max(minutes, min), max)
}
