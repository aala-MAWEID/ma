import { Link, useParams } from 'react-router-dom'
import { Spinner } from '@/components/ui'
import { StatusPill } from '@/components/shared/StatusPill'
import { TurnTracker } from '@/components/booking/TurnTracker'
import { data } from '@/data'
import { useAsync } from '@/hooks'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { formatDateTime } from '@/lib/time'
import { formatMoney } from '@/lib/money'
import { errorKey } from '@/data/errors'

import { PageHeader } from '@/components/shared/PageHeader'
export default function Confirm() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const { code, slug } = useParams()
  const state = useAsync(() => data.getBookingByCode(code ?? ''), [code], Boolean(code))

  if (state.loading) {
    return (
      <div className="page-center">
        <Spinner size={28} />
      </div>
    )
  }

  if (state.error || !state.value) {
    return (
      <div className="page-center">
        <p className="alert alert--err">{t(errorKey(state.error ?? 'booking_not_found'))}</p>
        <Link to={`/${slug ?? bundle.tenant.slug}`} className="btn btn--outline">
          {t('action.back')}
        </Link>
      </div>
    )
  }

  const booking = state.value
  const confirmed = booking.status === 'confirmed'
  const service = bundle.services.find((s) => s.id === booking.serviceId)
  const staff = bundle.staff.find((s) => s.id === booking.staffId)

  return (
    <>
      <PageHeader title={t('nav.myBookings')} description={bundle.tenant.name} hideBack={true} />
      <div className="wrap confirm">
        <div className="confirm__card">
        <div className={confirmed ? 'confirm__icon is-ok' : 'confirm__icon is-wait'}>
          {confirmed ? '✓' : '⚑'}
        </div>

        <h1 className="confirm__title">
          {t(confirmed ? 'booking.confirmedNow' : 'booking.awaitingApproval')}
        </h1>

        <StatusPill status={booking.status} />

        <TurnTracker code={booking.code} />

        <dl className="confirm__list">
          <div>
            <dt>{t('step.time')}</dt>
            <dd>{formatDateTime(booking.startsAt, locale)}</dd>
          </div>
          <div>
            <dt>{t('step.service')}</dt>
            <dd>{service?.name ?? t('common.empty')}</dd>
          </div>
          <div>
            <dt>{t('step.staff')}</dt>
            <dd>{staff?.displayName ?? t('common.empty')}</dd>
          </div>
          <div>
            <dt>{t('field.price')}</dt>
            <dd>{formatMoney(booking.priceCentimes, booking.currency, locale)}</dd>
          </div>
          <div>
            <dt>{t('common.code')}</dt>
            <dd>
              <code>{booking.code}</code>
            </dd>
          </div>
        </dl>

        <div className="confirm__actions">
          <Link to={`/${slug ?? bundle.tenant.slug}/me`} className="btn btn--outline">
            {t('nav.myBookings')}
          </Link>
          <Link to={`/${slug ?? bundle.tenant.slug}`} className="btn btn--primary">
            {t('action.home')}
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}
