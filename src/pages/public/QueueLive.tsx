import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Field, Input, Select, Spinner, Modal, LiveNumber } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenant, useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { formatMoney } from '@/lib/money'
import { normalizePhone } from '@/lib/validation'
import { errorCodeOf, errorKey } from '@/data/errors'
import { localDeviceToken } from '@/lib/device'
import { claimCode, useDevice } from '@/hooks/useDevice'
import { useGuestFeed } from '@/hooks/useGuestFeed'
import { useLivePulse } from '@/hooks'
import type { QueueCounts } from '@/data/guest'

const minutesUntil = (iso?: string | null): number | null => {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return null // guard: Invalid time value
  return Math.round((ms - Date.now()) / 60000)
}

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

  const [params] = useSearchParams()
  const focusCode = params.get('code')
  const ticketRef = useRef<HTMLDivElement | null>(null)

  const { snap: counts } = useLivePulse(bundle.tenant.id, () => data.queueCounts(slug, token))
  const loading = counts === null

  const [showJoinModal, setShowJoinModal] = useState(false)
  const [serviceId, setServiceId] = useState(bundle.services[0]?.id ?? '')
  const [staffId, setStaffId] = useState(bundle.staff[0]?.id ?? '')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    const myCode = counts?.myCode
    if (focusCode && myCode && focusCode === myCode && ticketRef.current) {
      ticketRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusCode, counts?.myCode])

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const normPhone = normalizePhone(phone)
    if (!fullName.trim()) {
      setJoinError(t('error.invalid_name'))
      return
    }

    setJoining(true)
    setJoinError(null)
    try {
      const b = await data.queueTake({
        slug: bundle.tenant.slug,
        serviceId,
        staffId: staffId || null,
        fullName: fullName.trim(),
        phone: normPhone || null,
        notes: notes.trim() || null,
        deviceToken: localDeviceToken(),
      })
      // Bind this ticket to the device so the turn alert works after a refresh.
      if (b.code) await claimCode(slug, b.code)

      setShowJoinModal(false)
      toast(t('queue.joinedSuccess'), 'ok')
      await guest.reload()
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
  const isShopOpen = counts?.shopOpen !== false
  const full =
    typeof counts?.maxSize === 'number' && counts.maxSize > 0 && waiting >= counts.maxSize

  return (
    <div className="wrap queue-live">
      {/* Closed Notice when shop switch is off */}
      {!isShopOpen && (
        <div
          style={{
            marginBlockEnd: 16,
            padding: 12,
            borderRadius: 14,
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>🔒</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#991b1b' }}>
              {t('admin.shopClosedNow')}
            </div>
            <div style={{ fontSize: 13, color: '#b91c1c', marginBlockStart: 2 }}>
              {t('admin.shopClosedHint')}
            </div>
          </div>
        </div>
      )}

      <div className="queue-live__header">
        <div>
          <h1 className="queue-live__title">{t('queue.title')}</h1>
          <p className="queue-live__subtitle">
            {t('queue.subtitle', { name: bundle.tenant.name })}
          </p>
        </div>
        {enabled && !myCode && (
          <Button
            onClick={() => {
              if (isShopOpen && !full) setShowJoinModal(true)
            }}
            variant="primary"
            disabled={!isShopOpen || full}
            style={!isShopOpen ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            {full ? t('queue.queueFull') : t('queue.joinNow')}
          </Button>
        )}
      </div>

      {!enabled && <div className="alert alert--warn">{t('queue.queueClosed')}</div>}

      {/* ---------- MY OWN TICKET (only my data) ---------- */}
      {myCode && (
        <div
          ref={ticketRef}
          className={`queue-my-ticket ${myStatus === 'serving' ? 'is-serving' : ''} ${focusCode && focusCode === myCode ? 'nc-focus' : ''}`}
        >
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
              ) : (() => {
                const mins = minutesUntil(myTicket?.startsAt)
                if (mins !== null && mins > 10) {
                  return (
                    <>
                      <LiveNumber className="num" value={typeof ahead === 'number' ? ahead : null} />
                      <span className="eta">{t('queue.startsInMin', { min: String(mins) })}</span>
                    </>
                  )
                }
                return (
                  <>
                    <LiveNumber className="num" value={typeof ahead === 'number' ? ahead : null} />
                    <span className="eta">
                      {typeof ahead === 'number' ? t('queue.aheadLabel') : ''}
                      {typeof waitMin === 'number' && waitMin > 0
                        ? (
                           <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                             {' · '}{t('queue.etaMin', { min: '' }).trim()} <LiveNumber value={waitMin} />
                           </span>
                          )
                        : ''}
                    </span>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ---------- COUNTERS ONLY — no list of people ---------- */}
      <div className="qcount-grid">
        <section className="qcount-card">
          <LiveNumber className="qcount-card__num" value={waiting} />
          <span className="qcount-card__label">{t('queue.peopleWaiting')}</span>
        </section>
        <section className="qcount-card qcount-card--serving">
          <LiveNumber className="qcount-card__num" value={serving} />
          <span className="qcount-card__label">{t('queue.beingServed')}</span>
        </section>
        <section className="qcount-card">
          <LiveNumber className="qcount-card__num" value={typeof avgMin === 'number' && avgMin > 0 ? avgMin : null} />
          <span className="qcount-card__label">{t('queue.avgService')}</span>
        </section>
        {typeof ahead === 'number' && myStatus !== 'serving' && (
          <section className="qcount-card qcount-card--mine">
            <LiveNumber className="qcount-card__num" value={ahead} />
            <span className="qcount-card__label">{t('queue.aheadOnly', { count: String(ahead) }).replace(String(ahead), '').trim()}</span>
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

          <Field label={t('field.phone')}>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              dir="ltr"
              placeholder="0612345678"
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
