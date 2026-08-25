import { PageHeader } from '@/components/shared/PageHeader'
import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookingDrawer } from '@/components/admin/BookingDrawer'
import { StatusPill } from '@/components/shared/StatusPill'
import { EmptyState, Spinner } from '@/components/ui'
import { data } from '@/data'
import { useAdminCalendar, useAsync, useIsDesktop } from '@/hooks'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { formatMoney } from '@/lib/money'
import { formatTime } from '@/lib/time'
import type { AgendaItem } from '@/types/domain'

export default function Today() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const cal = useAdminCalendar()
  const isDesktop = useIsDesktop()
  const stats = useAsync(() => data.getStats(bundle.tenant.id), [bundle.tenant.id])
  const [selected, setSelected] = useState<AgendaItem | null>(null)

  const activeServices = useMemo(() => bundle.services.filter(s => s.isActive).length, [bundle.services])
  const activeStaff = useMemo(() => bundle.staff.filter(s => s.isActive).length, [bundle.staff])
  const isOffline = activeServices === 0 || activeStaff === 0

  return (
    <section className="admin-page">
      <PageHeader title={t('admin.today')} />

      {isOffline && (
        <div className="alert alert--err mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="m-0 font-medium">{t('admin.offlineBanner')}</p>
          <Link to={activeServices === 0 ? '/admin/services' : '/admin/staff'} className="btn btn--primary btn--sm whitespace-nowrap">
            {t('admin.fixNow')}
          </Link>
        </div>
      )}

      {isDesktop ? (
        <div className="agenda-desktop">
          <div className="agenda-desktop__main" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="admin-grid">
              <div className="admin-grid--col-6">
                <Stat label={t('admin.statToday')} value={stats.value?.todayCount ?? '—'} />
              </div>
              <div className="admin-grid--col-6">
                <Stat
                  label={t('admin.statPending')}
                  value={stats.value?.pendingCount ?? '—'}
                  tone={stats.value?.pendingCount ? 'warn' : undefined}
                />
              </div>
              <div className="admin-grid--col-6">
                <Stat label={t('admin.statWeek')} value={stats.value?.weekCount ?? '—'} />
              </div>
              <div className="admin-grid--col-6">
                <Stat
                  label={t('admin.statRevenue')}
                  value={
                    stats.value
                      ? formatMoney(stats.value.weekRevenueCentimes, bundle.tenant.currency, locale)
                      : '—'
                  }
                />
              </div>
            </div>
            
            <h3 className="font-bold text-lg">{t('admin.todayBookings')}</h3>
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
          </div>
          <div className="agenda-desktop__rail">
            <h3 className="font-bold text-lg mb-4">{t('admin.calendar')}</h3>
            {/* Quick summary or placeholder for rail */}
            <div className="card p-4">
              <p className="text-sm opacity-80">{t('admin.scheduleSubtitle')}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
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
        </>
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
