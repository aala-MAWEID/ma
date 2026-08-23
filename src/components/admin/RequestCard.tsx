import { useState } from 'react'
import { Button } from '@/components/ui'
import { useLocale } from '@/contexts/LocaleContext'
import { formatDateTime } from '@/lib/time'
import { formatMoney } from '@/lib/money'
import type { AgendaItem } from '@/types/domain'

/**
 * A pending request. It already occupies its slot in the database, so the
 * owner is deciding on a real reservation, not on a wish — which is exactly
 * why two customers can never both be approved for the same time.
 */
export function RequestCard({
  item,
  timeZone,
  currency,
  onDecide,
}: {
  item: AgendaItem
  timeZone: string
  currency: string
  onDecide: (id: string, decision: 'confirm' | 'decline') => Promise<boolean>
}) {
  const { t, locale } = useLocale()
  const [busy, setBusy] = useState<'confirm' | 'decline' | null>(null)

  const act = async (decision: 'confirm' | 'decline') => {
    setBusy(decision)
    await onDecide(item.id, decision)
    setBusy(null)
  }

  return (
    <article className="request">
      <div className="request__when">
        <strong>{formatDateTime(item.startsAt, timeZone, locale)}</strong>
        <span>
          {t('common.with')} {item.staffName}
        </span>
      </div>

      <div className="request__who">
        <strong>{item.customerName}</strong>
        <span dir="ltr">{item.customerPhone}</span>
      </div>

      <div className="request__what">
        <span>{item.serviceName}</span>
        <span>{formatMoney(item.priceCentimes, currency, locale)}</span>
      </div>

      {item.notesCustomer && <p className="request__note">“{item.notesCustomer}”</p>}

      <div className="request__actions">
        <Button size="sm" loading={busy === 'confirm'} onClick={() => void act('confirm')}>
          {t('action.approve')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={busy === 'decline'}
          onClick={() => void act('decline')}
        >
          {t('action.decline')}
        </Button>
      </div>
    </article>
  )
}
