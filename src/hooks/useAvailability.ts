import { useMemo } from 'react'
import { data } from '@/data'
import { useAsync } from '@/hooks/useAsync'
import { dedupeByStart } from '@/lib/availability'
import { dayKeyOf, minutesOfDay, todayKey } from '@/lib/time'
import { SLOT_PERIODS } from '@/config/constants'
import type { DayKey, Slot, UUID } from '@/types/domain'

export interface UseAvailabilityArgs {
  slug: string
  serviceId: UUID | null
  staffId: UUID | null
  day: DayKey | null
  timeZone: string
  /** window start day; defaults to today in tenant time zone */
  from?: DayKey | null
  /** how many days to fetch at once; the strip needs a window, the grid one day */
  days?: number
  /** collapse duplicate start times when the customer did not pick a person */
  collapse?: boolean
}

export interface SlotPeriod {
  key: string
  slots: Slot[]
}

/**
 * Slots for one day, already grouped into morning / afternoon / evening.
 * Fetching a whole window from today and filtering locally means moving between days in
 * the strip is instant instead of a round trip per tap.
 */
export function useAvailability(args: UseAvailabilityArgs) {
  const { slug, serviceId, staffId, day, timeZone, days = 14, collapse = true } = args

  const windowStart = args.from ?? todayKey(timeZone)
  const enabled = Boolean(serviceId)
  const from = windowStart

  const state = useAsync<Slot[]>(
    () =>
      data.getAvailability({
        slug,
        serviceId: serviceId as UUID,
        staffId,
        from,
        days,
      }),
    [slug, serviceId, staffId, from, days],
    enabled,
  )

  const forDay = useMemo(() => {
    if (!state.value || !day) return []
    const same = state.value.filter((s) => dayKeyOf(s.start, timeZone) === day)
    return collapse ? dedupeByStart(same) : same
  }, [state.value, day, timeZone, collapse])

  const periods = useMemo<SlotPeriod[]>(() => {
    return SLOT_PERIODS.map((p) => ({
      key: p.key,
      slots: forDay.filter((s) => {
        const m = minutesOfDay(s.start, timeZone)
        return m >= p.from && m < p.to
      }),
    })).filter((p) => p.slots.length > 0)
  }, [forDay, timeZone])

  const countsByDay = useMemo(() => {
    const counts: Record<DayKey, number> = {}
    for (const s of state.value ?? []) {
      const key = dayKeyOf(s.start, timeZone)
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, [state.value, timeZone])

  return {
    all: state.value ?? [],
    slots: forDay,
    periods,
    countsByDay,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  }
}
