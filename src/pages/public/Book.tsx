import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, EmptyState } from '@/components/ui'
import { ServicePicker } from '@/components/booking/ServicePicker'
import { StaffPicker } from '@/components/booking/StaffPicker'
import { DayStrip } from '@/components/booking/DayStrip'
import { SlotGrid } from '@/components/booking/SlotGrid'
import { CustomerForm } from '@/components/booking/CustomerForm'
import { HoldTimer } from '@/components/booking/HoldTimer'
import { Summary } from '@/components/booking/Summary'
import { useBookingFlow, useAvailability } from '@/hooks'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenant, useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { BOOKING_STEPS } from '@/config/constants'
import { errorKey } from '@/data/errors'

export default function Book() {
  const { t } = useLocale()
  const toast = useToast()
  const { reload } = useTenant()
  const bundle = useTenantBundle()
  const navigate = useNavigate()
  const { slug } = useParams()
  const [params] = useSearchParams()
  const flow = useBookingFlow()
  const [showFormErrors, setShowFormErrors] = useState(false)

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // deep link: /:slug/book?service=sv-cut
  useEffect(() => {
    const preset = params.get('service')
    if (preset && !flow.serviceId && bundle.services.some((s) => s.id === preset)) {
      flow.chooseService(preset)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const availability = useAvailability({
    slug: bundle.tenant.slug,
    serviceId: flow.serviceId,
    staffId: flow.staffId,
    day: flow.day,
    timeZone: bundle.tenant.timeZone,
    collapse: flow.staffId === null,
  })

  useEffect(() => {
    if (flow.step === 'done' && flow.result) {
      navigate(`/${slug}/confirm/${flow.result.code}`, { replace: true })
    }
  }, [flow.step, flow.result, navigate, slug])

  if (bundle.services.length === 0 || bundle.staff.length === 0) {
    return (
      <div className="wrap" style={{ padding: '40px 16px' }}>
        <EmptyState icon="✂" title={t('public.notReady')} body={t('public.notReadyBody')} />
      </div>
    )
  }

  const stepIndex = BOOKING_STEPS.indexOf(flow.step)
  const selectedStaff =
    bundle.staff.find((s) => s.id === (flow.slot?.staffId ?? flow.staffId)) ?? null

  const handleFormSubmit = async () => {
    setShowFormErrors(true)
    const res = await flow.attemptSubmit()
    if (res.ok) return

    if (res.reason === 'busy') return

    if (res.reason === 'expired') {
      toast.warn(t('book.holdExpiredPickAgain'))
      flow.setStep('time')
      return
    }
    if (res.reason === 'error') {
      toast.error(res.code ? t(errorKey(res.code)) : t('common.error'))
      return
    }
    toast.error(t('form.fixFields'))
    document.getElementById(res.reason === 'fullName' ? 'fullName' : res.reason)?.focus()
  }

  return (
    <div className="wrap booking">
      <ol className="steps" aria-label={t('nav.book')}>
        {BOOKING_STEPS.slice(0, 4).map((step, i) => (
          <li
            key={step}
            className="steps__item"
            data-state={i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'todo'}
          >
            <span className="steps__num">{i + 1}</span>
            <span className="steps__label">{t(`step.${step}`)}</span>
          </li>
        ))}
      </ol>

      <div className="booking__grid">
        <div className="booking__main">
          {flow.error && (
            <p className="alert alert--err" role="alert">
              {t(errorKey(flow.error))}
            </p>
          )}

          {flow.step === 'service' && (
            <section>
              <h1 className="section__title">{t('booking.chooseService')}</h1>
              <ServicePicker value={flow.serviceId} onPick={flow.chooseService} />
            </section>
          )}

          {flow.step === 'staff' && (
            <section>
              <h1 className="section__title">{t('booking.chooseStaff')}</h1>
              <StaffPicker
                staff={flow.eligibleStaff}
                value={flow.staffId}
                onPick={flow.chooseStaff}
                allowAny={bundle.settings.allowAnyStaff}
              />
            </section>
          )}

          {flow.step === 'time' && (
            <section>
              <h1 className="section__title">{t('booking.chooseTime')}</h1>
              <DayStrip
                value={flow.day}
                onPick={flow.chooseDay}
                timeZone={bundle.tenant.timeZone}
                counts={availability.countsByDay}
                closedDays={new Set()}
                days={bundle.settings.maxAdvanceDays ?? 14}
              />
              <SlotGrid
                periods={availability.periods}
                loading={availability.loading}
                selected={flow.slot}
                onPick={(slot) => void flow.chooseSlot(slot)}
                timeZone={bundle.tenant.timeZone}
                showStaffName={flow.staffId === null}
              />
            </section>
          )}

          {flow.step === 'details' && (
            <section>
              <h1 className="section__title">{t('booking.yourDetails')}</h1>

              {flow.hold.expired && (
                <div className="alert alert--err" style={{ marginBlockEnd: 16 }}>
                  <span>{t('book.holdExpiredPickAgain')}</span>
                  <button
                    type="button"
                    className="btn btn--sm btn--outline"
                    onClick={() => flow.setStep('time')}
                    style={{ marginInlineStart: 12 }}
                  >
                    {t('booking.chooseTime')}
                  </button>
                </div>
              )}

              {flow.hold.hold && (
                <HoldTimer
                  remainingMs={flow.hold.remainingMs}
                  totalMs={(bundle.settings.holdTtlMin ?? 10) * 60_000}
                  urgent={flow.hold.urgent}
                />
              )}
              <CustomerForm
                draft={flow.draft}
                onChange={flow.setDraft}
                errors={flow.fieldErrors}
                requireEmail={Boolean(bundle.settings.requireEmail)}
                showErrors={showFormErrors}
              />
              <div className="booking__actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <Button variant="outline" onClick={flow.back} disabled={Boolean(flow.submitting)}>
                    {t('action.back')}
                  </Button>
                  <Button
                    onClick={handleFormSubmit}
                    disabled={Boolean(flow.submitting)}
                    loading={flow.submitting}
                  >
                    {t('action.confirm')}
                  </Button>
                </div>

                {flow.blockingReason ? (
                  <p className="modal-form__hint" role="status" style={{ marginBlockStart: 8, textAlign: 'end' }}>
                    {t('form.stillNeeded')} {t('field.' + (flow.blockingReason === 'fullName' ? 'name' : flow.blockingReason))}
                  </p>
                ) : null}
              </div>
            </section>
          )}

          {flow.step !== 'details' && stepIndex > 0 && (
            <div className="booking__actions">
              <Button variant="outline" onClick={flow.back}>
                {t('action.back')}
              </Button>
            </div>
          )}
        </div>

        <Summary
          service={flow.service}
          staff={selectedStaff}
          slot={flow.slot}
          timeZone={bundle.tenant.timeZone}
          currency={bundle.tenant.currency}
        />
      </div>
    </div>
  )
}
