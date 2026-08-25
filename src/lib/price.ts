import type { TenantSettings, Service } from '@/types/domain'

export function priceVisible(
  settings: TenantSettings | null | undefined,
  service: Service | null | undefined,
): boolean {
  if (!service) return false
  return settings?.showPrices !== false && service.priceHidden !== true
}

export function formatPrice(centimes: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-MA' : 'ar-MA', {
    style: 'currency',
    currency,
  }).format(centimes / 100)
}
