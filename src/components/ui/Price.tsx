import { useTenant } from '@/contexts/TenantContext'
import { useLocale } from '@/contexts/LocaleContext'
import { priceVisible, formatPrice } from '@/lib/price'
import { cn } from '@/lib/cn'
import type { Service } from '@/types/domain'

export interface PriceProps {
  amountCentimes: number
  service?: Service | null
  from?: boolean
  hidden?: boolean
  adminBadge?: boolean
  currency?: string
  className?: string
}

export function Price({
  amountCentimes,
  service,
  from = false,
  hidden,
  adminBadge = false,
  currency = 'MAD',
  className,
}: PriceProps) {
  const { bundle } = useTenant()
  const { locale, t } = useLocale()

  const isVisible = service
    ? priceVisible(bundle?.settings, service)
    : (bundle?.settings?.showPrices !== false && hidden !== true)

  // Public context: if hidden globally or for this specific service, render nothing - not "—", not "0"
  if (!isVisible && !adminBadge) {
    return null
  }

  const formatted = formatPrice(amountCentimes, currency, locale)
  const text = from ? `${t('common.from')} ${formatted}` : formatted

  return (
    <span className={cn('price-tag tabular-nums', className)}>
      <span>{text}</span>
      {!isVisible && adminBadge && (
        <span className="badge-price-hidden" title={t('admin.priceHiddenBadge')}>
          {t('admin.priceHiddenBadge')}
        </span>
      )}
    </span>
  )
}
