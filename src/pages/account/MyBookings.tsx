import { useState } from 'react'
import { Header } from '@/components/shared/Header'
import { Button, EmptyState, Field, Input, Spinner } from '@/components/ui'
import { StatusPill } from '@/components/shared/StatusPill'
import { data } from '@/data'
import { useLocale } from '@/context/LocaleContext'
import { useTenantBundle } from '@/context/TenantContext'
import { useToast } from '@/hooks'
import { formatDateTime } from '@/lib/time'
import { formatMoney } from '@/lib/money'
import { errorCodeOf, errorKey } from '@/data/errors'
import { normalizePhone } from '@/lib/validation'
import type { AgendaItem } from '@/types/domain'

/**
 * No password. A Moroccan customer booking a haircut will not create an
 * account, and forcing one is how you lose the booking. The phone number they
 * already typed is the key; the booking code is the proof for any action that
 * changes something.
 */
export default function MyBookings() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const toast = useToast()

  const [phone, setPhone] = useState('')
  const [items, setItems] = useState<AgendaItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = async () => {
    const normalized = normalizePhone(phone)
    if (!normalized) {
      setError(t('error.invalidPhone'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      setItems(await data.listBookingsByPhone(bundle.tenant.id, normalized))
    } catch (e) {
      setError(t(errorKey(errorCodeOf(e))))
    } finally {
      setLoading(false)
    }
  }

  const cancel = async (item: AgendaItem) => {
    try {
      await data.cancelBooking(item.id, item.code)
      toast.push(t('status.cancelled'), 'ok')
      await lookup()
    } catch (e) {
      toast.push(t(errorKey(errorCodeOf(e))), 'err')
    }
  }

  return (
    <>
      <Header />

      <main className="wrap account">
        <h1 className="section__title">{t('nav.myBookings')}</h1>

        <div className="account__lookup">
          <Field label={t('field.phone')} error={error ?? undefined}>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              dir="ltr"
              inputMode="tel"
              placeholder="06 12 80 69 32"
              onKeyDown={(e) => e.key === 'Enter' && void lookup()}
            />
          </Field>
          <Button onClick={() => void lookup()} loading={loading}>
            {t('nav.myBookings')}
          </Button>
        </div>

        {loading && <Spinner size={24} />}

        {items && items.length === 0 && (
          <EmptyState icon="🗓" title={t('common.empty')} />
        )}

        {items && items.length > 0 && (
          <ul className="account__list">
            {items.map((item) => {
              const upcoming =
                item.startsAt.getTime() > Date.now() &&
                (item.status === 'confirmed' || item.status === 'pending')
              return (
                <li key={item.id} className="account__row">
                  <div>
                    <strong>{formatDateTime(item.startsAt, bundle.tenant.timeZone, locale)}</strong>
                    <span>
                      {item.serviceName} · {t('common.with')} {item.staffName}
                    </span>
                  </div>
                  <div className="account__meta">
                    <StatusPill status={item.status} />
                    <span>{formatMoney(item.priceCentimes, bundle.tenant.currency, locale)}</span>
                  </div>
                  {upcoming && bundle.settings.allowCustomerCancel && (
                    <Button variant="quiet" size="sm" onClick={() => void cancel(item)}>
                      {t('action.cancel')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
