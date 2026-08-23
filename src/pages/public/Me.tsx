import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { GoogleButton } from '@/components/shared/GoogleButton'
import { useAuth } from '@/contexts/AuthContext'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { Button, EmptyState, Field, Input, Spinner } from '@/components/ui'
import { data } from '@/data'
import type { MyBookingRow, AgendaItem } from '@/data/adapter'
import { formatMoney } from '@/lib/money'

export default function Me() {
  const { slug = '' } = useParams<{ slug: string }>()
  const bundle = useTenantBundle()
  const { session } = useAuth()
  const { t, locale } = useLocale()
  const toast = useToast()

  const [rows, setRows] = useState<MyBookingRow[] | null>(null)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  const loadMine = useCallback(async () => {
    if (!session) {
      setRows(null)
      return
    }
    setRows(await data.myBookings(slug))
  }, [session, slug])

  useEffect(() => {
    loadMine().catch((e) => {
      console.error('[maweid] myBookings failed', e)
      setRows([])
    })
  }, [loadMine])

  function fmt(iso: string) {
    return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-MA' : 'ar-MA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: bundle.tenant.timeZone ?? 'Africa/Casablanca',
    }).format(new Date(iso))
  }

  async function byPhone() {
    if (!phone.trim()) return
    setBusy(true)
    try {
      const found = (await data.listBookingsByPhone(bundle.tenant.id, phone.trim())) as unknown as AgendaItem[]
      const mapped: MyBookingRow[] = found.map((f) => ({
        id: f.id,
        code: f.code,
        status: f.status,
        mode: f.mode ?? 'appointment',
        startsAt: f.startsAt instanceof Date ? f.startsAt.toISOString() : String(f.startsAt),
        endsAt: f.endsAt instanceof Date ? f.endsAt.toISOString() : String(f.endsAt),
        serviceName: f.serviceName,
        staffName: f.staffName,
        staffColor: f.staffColor ?? null,
        priceCentimes: f.priceCentimes,
        currency: f.currency,
        tenantSlug: bundle.tenant.slug,
        tenantName: bundle.tenant.name,
        canCancel: true,
      }))
      setRows(mapped)
    } catch (e) {
      toast.error(t('error.unknown'))
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  async function cancel(code: string) {
    if (!window.confirm(t('public.confirmCancel'))) return
    setBusy(true)
    try {
      if (session) await data.cancelMyBooking(code, t('public.cancelledByCustomer'))
      else await data.cancelByCode(code, t('public.cancelledByCustomer'))
      toast.success(t('public.cancelled'))
      if (session) await loadMine()
      else await byPhone()
    } catch (e) {
      const code2 = (e as { code?: string })?.code
      toast.error(
        code2 === 'cutoff_passed'
          ? t('error.cutoff_passed')
          : code2 === 'already_closed'
            ? t('error.already_closed')
            : t('error.unknown'),
      )
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-page" dir="rtl">
      <header className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{t('nav.myBookings')}</h1>
          <p className="admin-page__subtitle">{t('public.myBookingsSubtitle')}</p>
        </div>
      </header>

      {!session ? (
        <div style={{ display: 'grid', gap: 16, justifyItems: 'start' }}>
          <GoogleButton label={t('public.signInToSeeBookings')} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
            <Field label={t('public.orByPhone')}>
              <Input
                dir="ltr"
                inputMode="tel"
                value={phone}
                placeholder="+212XXXXXXXXX"
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Button variant="outline" loading={busy} onClick={byPhone}>
              {t('common.search')}
            </Button>
          </div>
        </div>
      ) : null}

      {rows === null ? (
        session ? (
          <div className="page-center">
            <Spinner size={28} />
          </div>
        ) : null
      ) : rows.length === 0 ? (
        <EmptyState icon="🗓" title={t('public.noBookings')} body={t('public.noBookingsBody')} />
      ) : (
        <ul style={{ display: 'grid', gap: 10, listStyle: 'none', padding: 0, marginTop: 16 }}>
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
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  alignSelf: 'stretch',
                  borderRadius: 6,
                  background: r.staffColor ?? '#4B5563',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{fmt(r.startsAt)}</strong>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {r.serviceName} · {r.staffName} ·{' '}
                  {formatMoney(r.priceCentimes ?? 0, r.currency ?? 'MAD')}
                </div>
                <div style={{ fontSize: 12, opacity: 0.65 }} dir="ltr">
                  {r.code}
                </div>
              </div>
              <span className="badge badge--neutral">{t(`status.${r.status}`)}</span>
              {r.canCancel ? (
                <Button size="sm" variant="quiet" disabled={busy} onClick={() => cancel(r.code)}>
                  {t('public.cancel')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
