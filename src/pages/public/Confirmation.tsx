import { Link, useParams } from 'react-router-dom'
import { Header } from '@/components/shared/Header'
import { Footer } from '@/components/shared/Footer'
import { Button, Spinner } from '@/components/ui'
import { StatusPill } from '@/components/shared/StatusPill'
import { data } from '@/data'
import { useAsync } from '@/hooks'
import { useLocale } from '@/context/LocaleContext'
import { useTenantBundle } from '@/context/TenantContext'
import { formatDateTime } from '@/lib/time'
import { formatMoney } from '@/lib/money'
import { errorKey } from '@/data/errors'

export default function Confirmation() {
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
        <Link to={`/${slug}`} className="btn btn--outline">
          {t('action.back')}
        </Link>
      </div>
    )
  }

  const booking = state.value
  const confirmed = booking.status === 'confirmed'

  return (
    <>
      <Header />

      <main className="wrap confirm">
        <div className="confirm__card">
          <div className={confirmed ? 'confirm__icon is-ok' : 'confirm__icon is-wait'}>
            {confirmed ? '✓' : '⚑'}
          </div>

          <h1 className="confirm__title">
            {t(confirmed ? 'booking.confirmedNow' : 'booking.awaitingApproval')}
          </h1>

          <StatusPill status={booking.status} />

          <dl className="confirm__list">
            <div>
              <dt>{t('step.time')}</dt>
              <dd>{formatDateTime(booking.startsAt, bundle.tenant.timeZone, locale)}</dd>
            </div>
            <div>
              <dt>{t('step.service')}</dt>
              <dd>{booking.serviceName}</dd>
            </div>
            <div>
              <dt>{t('step.staff')}</dt>
              <dd>{booking.staffName}</dd>
            </div>
            <div>
              <dt>{t('booking.total')}</dt>
              <dd>{formatMoney(booking.priceCentimes, bundle.tenant.currency, locale)}</dd>
            </div>
          </dl>

          <div className="confirm__code">
            <span>{t('booking.yourCode')}</span>
            <strong dir="ltr">{booking.code}</strong>
            <small>{t('booking.saveCode')}</small>
          </div>

          <div className="confirm__actions">
            <Link to={`/${slug}/me`} className="btn btn--primary">
              {t('nav.myBookings')}
            </Link>
            <Button
              variant="outline"
              onClick={() => void navigator.clipboard?.writeText(booking.code)}
            >
              {booking.code}
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
