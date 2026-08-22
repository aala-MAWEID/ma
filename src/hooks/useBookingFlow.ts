import { useCallback, useMemo, useState } from 'react'
import { data } from '@/data'
import { errorCodeOf, type ErrorCode } from '@/data/errors'
import { useHold } from '@/hooks/useHold'
import { useTenantBundle } from '@/context/TenantContext'
import { useLocale } from '@/context/LocaleContext'
import { todayKey } from '@/lib/time'
import { validateCustomer, isClean, type CustomerDraft } from '@/lib/validation'
import { BOOKING_STEPS, type BookingStep } from '@/config/constants'
import type { Booking, DayKey, Service, Slot, Staff, UUID } from '@/types/domain'

/**
 * The state machine behind the five-step wizard.
 *
 * Every step change clears the state that step invalidates — changing the
 * service after picking a time must not silently keep a slot that belongs to a
 * different duration. That single rule prevents most booking bugs.
 */
export function useBookingFlow() {
  const bundle = useTenantBundle()
  const { locale } = useLocale()
  const tz = bundle.tenant.timeZone

  const [step, setStep] = useState<BookingStep>('service')
  const [serviceId, setServiceId] = useState<UUID | null>(null)
  const [staffId, setStaffId] = useState<UUID | null>(null)
  const [day, setDay] = useState<DayKey>(() => todayKey(tz))
  const [slot, setSlot] = useState<Slot | null>(null)
  const [draft, setDraft] = useState<CustomerDraft>({
    fullName: '',
    phone: '',
    email: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [result, setResult] = useState<Booking | null>(null)

  const holdApi = useHold(bundle.tenant.slug)

  const service: Service | null = useMemo(
    () => bundle.services.find((s) => s.id === serviceId) ?? null,
    [bundle.services, serviceId],
  )

  /** Only staff who actually perform the chosen service. */
  const eligibleStaff: Staff[] = useMemo(() => {
    if (!serviceId) return []
    const ids = new Set(
      bundle.staffServices.filter((ss) => ss.serviceId === serviceId).map((ss) => ss.staffId),
    )
    return bundle.staff.filter((s) => ids.has(s.id)).sort((a, b) => a.sortOrder - b.sortOrder)
  }, [bundle, serviceId])

  const chooseService = useCallback(
    (id: UUID) => {
      setServiceId(id)
      setStaffId(null)
      setSlot(null)
      void holdApi.release()
      setStep(bundle.settings.showStaffPicker ? 'staff' : 'time')
    },
    [bundle.settings.showStaffPicker, holdApi],
  )

  const chooseStaff = useCallback(
    (id: UUID | null) => {
      setStaffId(id)
      setSlot(null)
      void holdApi.release()
      setStep('time')
    },
    [holdApi],
  )

  const chooseDay = useCallback(
    (next: DayKey) => {
      setDay(next)
      setSlot(null)
      void holdApi.release()
    },
    [holdApi],
  )

  /** Picking a time immediately locks it, then moves on. */
  const chooseSlot = useCallback(
    async (next: Slot) => {
      if (!serviceId) return
      setError(null)
      const acquired = await holdApi.acquire(serviceId, next.staffId, next.start)
      if (!acquired) {
        setError(holdApi.error ?? 'slot_taken')
        return
      }
      setSlot(next)
      setStep('details')
    },
    [serviceId, holdApi],
  )

  const fieldErrors = useMemo(
    () => validateCustomer(draft, bundle.settings.requireEmail),
    [draft, bundle.settings.requireEmail],
  )

  const submit = useCallback(async () => {
    if (!holdApi.hold || !isClean(fieldErrors)) return
    setSubmitting(true)
    setError(null)
    try {
      const booking = await data.confirmHold({
        bookingId: holdApi.hold.bookingId,
        code: holdApi.hold.code,
        fullName: draft.fullName,
        phone: draft.phone,
        email: draft.email || undefined,
        notes: draft.notes || undefined,
        locale,
      })
      holdApi.forget()
      setResult(booking)
      setStep('done')
    } catch (e) {
      setError(errorCodeOf(e))
      // a lost hold sends the customer back to the grid, not to a dead end
      if (errorCodeOf(e) === 'hold_expired' || errorCodeOf(e) === 'slot_taken') {
        setSlot(null)
        setStep('time')
      }
    } finally {
      setSubmitting(false)
    }
  }, [holdApi, fieldErrors, draft, locale])

  const back = useCallback(() => {
    const i = BOOKING_STEPS.indexOf(step)
    if (i <= 0) return
    const prev = BOOKING_STEPS[i - 1]!
    if (step === 'details') void holdApi.release()
    if (prev === 'staff' && !bundle.settings.showStaffPicker) {
      setStep('service')
      return
    }
    setStep(prev)
  }, [step, holdApi, bundle.settings.showStaffPicker])

  const reset = useCallback(() => {
    void holdApi.release()
    setStep('service')
    setServiceId(null)
    setStaffId(null)
    setSlot(null)
    setResult(null)
    setError(null)
    setDraft({ fullName: '', phone: '', email: '', notes: '' })
  }, [holdApi])

  return {
    step,
    setStep,
    service,
    serviceId,
    staffId,
    eligibleStaff,
    day,
    slot,
    draft,
    setDraft,
    fieldErrors,
    canSubmit: isClean(fieldErrors) && Boolean(holdApi.hold) && !submitting,
    submitting,
    error,
    result,
    hold: holdApi,
    chooseService,
    chooseStaff,
    chooseDay,
    chooseSlot,
    submit,
    back,
    reset,
  }
}
