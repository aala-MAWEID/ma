import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Field, Input, Select, Spinner, Modal } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenant, useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { formatMoney } from '@/lib/money'
import { normalizePhone } from '@/lib/validation'
import { errorCodeOf, errorKey } from '@/data/errors'
import { claimCode, useDevice } from '@/hooks/useDevice'
import { useGuestFeed } from '@/hooks/useGuestFeed'
import type { QueueCounts } from '@/data/guest'

/**
 * PUBLIC QUEUE — privacy-first.
 *
 * This screen renders ONLY:
 *   - integers coming from public.queue_counts (waiting / serving / average minutes)
 *   - the visitor's OWN ticket (code, position, ETA), tied to their device token
 * It never receives another customer's name, phone, code or service.
 */
export default function QueueLive() {
  const { t, locale } = useLocale()
  const { reload } = useTenant()
  const bundle = useTenantBundle()
  const toast = useToast()

  const slug = bundle.tenant.slug
  const { token } = useDevice(slug)
  const guest = useGuestFeed(slug, token, Boolean(token))

  const [counts, setCounts] = useState<QueueCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const timer = useRef<number | null>(null)

  const [showJoinModal, setShowJoinModal] = useState(false)
  const [serviceId, setServiceId] = useState(bundle.services[0]?.id ?? '')
  const [staffId, setStaffId] = useState(bundle.staff[0]?.id ?? '')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const loadCounts = useCallback(async () => {
    try {
      const next = await data.queueCounts(slug, token)
      setCounts(next)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [slug, token])

  // Adaptive polling: 6s while I am waiting, 20s otherwise, paused when hidden.
  useEffect(() => {
    let stopped = false

    const tick = async () => {
      if (stopped) return
      await loadCounts()
      if (stopped) return
      const mine = counts?.myCode
      const ms = document.hidden ? 30_000 : mine ? 6_000 : 20_000
      timer.current = window.setTimeout(() => void tick(), ms)
    }
    void tick()

    const unsub = data.subscribeBookings(bundle.tenant.id, () => {
      void loadCounts()
    })
    const onVisible = () => {
      if (!document.hidden) void loadCounts()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopped = true
      if (timer.current) window.clearTimeout(timer.current)
      unsub()
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.tenant.id, loadCounts])

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const normPhone = normalizePhone(phone)
    if (!normPhone) {
      setJoinError(t('error.invalid_phone'))
      return
    }
    if (!fullName.trim()) {
      setJoinError(t('error.invalid_name'))
      return
    }

    setJoining(true)
    setJoinError(null)
    try {
      const b = await data.queueJoin(
        bundle.tenant.slug,
        serviceId,
        staffId || null,
        fullName.trim(),
        normPhone,
        notes.trim() || null,
      )
      // Bind this ticket to the device so the turn alert works after a refresh.
      const code = (b as unknown as { code?: string })?.code
      if (code) await claimCode(slug, code)

      setShowJoinModal(false)
      toast(t('queue.joinedSuccess'), 'ok')
      await Promise.all([loadCounts(), guest.reload()])
    } catch (err) {
      setJoinError(t(errorKey(errorCodeOf(err))))
    } finally {
      setJoining(false)
    }
  }

  if (loading && !counts) {
    return (
      <div className="page-center">
        <Spinner size={32} />
      </div>
    )
  }

  const enabled = counts?.enabled !== false
  const waiting = counts?.waiting ?? 0
  const serving = counts?.serving ?? 0
  const avgMin = counts?.avgMin ?? null
  const myCode = counts?.myCode ?? null
  const myStatus = counts?.myStatus ?? null
  const ahead = counts?.ahead
  const waitMin = counts?.waitMin
  const myTicket = guest.activeTicket // my own ticket only
  const full =
    typeof counts?.maxSize === 'number' && counts.maxSize > 0 && waiting >= counts.maxSize

  return (
    <div className="wrap queue-live">
      <div className="queue-live__header">
        <div>
          <h1 className="queue-live__title">{t('queue.title')}</h1>
          <p className="queue-live__subtitle">
            {t('queue.subtitle', { name: bundle.tenant.name })}
          </p>
        </div>
        {enabled && !myCode && (
          <Button onClick={() => setShowJoinModal(true)} variant="primary" disabled={full}>
            {full ? t('queue.queueFull') : t('queue.joinNow')}
          </Button>
        )}
      </div>

      {!enabled && <div className="alert alert--warn">{t('queue.queueClosed')}</div>}

      {/* ---------- MY OWN TICKET (only my data) ---------- */}
      {myCode && (
        <div className={`queue-my-ticket ${myStatus === 'serving' ? 'is-serving' : ''}`}>
          <div className="queue-my-ticket__badge">
            {myStatus === 'serving' ? t('status.serving') : t('queue.myTicket')}
          </div>
          <div className="queue-my-ticket__content">
            <div>
              <h3>
                {t('common.code')}: <code>{myCode}</code>
              </h3>
              {myTicket && (
                <p>
                  {[myTicket.serviceName, myTicket.staffName].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="queue-my-ticket__pos">
              {myStatus === 'serving' ? (
                <>
                  <span className="num">✓</span>
                  <span className="eta">{t('queue.inChair')}</span>
                </>
              ) : (
                <>
                  <span className="num">{typeof ahead === 'number' ? ahead : '—'}</span>
                  <span className="eta">
                    {typeof ahead === 'number' ? t('queue.aheadLabel') : ''}
                    {typeof waitMin === 'number' && waitMin > 0
                      ? ` · ${t('queue.etaMin', { min: String(waitMin) })}`
                      : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- COUNTERS ONLY — no list of people ---------- */}
      <div className="qcount-grid">
        <section className="qcount-card">
          <span className="qcount-card__num">{waiting}</span>
          <span className="qcount-card__label">{t('queue.peopleWaiting')}</span>
        </section>
        <section className="qcount-card qcount-card--serving">
          <span className="qcount-card__num">{serving}</span>
          <span className="qcount-card__label">{t('queue.beingServed')}</span>
        </section>
        <section className="qcount-card">
          <span className="qcount-card__num">
            {typeof avgMin === 'number' && avgMin > 0 ? avgMin : '—'}
          </span>
          <span className="qcount-card__label">{t('queue.avgService')}</span>
        </section>
        {typeof ahead === 'number' && myStatus !== 'serving' && (
          <section className="qcount-card qcount-card--mine">
            <span className="qcount-card__num">{ahead}</span>
            <span className="qcount-card__label">{t('queue.aheadOnly', { count: String(ahead) })}</span>
          </section>
        )}
      </div>

      {waiting === 0 && serving === 0 && enabled && (
        <div className="queue-empty">
          <p>{t('queue.chairFree')}</p>
        </div>
      )}

      <p className="qcount-privacy">{t('queue.privacyNote')}</p>
      <p className="qcount-hint">{t('queue.autoRefreshHint')}</p>

      <Modal open={showJoinModal} onClose={() => setShowJoinModal(false)} title={t('queue.joinTitle')}>
        <p className="modal-desc" style={{ marginBlockEnd: 16 }}>{t('queue.joinDesc')}</p>

        <form onSubmit={handleJoin} className="modal-form">
          {joinError && <div className="alert alert--err">{joinError}</div>}

          <Field label={t('field.name')} required>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('field.name')}
              required
            />
          </Field>

          <Field label={t('field.phone')} required>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              dir="ltr"
              placeholder="0612345678"
              required
            />
          </Field>

          <Field label={t('step.service')}>
            <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {bundle.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMin} {t('common.minutes')}
                  {bundle.settings.showPrices
                    ? ` - ${formatMoney(s.priceCentimes, bundle.tenant.currency, locale)}`
                    : ''}
                  )
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('step.staff')}>
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {bundle.staff.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.displayName} {st.title ? `(${st.title})` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('field.notes')}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="modal-actions">
            <Button type="submit" loading={joining} variant="primary">
              {t('queue.confirmJoin')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowJoinModal(false)}>
              {t('action.cancel')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
