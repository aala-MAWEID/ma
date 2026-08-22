import { useLocale } from '@/context/LocaleContext'
import { cn } from '@/lib/cn'
import type { Staff, UUID } from '@/types/domain'

export function StaffPicker({
  staff,
  value,
  onPick,
  allowAny = true,
}: {
  staff: Staff[]
  value: UUID | null
  onPick: (id: UUID | null) => void
  allowAny?: boolean
}) {
  const { t } = useLocale()

  return (
    <div className="staff-list" role="radiogroup" aria-label={t('booking.chooseStaff')}>
      {allowAny && (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          className={cn('staff-card', value === null && 'is-selected')}
          onClick={() => onPick(null)}
        >
          <span className="staff-card__avatar staff-card__avatar--any" aria-hidden="true">
            ✦
          </span>
          <span className="staff-card__name">{t('booking.anyStaff')}</span>
          <span className="staff-card__role">{t('booking.tryAnotherDay')}</span>
        </button>
      )}

      {staff.map((person) => (
        <button
          key={person.id}
          type="button"
          role="radio"
          aria-checked={value === person.id}
          className={cn('staff-card', value === person.id && 'is-selected')}
          style={{ ['--card-accent' as string]: person.color }}
          onClick={() => onPick(person.id)}
        >
          {person.avatarUrl ? (
            <img src={person.avatarUrl} alt="" className="staff-card__avatar" />
          ) : (
            <span className="staff-card__avatar" aria-hidden="true">
              {person.displayName.slice(0, 1)}
            </span>
          )}
          <span className="staff-card__name">{person.displayName}</span>
          {person.title && <span className="staff-card__role">{person.title}</span>}
        </button>
      ))}
    </div>
  )
}
