import { useState } from 'react'
import { Button, EmptyState, Field, Input, Spinner } from '@/components/ui'
import { StatusPill } from '@/components/shared/StatusPill'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { formatDateTime } from '@/lib/time'
import { formatMoney } from '@/lib/money'
import { errorCodeOf, errorKey } from '@/data/errors'
import { normalizePhone } from '@/lib/validation'
import type { Booking } from '@/data/domain'

/**
 * No password. A Moroccan customer booking a haircut will not create an
 * account, and forcing one is how you lose the booking. The phone number they
 * already typed is the key; the booking code is the proof for any action that
 * changes something.
 */
export default function Me() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const toast = useToast()

  const [phone, setPhone] = useState('')
  const [items, setItems] = useState<Booking[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = async () => {
    const normalized = normalizePhone(phone)
    if (!normalized) {
      setError(t('error.invalid_phone'))
      return
    }
    setLoading(true)
    setError(null)
    try {
      setItems(await data.listBookingsByPhone(bundle.tenant.slug, normalized))
    } catch (e) {
      setError(t(errorKey(errorCodeOf(e))))
    } finally {
      setLoading(false)
    }
  }

  const cancel = async (item: Booking) => {
    try {
      await data.cancelBooking(item.code, null)
      toast(t('status.cancelled'), 'ok')
      await lookup()
    } catch (e) {
      toast(t(errorKey(errorCodeOf(e))), 'err')
    }
  }

  return (
    <div className="wrap account">
      <h1>{t('nav.myBookings')}</h1>
      <p className="account__lead">{t('booking.lookupHelp')}</p>

      <form
        className="account__lookup"
        onSubmit={(e) => {
          e.preventDefault()
          void lookup()
        }}
      >
        <Field label={t('field.phone')} error={error ?? undefined}>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            dir="ltr"
            placeholder="0612345678"
            required
          />
        </Field>
        <Button type="submit" loading={loading}>
          {t('action.search')}
        </Button>
      </form>

      {items && (
        <section className="account__results">
          {items.length === 0 ? (
            <EmptyState icon="⚑" title={t('booking.noBookingsFound')} />
          ) : (
            <ul className="account__list">
              {items.map((item) => {
                const srv = bundle.services.find((s) => s.id === item.serviceId)
                const st = bundle.staff.find((s) => s.id === item.staffId)
                const cancellable = ['pending', 'confirmed'].includes(item.status)

                return (
                  <li key={item.id} className="account-card">
                    <div className="account-card__head">
                      <div>
                        <h3>{srv?.name ?? t('common.empty')}</h3>
                        <p className="account-card__meta">
                          {formatDateTime(item.startsAt, locale)} · {st?.displayName}
                        </p>
                      </div>
                      <StatusPill status={item.status} />
                    </div>

                    <div className="account-card__foot">
                      <span className="account-card__price">
                        {formatMoney(item.priceCentimes, item.currency, locale)}
                      </span>
                      <span className="account-card__code">
                        {t('common.code')}: <code>{item.code}</code>
                      </span>
                      {cancellable && (
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => cancel(item)}
                        >
                          {t('action.cancel')}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
