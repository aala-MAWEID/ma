/**
 * Format money stored in integer centimes to localized currency strings.
 * Never use floating point for currency calculations.
 * 12000 centimes = 120,00 MAD -> 120,00 د.م. in ar-MA
 */
export function formatMoney(
  centimes: number,
  currency: string = 'MAD',
  locale: string = 'ar',
): string {
  const amount = centimes / 100
  if (locale === 'ar') {
    return `${amount.toFixed(2).replace('.', ',')} د.م.`
  }
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}
