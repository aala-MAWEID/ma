import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { formatMoney } from '@/lib/money'
import type { Stats } from '@/data/domain'

export default function StatsPage() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    data
      .getStats(bundle.tenant.id)
      .then((res) => {
        if (alive) setStats(res)
      })
      .catch(console.error)
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [bundle.tenant.id])

  if (loading || !stats) {
    return (
      <div className="page-center">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{t('admin.stats')}</h1>
          <p className="admin-page__subtitle">{t('admin.statsSubtitle')}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat-card p-5 bg-surface border border-border rounded-xl shadow-sm">
          <span className="text-subtle text-sm font-medium">{t('admin.todayBookings')}</span>
          <div className="text-3xl font-extrabold mt-2 text-foreground">
            {stats.todayCount}
          </div>
        </div>

        <div className="stat-card p-5 bg-surface border border-border rounded-xl shadow-sm">
          <span className="text-subtle text-sm font-medium">{t('admin.pendingRequests')}</span>
          <div className="text-3xl font-extrabold mt-2 text-primary">
            {stats.pendingCount}
          </div>
        </div>

        <div className="stat-card p-5 bg-surface border border-border rounded-xl shadow-sm">
          <span className="text-subtle text-sm font-medium">{t('admin.weekRevenue')}</span>
          <div className="text-3xl font-extrabold mt-2 text-emerald-600">
            {formatMoney(stats.weekRevenueCentimes, bundle.tenant.currency, locale)}
          </div>
        </div>

        <div className="stat-card p-5 bg-surface border border-border rounded-xl shadow-sm">
          <span className="text-subtle text-sm font-medium">{t('admin.noShowRate')}</span>
          <div className="text-3xl font-extrabold mt-2 text-amber-600">
            {Math.round(stats.noShowRate * 100)}%
          </div>
        </div>
      </div>
    </section>
  )
}
