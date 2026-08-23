import { useEffect, useState } from 'react'
import type { TenantBundle } from '@/data'
import { minutesOfDay, todayKey, weekdayOf } from '@/lib/time'
import { windowsFor } from '@/lib/availability'

export { useAsync } from '@/hooks/useAsync'
export { useAvailability } from '@/hooks/useAvailability'
export { useBookingFlow } from '@/hooks/useBookingFlow'
export { useHold } from '@/hooks/useHold'
export { useAdminCalendar } from '@/hooks/useAdminCalendar'
export { useDragBooking } from '@/hooks/useDragBooking'
export { useTurnStatus } from '@/hooks/useTurnStatus'

/** Re-render on an interval. Used by the hold countdown and the now-line. */
export function useTick(ms: number, enabled = true): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setTick((t) => t + 1), ms)
    return () => window.clearInterval(id)
  }, [ms, enabled])
  return tick
}

/** Is the business open right now, according to its own hours and its own zone? */
export function useOpenNow(bundle: TenantBundle | null): boolean {
  useTick(60_000, Boolean(bundle))
  if (!bundle) return false
  const tz = bundle.tenant.timeZone
  const now = new Date()
  const today = todayKey(tz, now)
  if (bundle.closedDates.some((c) => c.day === today)) return false
  const minutes = minutesOfDay(now, tz)
  return bundle.workingHours
    .filter((h) => h.staffId === null && h.weekday === weekdayOf(today))
    .some((w) => minutes >= w.opensMin && minutes < w.closesMin)
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Close on Escape. Every overlay in the app uses it. */
export function useEscape(onEscape: () => void, active = true): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onEscape, active])
}

// ---- التوست: مصدر واحد فقط (contexts/ToastContext) ----
// كان هنا سياق ثانٍ لا يزوّده أحد، وهو سبب انهيار /admin/requests.
export {
  ToastContext,
  ToastProvider,
  useToast,
  useOptionalToast,
} from '@/contexts/ToastContext'
export type { Toast, ToastApi, ToastTone, ToastToneInput } from '@/contexts/ToastContext'

/** Which working windows apply today, for the calendar background. */
export function useDayWindows(bundle: TenantBundle | null, day: string, staffId: string) {
  if (!bundle) return []
  return windowsFor(bundle.workingHours, staffId, weekdayOf(day))
}
