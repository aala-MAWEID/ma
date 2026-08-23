import { useTurnStatus } from '@/hooks/useTurnStatus'
import { useLocale } from '@/contexts/LocaleContext'

export function TurnTracker({ code }: { code: string }) {
  const { t } = useLocale()
  const { turn, loading } = useTurnStatus(code)

  if (loading && !turn) {
    return <div className="turn-tracker turn-tracker--loading">{t('common.loading')}</div>
  }
  if (!turn || !turn.found) return null

  const isServing = turn.status === 'serving'
  const isDone = ['completed', 'cancelled', 'declined', 'no_show'].includes(turn.status ?? '')
  if (isDone) return null

  const ahead = turn.ahead ?? 0
  const wait = turn.waitMin ?? ahead * (turn.avgMin ?? 20)
  const isUrgent = isServing || ahead === 0 || ahead <= 2

  return (
    <aside
      className={`turn-tracker ${isUrgent ? 'turn-tracker--urgent' : ''}`}
      aria-live="polite"
      role="status"
    >
      <header className="turn-tracker__head">
        <span className="turn-tracker__dot" aria-hidden="true" />
        <strong className="turn-tracker__title">
          {isServing
            ? t('queue.yourTurnNow')
            : ahead === 0
              ? t('queue.nextInLine')
              : t('queue.liveTurn')}
        </strong>
      </header>

      <div className="turn-tracker__body">
        <div className="turn-tracker__metric">
          <span className="turn-tracker__num">{ahead}</span>
          <span className="turn-tracker__lbl">{t('queue.peopleAhead')}</span>
        </div>

        {wait > 0 ? (
          <div className="turn-tracker__metric">
            <span className="turn-tracker__num">~{wait}</span>
            <span className="turn-tracker__lbl">{t('queue.minutesLeft')}</span>
          </div>
        ) : null}
      </div>

      <p className="turn-tracker__hint">
        {isServing
          ? t('queue.proceedToCounter')
          : ahead <= 2
            ? t('queue.stayClose')
            : t('queue.autoRefreshHint')}
      </p>
    </aside>
  )
}
