import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { useDevice } from '@/hooks/useDevice'
import { useGuestFeed } from '@/hooks/useGuestFeed'
import { data } from '@/data'
import { clearDeviceToken, isIos, isStandalone } from '@/lib/device'
import { installAudioUnlock, osPermission, requestOsNotifications, unlockAudio } from '@/lib/notify'
import { formatRelative, formatTime } from '@/lib/time'
import { Button, Input } from '@/components/ui'

export function NotificationCenter() {
  const { t, locale } = useLocale()
  // useTenant().tenant THROWS while the bundle is loading, so read through bundle.
  const { bundle } = useTenant()
  const slug = bundle?.tenant.slug ?? ''
  const timeZone = bundle?.tenant.timeZone ?? 'Africa/Casablanca'
  const toast = useToast()

  const { token, visits, refresh } = useDevice(slug)
  const feed = useGuestFeed(slug, token, Boolean(slug && token))

  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [perm, setPerm] = useState<string>(() => osPermission())

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
                    {ticket.turn && typeof ticket.turn.ahead === 'number' && (
                      <p className="nc-ticket__turn">
                        {t('queue.aheadOnly', { count: String(ticket.turn.ahead) })}
                        {typeof ticket.turn.waitMin === 'number' && ticket.turn.waitMin > 0
                          ? ` · ${t('queue.etaMin', { min: String(ticket.turn.waitMin) })}`
                          : ''}
                      </p>
                    )}
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
                  <article
                    key={n.id}
                    className={`nc-item ${n.readAt ? '' : 'nc-item--unread'} ${n.urgent ? 'nc-item--urgent' : ''}`}
                  >
                    <div className="nc-item__row">
                      <strong>{n.title}</strong>
                      <time>{formatRelative(n.createdAt, locale)}</time>
                    </div>
                    {n.body && <p>{n.body}</p>}
                  </article>
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
