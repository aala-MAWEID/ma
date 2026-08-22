import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Header } from '@/components/shared/Header'
import { Button } from '@/components/ui'
import { ServicePicker } from '@/components/booking/ServicePicker'
import { StaffPicker } from '@/components/booking/StaffPicker'
import { DayStrip } from '@/components/booking/DayStrip'
import { SlotGrid } from '@/components/booking/SlotGrid'
import { CustomerForm } from '@/components/booking/CustomerForm'
import { HoldTimer } from '@/components/booking/HoldTimer'
import { Summary } from '@/components/booking/Summary'
import { useBookingFlow, useAvailability } from '@/hooks'
import { useLocale } from '@/context/LocaleContext'
import { useTenantBundle } from '@/context/TenantContext'
import { BOOKING_STEPS } from '@/config/constants'
import { errorKey } from '@/data/errors'
import { cn } from '@/lib/cn'

/**
 * The whole customer journey in one page with five states. A multi-page wizard
 * would lose the hold on every navigation and make the back button dangerous;
 * one page keeps the state machine honest.
 */
export default function Book() {
  const { t } = useLocale()
  const bundle = useTenantBundle()
  const navigate = useNavigate()
  const { slug } = useParams()
  const [params] = useSearchParams()
  const flow = useBookingFlow()

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

  const stepIndex = BOOKING_STEPS.indexOf(flow.step)
  const selectedStaff =
    bundle.staff.find((s) => s.id === (flow.slot?.staffId ?? flow.staffId)) ?? null

  return (
    <>
      <Header />

      <main className="wrap booking">
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
                  closedDays={new Set(bundle.closedDates.map((c) => c.day))}
                />
                <SlotGrid
                  periods={availability.periods}
                  loading={availability.loading}
                  selected={flow.slot}
                  onPick={(slot) => void flow.chooseSlot(slot)}
                  timeZone={bundle.tenant.timeZone}
                  showStaffName={flow.staffId === null}
                  pendingStart={flow.hold.pending ? flow.slot?.start : null}
                />
              </section>
            )}

            {flow.step === 'details' && (
              <section>
                <h1 className="section__title">{t('booking.yourDetails')}</h1>

                {flow.hold.hold && (
                  <HoldTimer
                    remainingMs={flow.hold.remainingMs}
                    totalMs={(bundle.settings.holdTtlMin ?? 10) * 60_000}
                    urgent={flow.hold.urgent}
                  />
                )}

                <CustomerForm
                  draft={flow.draft}
                  errors={flow.fieldErrors}
                  onChange={flow.setDraft}
                  requireEmail={bundle.settings.requireEmail ?? false}
                  showErrors
                />

                <div className="booking__actions">
                  <Button variant="outline" onClick={flow.back}>
                    {t('action.back')}
                  </Button>
                  <Button
                    onClick={() => void flow.submit()}
                    disabled={!flow.canSubmit}
                    loading={flow.submitting}
                  >
                    {t('action.confirm')}
                  </Button>
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

          <div className={cn('booking__aside', flow.serviceId && 'is-visible')}>
            <Summary
              service={flow.service}
              staff={selectedStaff}
              slot={flow.slot}
              timeZone={bundle.tenant.timeZone}
              currency={bundle.tenant.currency}
            />
          </div>
        </div>
      </main>
    </>
  )
}
