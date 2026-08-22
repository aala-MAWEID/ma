import { useLocale } from '@/context/LocaleContext'
import { formatCountdown } from '@/lib/time'
import { cn } from '@/lib/cn'

/**
 * The countdown is not decoration. It is the reason the customer fills the
 * form now instead of leaving the tab open for an hour, and it is the honest
 * explanation for why the slot may disappear.
 */
export function HoldTimer({
  remainingMs,
  totalMs,
  urgent,
}: {
  remainingMs: number
  totalMs: number
  urgent: boolean
}) {
  const { t } = useLocale()
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs))

  return (
    <div className={cn('hold-timer')} data-urgent={urgent ? 'true' : undefined} role="timer">
      <div className="hold-timer__row">
        <span className="hold-timer__label">{t('booking.holdActive')}</span>
        <span className="hold-timer__value">
          {t('booking.holdRemaining', { time: formatCountdown(remainingMs) })}
        </span>
      </div>
      <div className="hold-timer__bar">
        <div className="hold-timer__fill" style={{ inlineSize: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}
