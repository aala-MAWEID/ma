import { useLocale } from '@/context/LocaleContext'
import { useTenantBundle } from '@/context/TenantContext'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'
import type { UUID } from '@/types/domain'

export function ServicePicker({
  value,
  onPick,
}: {
  value: UUID | null
  onPick: (id: UUID) => void
}) {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()

  return (
    <div className="service-list" role="radiogroup" aria-label={t('booking.chooseService')}>
      {bundle.services.map((service) => (
        <button
          key={service.id}
          type="button"
          role="radio"
          aria-checked={value === service.id}
          className={cn('service-card', value === service.id && 'is-selected')}
          style={{ ['--card-accent' as string]: service.color ?? 'var(--mw-brand)' }}
          onClick={() => onPick(service.id)}
        >
          <span className="service-card__main">
            <span className="service-card__name">{service.name}</span>
            {service.description && (
              <span className="service-card__desc">{service.description}</span>
            )}
          </span>
          <span className="service-card__meta">
            <span className="service-card__price">
              {formatMoney(service.priceCentimes, bundle.tenant.currency, locale)}
            </span>
            <span className="service-card__dur">
              {t('booking.minutes', { n: service.durationMin })}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
