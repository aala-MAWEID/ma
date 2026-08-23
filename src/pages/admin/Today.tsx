import { useState } from 'react'
import { BookingDrawer } from '@/components/admin/BookingDrawer'
import { StatusPill } from '@/components/shared/StatusPill'
import { EmptyState, Spinner } from '@/components/ui'
import { data } from '@/data'
import { useAdminCalendar, useAsync } from '@/hooks'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { formatMoney } from '@/lib/money'
import { formatTime } from '@/lib/time'
import type { AgendaItem } from '@/types/domain'

export default function Today() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const cal = useAdminCalendar()
  const stats = useAsync(() => data.getStats(bundle.tenant.id), [bundle.tenant.id])
  const [selected, setSelected] = useState<AgendaItem | null>(null)

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <h1>{t('admin.today')}</h1>
      </header>

      <div className="stats">
        <Stat label={t('admin.statToday')} value={stats.value?.todayCount ?? '—'} />
        <Stat
          label={t('admin.statPending')}
          value={stats.value?.pendingCount ?? '—'}
          tone={stats.value?.pendingCount ? 'warn' : undefined}
        />
        <Stat label={t('admin.statWeek')} value={stats.value?.weekCount ?? '—'} />
        <Stat
          label={t('admin.statRevenue')}
          value={
            stats.value
              ? formatMoney(stats.value.weekRevenueCentimes, bundle.tenant.currency, locale)
              : '—'
          }
        />
      </div>

      {cal.loading ? (
        <Spinner size={24} />
      ) : cal.items.length === 0 ? (
        <EmptyState icon="☀️" title={t('common.empty')} />
      ) : (
        <ul className="agenda">
          {cal.items.map((item) => (
            <li key={item.id}>
              <button className="agenda__row" onClick={() => setSelected(item)}>
                <span className="agenda__time">
                  {formatTime(item.startsAt, cal.timeZone, locale)}
                </span>
                <span className="agenda__body">
                  <strong>{item.customerName}</strong>
                  <span>
                    {item.serviceName} · {item.staffName}
                  </span>
                </span>
                <StatusPill status={item.status} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <BookingDrawer
        item={selected}
        timeZone={cal.timeZone}
        currency={bundle.tenant.currency}
        onClose={() => setSelected(null)}
        onDecide={cal.decide}
      />
    </section>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: 'warn'
}) {
  return (
    <div className="stat" data-tone={tone}>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}
