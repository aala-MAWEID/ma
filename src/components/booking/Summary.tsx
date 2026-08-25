import { useLocale } from '@/contexts/LocaleContext'
import { formatDateTime } from '@/lib/time'
import { Price } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { priceVisible } from '@/lib/price'
import type { Service, Slot, Staff } from '@/types/domain'

export function Summary({
  service,
  staff,
  slot,
  timeZone,
  currency,
}: {
  service: Service | null
  staff: Staff | null
  slot: Slot | null
  timeZone: string
  currency: string
}) {
  const { t, locale } = useLocale()
  const { bundle } = useTenant()
  if (!service) return null

  const isVisible = priceVisible(bundle?.settings, service)

  return (
    <aside className="summary" aria-label={t('booking.summary')}>
      <h3 className="summary__title">{t('booking.summary')}</h3>

      <dl className="summary__list">
        <div>
          <dt>{t('step.service')}</dt>
          <dd>{service.name}</dd>
        </div>
        {staff && (
          <div>
            <dt>{t('step.staff')}</dt>
            <dd>{staff.displayName}</dd>
          </div>
        )}
        {slot && (
          <div>
            <dt>{t('step.time')}</dt>
            <dd>{formatDateTime(slot.start, timeZone, locale)}</dd>
          </div>
        )}
        <div>
          <dt>{t('booking.duration')}</dt>
          <dd>{t('booking.minutes', { n: service.durationMin })}</dd>
        </div>
      </dl>

      {isVisible && (
        <p className="summary__total">
          <span>{t('booking.total')}</span>
          <Price
            amountCentimes={service.priceCentimes}
            service={service}
            currency={currency}
          />
        </p>
      )}
    </aside>
  )
}
