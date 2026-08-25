import { PageHeader } from '@/components/shared/PageHeader'
import { useCallback, useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { Button, EmptyState, Field, Input, Spinner } from '@/components/ui'
import { data } from '@/data'
import type { DayScheduleRow } from '@/data/adapter'
import { formatMoney } from '@/lib/money'

function todayISO() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function Schedule() {
  const bundle = useTenantBundle()
  const { t, locale } = useLocale()
  const toast = useToast()
  const tenantId = bundle.tenant.id
  const currency = bundle.tenant.currency ?? 'MAD'

  const [day, setDay] = useState(todayISO())
  const [rows, setRows] = useState<DayScheduleRow[] | null>(null)
  const [busy, setBusy] = useState(false)

  const activeServices = useMemo(() => bundle.services.filter(s => s.isActive).length, [bundle.services])
  const activeStaff = useMemo(() => bundle.staff.filter(s => s.isActive).length, [bundle.staff])
  const isOffline = activeServices === 0 || activeStaff === 0

  const load = useCallback(async () => {
    setRows(await data.getDaySchedule(tenantId, day))
  }, [tenantId, day])

  useEffect(() => {
    setRows(null)
    load().catch((e) => {
      console.error('[maweid] getDaySchedule failed', e)
      setRows([])
    })
  }, [load])

  function time(iso: string) {
    return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-MA' : 'ar-MA', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: bundle.tenant.timeZone ?? 'Africa/Casablanca',
    }).format(new Date(iso))
  }

  async function cancel(r: DayScheduleRow) {
    if (!window.confirm(t('admin.confirmCancelBooking'))) return
    setBusy(true)
    try {
      await data.adminCancelBooking(tenantId, r.id, t('admin.cancelledByShop'))
      await load()
      toast.success(t('admin.cancelled'))
    } catch (e) {
      toast.error(t('error.unknown'))
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  async function drop(r: DayScheduleRow) {
    if (!window.confirm(t('admin.confirmDeleteBooking'))) return
    setBusy(true)
    try {
      await data.adminDeleteBooking(tenantId, r.id)
      await load()
      toast.success(t('common.deleted'))
    } catch (e) {
      toast.error(t('error.unknown'))
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-page" dir="rtl">
      <PageHeader title={t('admin.schedule')} description={t('admin.scheduleSubtitle')} />

      {isOffline && (
        <div className="alert alert--err mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="m-0 font-medium">{t('admin.offlineBanner')}</p>
          <Link to={activeServices === 0 ? '/admin/services' : '/admin/staff'} className="btn btn--primary btn--sm whitespace-nowrap">
            {t('admin.fixNow')}
          </Link>
        </div>
      )}

      {!rows ? (
        <div className="page-center">
          <Spinner size={28} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon="🗓" title={t('admin.noBookingsToday')} body={t('admin.noBookingsTodayBody')} />
      ) : (
        <ol style={{ display: 'grid', gap: 10, listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((r) => (
            <li
              key={r.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: 12,
                border: '1px solid rgba(0,0,0,.1)',
                borderRadius: 12,
                background: r.status === 'pending' ? 'rgba(217,119,6,.06)' : '#fff',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: r.staffColor ?? '#4B5563',
                  color: '#fff',
                  fontWeight: 700,
                  flex: '0 0 auto',
                }}
              >
                {r.position}
              </span>
              <div style={{ minWidth: 96 }}>
                <strong dir="ltr">{time(r.startsAt)}</strong>
                <div style={{ fontSize: 12, opacity: 0.7 }} dir="ltr">
                  {time(r.endsAt)}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{r.customerName ?? t('common.walkIn')}</strong>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {r.serviceName} · {r.staffName} · {formatMoney(r.priceCentimes ?? 0, r.currency ?? currency)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.65 }} dir="ltr">
                  {r.code}
                  {r.customerPhone ? ` · ${r.customerPhone}` : ''}
                  {typeof r.gapBeforeMin === 'number' && r.gapBeforeMin > 0
                    ? ` · ${t('admin.gap')} ${r.gapBeforeMin}′`
                    : ''}
                </div>
              </div>
              <span className="badge badge--neutral">{t(`status.${r.status}`)}</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Button size="sm" variant="quiet" disabled={busy} onClick={() => cancel(r)}>
                  {t('admin.cancel')}
                </Button>
                <Button size="sm" variant="quiet" disabled={busy} onClick={() => drop(r)}>
                  {t('common.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
