import { useCallback, useEffect, useMemo, useState } from 'react'
import { data } from '@/data'
import { errorCodeOf, type ErrorCode } from '@/data/errors'
import { useTenantBundle } from '@/contexts/TenantContext'
import { CALENDAR_END_HOUR, CALENDAR_START_HOUR } from '@/config/constants'
import { addDaysToKey, dayKeyToUtc, todayKey } from '@/lib/time'
import type { AgendaItem, DayKey, UUID } from '@/types/domain'

/**
 * Owns one day of the owner's calendar: the data, the columns, the live
 * subscription, and the optimistic move.
 *
 * Optimism matters here. Dragging an appointment and waiting 300ms for the
 * chip to arrive feels broken; the chip must follow the finger and only snap
 * back if the server refuses.
 */
export function useAdminCalendar(initialDay?: DayKey) {
  const bundle = useTenantBundle()
  const tz = bundle.tenant.timeZone
  const tenantId = bundle.tenant.id

  const [day, setDay] = useState<DayKey>(initialDay ?? todayKey(tz))
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ErrorCode | null>(null)

  const from = useMemo(() => dayKeyToUtc(day, CALENDAR_START_HOUR * 60, tz), [day, tz])
  const to = useMemo(() => dayKeyToUtc(day, CALENDAR_END_HOUR * 60, tz), [day, tz])

  const load = useCallback(async () => {
    setError(null)
    try {
      setItems(await data.getAgenda(tenantId, from, to))
    } catch (e) {
      setError(errorCodeOf(e))
    } finally {
      setLoading(false)
    }
  }, [tenantId, from, to])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  // Live: another device confirming a request repaints this calendar.
  useEffect(() => data.subscribeBookings(tenantId, () => void load()), [tenantId, load])

  const columns = useMemo(
    () => bundle.staff.filter((s) => s.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [bundle.staff],
  )

  const byStaff = useMemo(() => {
    const map = new Map<UUID, AgendaItem[]>()
    for (const s of columns) map.set(s.id, [])
    for (const item of items) map.get(item.staffId)?.push(item)
    return map
  }, [columns, items])

  /** Optimistic move. Returns true if the server accepted it. */
  const move = useCallback(
    async (bookingId: UUID, startsAt: Date, staffId: UUID): Promise<boolean> => {
      const before = items
      const target = items.find((i) => i.id === bookingId)
      if (!target) return false

      const durationMs = target.endsAt.getTime() - target.startsAt.getTime()
      setItems((list) =>
        list.map((i) =>
          i.id === bookingId
            ? { ...i, startsAt, endsAt: new Date(startsAt.getTime() + durationMs), staffId }
            : i,
        ),
      )

      try {
        const saved = await data.moveBooking(bookingId, startsAt, staffId)
        setItems((list) => list.map((i) => (i.id === bookingId ? saved : i)))
        return true
      } catch (e) {
        setItems(before) // rollback
        setError(errorCodeOf(e))
        return false
      }
    },
    [items],
  )

  const decide = useCallback(
    async (bookingId: UUID, decision: 'confirm' | 'decline' | 'complete' | 'no_show') => {
      try {
        await data.decide(bookingId, decision)
        await load()
        return true
      } catch (e) {
        setError(errorCodeOf(e))
        return false
      }
    },
    [load],
  )

  const cancel = useCallback(
    async (bookingId: UUID, reason?: string | null) => {
      try {
        await data.cancelBookingAdmin(bookingId, reason ?? null)
        await load()
        return true
      } catch (e) {
        setError(errorCodeOf(e))
        return false
      }
    },
    [load],
  )

  const remove = useCallback(
    async (bookingId: UUID, reason?: string | null) => {
      try {
        await data.deleteBooking(bookingId, reason ?? null)
        await load()
        return true
      } catch (e) {
        setError(errorCodeOf(e))
        return false
      }
    },
    [load],
  )

  return {
    day,
    setDay,
    goToday: () => setDay(todayKey(tz)),
    prevDay: () => setDay((d) => addDaysToKey(d, -1)),
    nextDay: () => setDay((d) => addDaysToKey(d, 1)),
    items,
    byStaff,
    columns,
    loading,
    error,
    clearError: () => setError(null),
    reload: load,
    move,
    decide,
    cancel,
    remove,
    timeZone: tz,
  }
}

