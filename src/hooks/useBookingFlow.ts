import { useCallback, useEffect, useMemo, useState } from 'react'
import { data } from '@/data'
import { errorCodeOf, type ErrorCode } from '@/data/errors'
import { useHold } from '@/hooks/useHold'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useLocale } from '@/contexts/LocaleContext'
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
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [result, setResult] = useState<Booking | null>(null)

  const holdApi = useHold(bundle.tenant.slug)

  // Mirror hold API error
  useEffect(() => {
    if (holdApi.error) setError(holdApi.error)
    if (holdApi.detail) setErrorDetail(holdApi.detail)
  }, [holdApi.error, holdApi.detail])

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
      setErrorDetail(null)
      const res = await holdApi.acquire(serviceId, next.staffId, next.start)
      if (!res.ok) {
        setError(res.error)
        setErrorDetail(res.detail)
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

  const blockingReason: 'fullName' | 'phone' | 'email' | 'notes' | 'slot' | 'hold' | null =
    fieldErrors.fullName
      ? 'fullName'
      : fieldErrors.phone
        ? 'phone'
        : fieldErrors.email
          ? 'email'
          : fieldErrors.notes
            ? 'notes'
            : !slot
              ? 'slot'
              : null

  /** يقبل حجزاً صريحاً حتى لا يقرأ حالة قديمة من الإغلاق. */
  const submitWith = useCallback(
    async (activeHold: { bookingId: string; code: string }) => {
      setSubmitting(true)
      setError(null)
      try {
        const booking = await data.confirmHold({
          bookingId: activeHold.bookingId,
          code: activeHold.code,
          fullName: draft.fullName.trim(),
          phone: draft.phone.trim(),
          email: draft.email?.trim() || undefined,
          notes: draft.notes?.trim() || undefined,
          locale,
        })
        holdApi.forget()
        setResult(booking)
        setStep('done')
        return { ok: true as const }
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e)
        const code = errorCodeOf(e)
        setError(code)
        setErrorDetail(`${code} · ${raw}`)
        if (code === 'hold_expired' || code === 'hold_already_used' || code === 'slot_taken') {
          setSlot(null)
          setStep('time')
          return { ok: false as const, reason: 'expired' as const, code }
        }
        return { ok: false as const, reason: 'error' as const, code }
      } finally {
        setSubmitting(false)
      }
    },
    [draft, locale, holdApi],
  )

  const attemptSubmit = useCallback(async () => {
    if (submitting) return { ok: false as const, reason: 'busy' as const }
    if (blockingReason) return { ok: false as const, reason: blockingReason }
    if (!slot || !serviceId) return { ok: false as const, reason: 'slot' as const }

    // الحجز القائم أو إعادة حجز فورية، دون قراءة الحالة بعد await
    let active = holdApi.hold
    if (!active || holdApi.expired) {
      const res = await holdApi.acquire(serviceId, slot.staffId, slot.start)
      if (res.ok) {
        active = res.hold
      } else {
        setError(res.error)
        setErrorDetail(res.detail)
        return { ok: false as const, reason: 'expired' as const }
      }
    }
    if (!active?.bookingId || !active.code) {
      return { ok: false as const, reason: 'expired' as const }
    }

    return submitWith({ bookingId: active.bookingId, code: active.code })
  }, [submitting, blockingReason, slot, serviceId, holdApi, submitWith])

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
    canSubmit: !submitting,
    blockingReason,
    attemptSubmit,
    submitting,
    error,
    errorDetail,
    result,
    hold: holdApi,
    chooseService,
    chooseStaff,
    chooseDay,
    chooseSlot,
    submit: attemptSubmit,
    back,
    reset,
  }
}
