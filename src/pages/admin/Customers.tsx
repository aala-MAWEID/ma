import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, EmptyState, Field, Input, Modal, Spinner, Textarea, LiveNumber } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { useLivePulse } from '@/hooks'
import { formatDateOnly, formatDateTime, formatRelative } from '@/lib/time'
import { formatMoney } from '@/lib/money'
import { telLink, waLink } from '@/lib/url'
import { downloadCsv, toCsv } from '@/lib/csv'
import type { AdminCustomerDetail, AdminCustomerRow, AdminCustomerStats } from '@/data/guest'

const PAGE_SIZE = 50

export default function Customers() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const toast = useToast()
  const tenantId = bundle.tenant.id
  const timeZone = bundle.tenant.timeZone
  const currency = bundle.tenant.currency

  const [rows, setRows] = useState<AdminCustomerRow[]>([])
  const [total, setTotal] = useState(0)
  const [orphans, setOrphans] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AdminCustomerStats | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const [notifyFor, setNotifyFor] = useState<{ bookingId: string; code: string } | null>(null)
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyBody, setNotifyBody] = useState('')
  const [notifyBusy, setNotifyBusy] = useState(false)

  const { snap: pulse } = useLivePulse(tenantId, () => data.adminPulse(tenantId))

  // debounce the search box (server-side search)
  useEffect(() => {
    const id = window.setTimeout(() => {
      setTerm(search.trim())
      setOffset(0)
    }, 350)
    return () => window.clearTimeout(id)
  }, [search])

  // t() and toast() are intentionally NOT dependencies: their identity can
  // change on every render, and load() is used as an effect dependency.
  const tRef = useRef(t)
  tRef.current = t
  const toastRef = useRef(toast)
  toastRef.current = toast
  const failedRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    const attempt = `${tenantId}|${term}|${offset}`
    setLoading(true)
    try {
      const page = await data.adminCustomers(tenantId, {
        search: term || null,
        limit: PAGE_SIZE,
        offset,
      })
      setRows(page.rows ?? [])
      setTotal(page.total ?? 0)
      setOrphans(page.orphanBookings ?? 0)
      setLoadError(null)
      failedRef.current = null
    } catch (err) {
      console.error('[maweid] adminCustomers', err)
      const detail =
        err && typeof err === 'object'
          ? String(
              (err as { code?: unknown }).code ??
                (err as { message?: unknown }).message ??
                err,
            )
          : String(err)
      setLoadError(detail)
      setRows([])
      // one toast per distinct failing request, never once per render
      if (failedRef.current !== attempt) {
        failedRef.current = attempt
        toastRef.current(tRef.current('error.unknown'), 'err')
      }
    } finally {
      setLoading(false)
    }
  }, [tenantId, term, offset])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let alive = true
    data
      .adminCustomerStats(tenantId)
      .then((s) => alive && setStats(s))
      .catch((err) => console.error(err))
    return () => {
      alive = false
    }
  }, [tenantId])

  const openDetail = async (customerId: string) => {
    setDetailBusy(true)
    try {
      setDetail(await data.adminCustomerDetail(tenantId, customerId))
    } catch (err) {
      console.error(err)
      toast(t('error.unknown'), 'err')
    } finally {
      setDetailBusy(false)
    }
  }

  const toggleBlock = async (row: AdminCustomerRow) => {
    const next = !row.isBlocked
    const reason = next ? window.prompt(t('admin.blockReason')) : null
    if (next && reason === null) return
    try {
      await data.adminBlockCustomer(tenantId, row.id, next, reason)
      await load()
      if (detail?.customer.id === row.id) await openDetail(row.id)
    } catch (err) {
      console.error(err)
      toast(t('error.unknown'), 'err')
    }
  }

  const sendNotify = async () => {
    if (!notifyFor || !notifyTitle.trim()) return
    setNotifyBusy(true)
    try {
      const res = await data.adminNotifyCustomer(
        tenantId,
        notifyFor.bookingId,
        notifyTitle.trim(),
        notifyBody.trim() || null,
        true,
      )
      toast(res.reachable ? t('admin.notifySent') : t('admin.notifyUnreachable'), res.reachable ? 'ok' : 'err')
      setNotifyFor(null)
      setNotifyTitle('')
      setNotifyBody('')
    } catch (err) {
      console.error(err)
      toast(t('error.unknown'), 'err')
    } finally {
      setNotifyBusy(false)
    }
  }

  const exportCsv = () => {
    downloadCsv(
      `maweid-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(rows, [
        { key: 'fullName', label: t('field.fullName') },
        { key: 'phone', label: t('field.phone') },
        { key: 'totalBookings', label: t('admin.bookingsCount') },
        { key: 'completedCount', label: t('status.completed') },
        { key: 'noShowCount', label: t('admin.noShowCount') },
        { key: 'devices', label: t('admin.devices') },
        { key: 'spent', label: t('admin.spent'), map: (r) => (r.spentCentimes ?? 0) / 100 },
        { key: 'lastVisitAt', label: t('admin.lastVisit'), map: (r) => r.lastVisitAt ?? '' },
        { key: 'isBlocked', label: t('status.blocked'), map: (r) => (r.isBlocked ? '1' : '0') },
      ]),
    )
  }

  const kpis = useMemo(
    () => [
      { label: t('admin.kpiCustomers'), value: stats?.customers ?? 0 },
      { label: t('admin.kpiKnownDevices'), value: stats?.knownDevices ?? 0 },
      { label: t('admin.kpiRepeat'), value: stats?.repeatCustomers ?? 0 },
      { label: t('admin.kpiWaiting'), value: pulse?.waiting ?? stats?.queueWaiting ?? 0 },
      { label: t('admin.kpiUnread'), value: pulse?.unread ?? stats?.unreadNotifications ?? 0 },
      { label: t('admin.kpiBlocked'), value: stats?.blocked ?? 0 },
    ],
    [stats, pulse, t],
  )

  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)

  return (
    <div className="cust-page">
      <header className="cust-head">
        <div>
          <h1>{t('admin.customers')}</h1>
          <p>{t('admin.customersSubtitle')}</p>
        </div>
        <div className="cust-head__actions">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.searchCustomers')}
            aria-label={t('admin.searchCustomers')}
          />
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            {t('admin.exportCsv')}
          </Button>
        </div>
      </header>

      <section className="cust-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="cust-kpi">
            <LiveNumber className="cust-kpi__num" value={k.value} />
            <span className="cust-kpi__label">{k.label}</span>
          </div>
        ))}
      </section>

      {orphans > 0 && (
        <p className="cust-note">{t('admin.orphanBookings', { count: String(orphans) })}</p>
      )}

      {loadError && !loading && (
        <div className="alert alert--err" role="alert">
          <div>{t('error.unknown')}</div>
          <div className="alert__detail" dir="ltr">{loadError}</div>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
            {t('common.refresh')}
          </Button>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <div className="page-center">
          <Spinner size={28} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('admin.noCustomersFound')}
          body={term ? t('common.tryAnotherSearch') : undefined}
        />
      ) : (
        <>
          <div className="cust-table-wrap">
            <table className="cust-table">
              <thead>
                <tr>
                  <th>{t('field.fullName')}</th>
                  <th>{t('field.phone')}</th>
                  <th>{t('admin.bookingsCount')}</th>
                  <th>{t('admin.noShowCount')}</th>
                  <th>{t('admin.devices')}</th>
                  <th>{t('admin.spent')}</th>
                  <th>{t('admin.lastVisit')}</th>
                  <th>{t('admin.registeredAt')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={c.isBlocked ? 'is-blocked' : ''}>
                    <td>
                      <button type="button" className="cust-link" onClick={() => void openDetail(c.id)}>
                        {c.fullName || '—'}
                      </button>
                      {c.isBlocked && <span className="cust-badge">{t('status.blocked')}</span>}
                      {c.isKnownDevice && <span className="cust-dot" title={t('admin.devices')} />}
                    </td>
                    <td dir="ltr">{c.phone || '—'}</td>
                    <td>{c.totalBookings}</td>
                    <td>{c.noShowCount}</td>
                    <td>{c.devices}</td>
                    <td>{formatMoney(c.spentCentimes ?? 0, currency, locale)}</td>
                    <td>{c.lastVisitAt ? formatRelative(c.lastVisitAt, locale) : '—'}</td>
                    <td>{formatDateOnly(c.createdAt, timeZone, locale)}</td>
                    <td className="cust-actions">
                      {c.phone && (
                        <>
                          <a className="cust-icon" href={telLink(c.phone)} aria-label={t('action.call')}>
                            📞
                          </a>
                          <a
                            className="cust-icon"
                            href={waLink(c.phone)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t('action.whatsapp')}
                          >
                            💬
                          </a>
                        </>
                      )}
                      <button type="button" className="cust-icon" onClick={() => void toggleBlock(c)}>
                        {c.isBlocked ? t('admin.unblock') : t('admin.block')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cust-pager">
            <Button
              variant="outline"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {t('admin.prevPage')}
            </Button>
            <span>{t('admin.showingRange', { from: String(from), to: String(to), total: String(total) })}</span>
            <Button
              variant="outline"
              disabled={to >= total || loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {t('admin.nextPage')}
            </Button>
          </div>
        </>
      )}

      {/* ---------------- detail drawer ---------------- */}
      <Modal
        open={Boolean(detail) || detailBusy}
        onClose={() => setDetail(null)}
        title={t('admin.customerDetail')}
      >
        {detailBusy && !detail ? (
          <div className="page-center">
            <Spinner size={24} />
          </div>
        ) : detail ? (
          <div className="cust-detail">
            <div className="cust-detail__head">
              <h3>{detail.customer.fullName || '—'}</h3>
              <span dir="ltr">{detail.customer.phone || '—'}</span>
              {detail.customer.isBlocked && (
                <span className="cust-badge">
                  {t('status.blocked')}
                  {detail.customer.blockedReason ? ` · ${detail.customer.blockedReason}` : ''}
                </span>
              )}
            </div>

            <h4>{t('admin.devices')}</h4>
            {detail.devices.length === 0 ? (
              <p className="cust-muted">{t('admin.noDevices')}</p>
            ) : (
              <ul className="cust-list">
                {detail.devices.map((d) => (
                  <li key={d.deviceToken}>
                    <strong>{d.platform || '—'}</strong>
                    <span>
                      {t('admin.visitsCount', { count: String(d.visits) })} ·{' '}
                      {t('admin.lastSeen')}: {formatRelative(d.lastSeenAt, locale)}
                    </span>
                    <code className="cust-token">{d.deviceToken.slice(0, 8)}</code>
                  </li>
                ))}
              </ul>
            )}

            <h4>{t('admin.history')}</h4>
            {detail.bookings.length === 0 ? (
              <p className="cust-muted">{t('admin.noBookings')}</p>
            ) : (
              <ul className="cust-list">
                {detail.bookings.map((b) => (
                  <li key={b.id}>
                    <strong>{b.code}</strong>
                    <span>
                      {[b.serviceName, b.staffName].filter(Boolean).join(' · ')} —{' '}
                      {formatDateTime(b.startsAt, timeZone, locale)}
                    </span>
                    <span className="cust-muted">{b.status}</span>
                    {(b.status === 'confirmed' || b.status === 'pending' || b.status === 'serving') && (
                      <button
                        type="button"
                        className="cust-icon"
                        onClick={() => {
                          setNotifyFor({ bookingId: b.id, code: b.code })
                          setNotifyTitle(t('notify.yourTurn'))
                          setNotifyBody(t('notify.goToCounter'))
                        }}
                      >
                        {t('admin.notifyCustomer')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <h4>{t('admin.messages')}</h4>
            {detail.notifications.length === 0 ? (
              <p className="cust-muted">{t('admin.noNotifications')}</p>
            ) : (
              <ul className="cust-list">
                {detail.notifications.map((n) => (
                  <li key={n.id}>
                    <strong>{n.title}</strong>
                    <span>{n.body || ''}</span>
                    <span className="cust-muted">
                      {formatRelative(n.createdAt, locale)} {n.readAt ? '✓' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Modal>

      {/* ---------------- manual notification ---------------- */}
      <Modal open={Boolean(notifyFor)} onClose={() => setNotifyFor(null)} title={t('admin.notifyCustomer')}>
        <p className="cust-muted">{t('admin.notifyActiveOnly')}</p>
        <Field label={t('admin.notifyTitle')} required>
          <Input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} />
        </Field>
        <Field label={t('admin.notifyBody')}>
          <Textarea value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} rows={3} />
        </Field>
        <div className="modal-actions">
          <Button variant="primary" loading={notifyBusy} onClick={() => void sendNotify()}>
            {t('admin.notifyCustomer')}
          </Button>
          <Button variant="outline" onClick={() => setNotifyFor(null)}>
            {t('action.cancel')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
