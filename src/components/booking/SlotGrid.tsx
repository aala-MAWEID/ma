import { useLocale } from '@/context/LocaleContext'
import { Spinner, EmptyState } from '@/components/ui'
import { formatTime } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { Slot } from '@/types/domain'
import type { SlotPeriod } from '@/hooks/useAvailability'

export function SlotGrid({
  periods,
  loading,
  selected,
  onPick,
  timeZone,
  showStaffName,
  pendingStart,
}: {
  periods: SlotPeriod[]
  loading: boolean
  selected: Slot | null
  onPick: (slot: Slot) => void
  timeZone: string
  showStaffName?: boolean
  pendingStart?: Date | null
}) {
  const { t, locale } = useLocale()

  if (loading) {
    return (
      <div className="slot-grid__loading">
        <Spinner size={24} />
        <span>{t('common.loading')}</span>
      </div>
    )
  }

  if (periods.length === 0) {
    return <EmptyState icon="🕒" title={t('booking.noSlots')} hint={t('booking.tryAnotherDay')} />
  }

  return (
    <div className="slot-periods">
      {periods.map((period) => (
        <section key={period.key} className="slot-period">
          <h3 className="slot-period__title">{t(`period.${period.key}`)}</h3>
          <div className="slot-grid">
            {period.slots.map((slot) => {
              const key = `${slot.start.toISOString()}-${slot.staffId}`
              const isSelected = selected?.start.getTime() === slot.start.getTime()
              const isPending = pendingStart?.getTime() === slot.start.getTime()
              return (
                <button
                  key={key}
                  type="button"
                  className={cn('slot', isSelected && 'is-selected')}
                  aria-pressed={isSelected}
                  disabled={isPending}
                  onClick={() => onPick(slot)}
                >
                  <span className="slot__time">{formatTime(slot.start, timeZone, locale)}</span>
                  {showStaffName && slot.staffName && (
                    <span className="slot__staff">{slot.staffName}</span>
                  )}
                  {isPending && <Spinner size={14} />}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
