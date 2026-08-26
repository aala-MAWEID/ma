import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { useDevice } from '@/hooks/useDevice'
import { useGuestFeed } from '@/hooks/useGuestFeed'
import { useLivePulse } from '@/hooks'
import { data } from '@/data'
import { clearDeviceToken, isIos, isStandalone } from '@/lib/device'
import { installAudioUnlock, osPermission, requestOsNotifications, unlockAudio } from '@/lib/notify'
import { formatRelative, formatTime } from '@/lib/time'
import { Button, Input, LiveNumber } from '@/components/ui'

const minutesUntil = (iso?: string | null): number | null => {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return null // guard: Invalid time value
  return Math.round((ms - Date.now()) / 60000)
}

export function NotificationCenter() {
  const navigate = useNavigate()
  const { t, locale } = useLocale()
  // useTenant().tenant THROWS while the bundle is loading, so read through bundle.
  const { bundle } = useTenant()
  const slug = bundle?.tenant.slug ?? ''
  const tenantId = bundle?.tenant.id ?? null
  const timeZone = bundle?.tenant.timeZone ?? 'Africa/Casablanca'
  const toast = useToast()

  const { token, visits, refresh } = useDevice(slug)
  const feed = useGuestFeed(slug, token, Boolean(slug && token))

  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [perm, setPerm] = useState<string>(() => osPermission())

  const { snap: pulseCounts } = useLivePulse(tenantId, () => data.queueCounts(slug, token), { enabled: open && !!slug })
  const counts = pulseCounts ? { waiting: pulseCounts.waiting ?? 0, serving: pulseCounts.serving ?? 0, myTicketNo: pulseCounts.myTicketNo ?? null } : null

  const goToQueue = (code?: string) => {
    setOpen(false)
    navigate(`/${slug}/queue${code ? `?code=${encodeURIComponent(code)}` : ''}`)
  }

  useEffect(() => {
    installAudioUnlock()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // t() is typed on TranslationKey, so status labels go through a switch.
  const statusLabel = (status: string): string => {
    switch (status) {
      case 'serving':
        return t('status.serving')
      case 'confirmed':
        return t('status.confirmed')
      case 'pending':
        return t('status.pending')
      case 'completed':
        return t('status.completed')
      case 'cancelled':
        return t('status.cancelled')
      default:
        return status
    }
  }

  const banner = useMemo(() => {
    if (feed.isMyTurn) return { urgent: true, title: t('notify.yourTurn'), body: t('notify.goToCounter') }
    if (typeof feed.ahead === 'number' && feed.ahead >= 0 && feed.ahead <= 1) {
      return { urgent: false, title: t('notify.almostYourTurn'), body: t('notify.stayClose') }
    }
    return null
  }, [feed.isMyTurn, feed.ahead, t])

  const openPanel = () => {
    unlockAudio() // this tap is our chance to enable sound on iOS
    setOpen(true)
    if (feed.unread > 0) void feed.markRead()
  }

  const onClaim = async () => {
    const clean = code.trim().toUpperCase()
    if (!clean || !token) return
    setBusy(true)
    try {
      await data.guestClaim(slug, token, clean)
      setCode('')
      await Promise.all([feed.reload(), refresh()])
      toast(t('notify.linked'), 'ok')
    } catch {
      toast(t('error.not_found'), 'err')
    } finally {
      setBusy(false)
    }
  }

  const onToggleSound = async () => {
    if (!token) return
    unlockAudio()
    try {
      await data.guestSetPrefs(slug, token, { sound: !feed.soundEnabled })
      await feed.reload()
    } catch {
      /* ignore */
    }
  }

  const onEnableOs = async () => {
    const result = await requestOsNotifications()
    setPerm(result)
    if (result === 'granted' && token) {
      try {
        await data.guestSetPrefs(slug, token, { push: true })
        await feed.reload()
      } catch {
        /* ignore */
      }
    }
  }

  const onForget = () => {
    clearDeviceToken(slug)
    setOpen(false)
    window.location.reload()
  }

  if (!slug) return null

  return (
    <>
      {banner && (
        <div
          className={`turn-banner ${banner.urgent ? 'turn-banner--urgent' : ''}`}
          role="status"
          aria-live="assertive"
        >
          <span className="turn-banner__dot" aria-hidden="true" />
          <div className="turn-banner__text">
            <strong>{banner.title}</strong>
            <span>{banner.body}</span>
          </div>
          {typeof feed.ahead === 'number' && !feed.isMyTurn && (
            <span className="turn-banner__count">
              {t('queue.aheadOnly', { count: String(feed.ahead) })}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        className="nc-bell"
        onClick={openPanel}
        aria-label={t('notify.bell')}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">🔔</span>
        {feed.unread > 0 && (
          <span className="nc-bell__badge">{feed.unread > 9 ? '9+' : feed.unread}</span>
        )}
      </button>

      {open && (
        <div className="nc-overlay" onClick={() => setOpen(false)} role="presentation">
          <section
            className="nc-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('notify.title')}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="nc-panel__head">
              <h2>{t('notify.title')}</h2>
              <button
                type="button"
                className="nc-panel__close"
                onClick={() => setOpen(false)}
                aria-label={t('notify.close')}
              >
                ✕
              </button>
            </header>

            {counts && (
              <button type="button" className="nc-counts" onClick={() => goToQueue()}>
                <span className="nc-counts__main">
                  {t('queue.waitingNow', { count: '###' })
                    .split('###')
                    .map((part, i) => (i === 1 ? <LiveNumber key={i} value={counts.waiting} /> : part))}
                </span>
                {counts.myTicketNo !== null && (
                  <span className="nc-counts__mine">
                    {t('queue.myPosition', { pos: '###' })
                      .split('###')
                      .map((part, i) => (i === 1 ? <LiveNumber key={i} value={counts.myTicketNo} /> : part))}
                  </span>
                )}
                <span className="nc-counts__cta">{t('queue.openLive')}</span>
              </button>
            )}

            {/* my active tickets — my own data only */}
            <div className="nc-tickets">
              {feed.tickets.length === 0 ? (
                <p className="nc-muted">{t('notify.noTicket')}</p>
              ) : (
                feed.tickets.map((ticket) => (
                  <article key={ticket.code} className="nc-ticket">
                    <div className="nc-ticket__top">
                      <span className="nc-ticket__code">{ticket.code}</span>
                      <span className={`nc-chip nc-chip--${ticket.status}`}>
                        {statusLabel(ticket.status)}
                      </span>
                    </div>
                    <p className="nc-ticket__meta">
                      {[
                        ticket.serviceName,
                        ticket.staffName,
                        ticket.startsAt ? formatTime(ticket.startsAt, timeZone, locale) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {(() => {
                      const mins = minutesUntil(ticket.startsAt)
                      if (ticket.status !== 'serving' && mins !== null && mins > 10) {
                        // later today -> show the reserved time, not the queue ETA
                        return <p className="nc-ticket__turn">{t('queue.startsInMin', { min: String(mins) })}</p>
                      }
                      if (ticket.turn && typeof ticket.turn.ahead === 'number') {
                        return (
                          <p className="nc-ticket__turn">
                            {t('queue.aheadOnly', { count: String(ticket.turn.ahead) })}
                            {typeof ticket.turn.waitMin === 'number' && ticket.turn.waitMin > 0
                              ? ` · ${t('queue.etaMin', { min: String(ticket.turn.waitMin) })}`
                              : ''}
                          </p>
                        )
                      }
                      return null
                    })()}
                  </article>
                ))
              )}
            </div>

            {/* link an existing code to this device */}
            <div className="nc-claim">
              <label className="nc-claim__label" htmlFor="nc-code">
                {t('notify.linkCode')}
              </label>
              <div className="nc-claim__row">
                <Input
                  id="nc-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t('notify.linkCodePlaceholder')}
                  autoComplete="off"
                />
                <Button onClick={() => void onClaim()} loading={busy} disabled={!code.trim()}>
                  {t('notify.linkCodeCta')}
                </Button>
              </div>
            </div>

            {/* messages */}
            <div className="nc-list">
              {feed.notifications.length === 0 ? (
                <p className="nc-muted">{t('notify.empty')}</p>
              ) : (
                feed.notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`nc-note nc-note--link${n.readAt ? '' : ' nc-note--unread'}`}
                    onClick={() => {
                      if (!n.readAt) void feed.markRead([n.id])
                      const targetCode = n.code ?? (typeof n.payload?.code === 'string' ? n.payload.code : undefined)
                      goToQueue(targetCode)
                    }}
                    aria-label={`${n.title} — ${t('queue.openLive')}`}
                  >
                    <span className="nc-note__body">
                      <span className="nc-note__title">{n.title}</span>
                      {n.body && <span className="nc-note__text">{n.body}</span>}
                      <span className="nc-note__time">{formatRelative(n.createdAt, locale)}</span>
                    </span>
                    <span className="nc-note__chev" aria-hidden="true">‹</span>
                  </button>
                ))
              )}
            </div>

            {/* settings */}
            <footer className="nc-foot">
              <button type="button" className="nc-toggle" onClick={() => void onToggleSound()}>
                {feed.soundEnabled ? t('notify.soundOn') : t('notify.soundOff')}
              </button>

              {perm === 'granted' ? (
                <span className="nc-muted">{t('notify.osOn')}</span>
              ) : isIos() && !isStandalone() ? (
                <span className="nc-muted">{t('notify.iosHint')}</span>
              ) : perm === 'denied' ? (
                <span className="nc-muted">{t('notify.osBlocked')}</span>
              ) : (
                <button type="button" className="nc-toggle" onClick={() => void onEnableOs()}>
                  {t('notify.enableOsAlerts')}
                </button>
              )}

              <span className="nc-muted">{t('notify.visits', { count: String(visits) })}</span>
              <button type="button" className="nc-toggle nc-toggle--danger" onClick={onForget}>
                {t('notify.forgetDevice')}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
