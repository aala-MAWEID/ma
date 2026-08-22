import { STATUS_META } from '@/config/constants'
import { useLocale } from '@/context/LocaleContext'
import type { BookingStatus } from '@/types/domain'

export function StatusPill({ status }: { status: BookingStatus }) {
  const { t } = useLocale()
  const meta = STATUS_META[status]
  return (
    <span className="pill" style={{ ['--pill-color' as string]: meta.color }}>
      <span className="pill__dot" aria-hidden="true" />
      {t(meta.key)}
    </span>
  )
}
