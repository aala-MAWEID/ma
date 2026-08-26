import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useAuth } from '@/contexts/AuthContext'
import { useOpenNow } from '@/hooks'
import { cn } from '@/lib/cn'
import type { Locale } from '@/data/domain'
import { GoogleButton } from '@/components/shared/GoogleButton'
import { MenuIcon, CloseIcon, CalendarIcon, QueueIcon, ListIcon, ChevronIcon, UserIcon } from '@/components/ui/icons'
import { NotificationCenter } from '@/components/public/NotificationCenter'

export function Header() {
  const { t, locale, setLocale } = useLocale()
  const bundle = useTenantBundle()
  const { session, signOut } = useAuth()
  const openNow = useOpenNow(bundle)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMenuOpen(false), [location.pathname])

  useEffect(() => {
    document.body.classList.toggle('is-locked', menuOpen)
    return () => document.body.classList.remove('is-locked')
  }, [menuOpen])

  const slug = bundle.tenant.slug
  const base = `/${slug}`
  const redirectTarget = window.location.origin + import.meta.env.BASE_URL + slug + '/admin'

  const links = [
    { to: `${base}/book`, label: t('nav.book'), icon: CalendarIcon },
    { to: `${base}/queue`, label: t('nav.queue'), icon: QueueIcon },
    { to: `${base}/me`, label: t('nav.myBookings'), icon: ListIcon },
  ]

  const mobileAccountAction = session ? (
    <Link to={`${base}/admin`} className="btn-icon" aria-label={t('nav.account')}>
      {session.displayName ? (
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--mw-brand)', color: 'var(--mw-surface)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 'bold' }}>
          {session.displayName.charAt(0).toUpperCase()}
        </div>
      ) : (
        <UserIcon />
      )}
    </Link>
  ) : (
    <GoogleButton compact redirectTo={redirectTarget} />
  )

  const desktopAccountAction = session ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Link to={`${base}/admin`} className="btn btn--outline btn--sm">
        {session.displayName ? session.displayName.split(' ')[0] : t('nav.admin')}
      </Link>
      <button type="button" onClick={() => void signOut()} className="btn btn--ghost btn--sm">
        {t('action.signOut')}
      </button>
    </div>
  ) : (
    <GoogleButton size="sm" redirectTo={redirectTarget} />
  )

  return (
    <>
      <header className="site-head">
        <div className="wrap site-head__inner">
          <button
            type="button"
            className="burger"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t('nav.close') : t('nav.menu')}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MenuIcon />
          </button>

          <Link to={base} className="brand">
            {bundle.tenant.logoUrl ? (
              <img src={bundle.tenant.logoUrl} alt="" className="brand__logo" />
            ) : (
              <span className="brand__mark" aria-hidden="true">
                {bundle.tenant.name.slice(0, 1)}
              </span>
            )}
            <span className="brand__text">
              <span className="brand__name">{bundle.tenant.name}</span>
              <span className={cn('brand__state', openNow ? 'is-open' : 'is-closed')}>
                {t(openNow ? 'common.openNow' : 'common.closedNow')}
              </span>
            </span>
          </Link>

          <nav className="site-nav" aria-label={t('nav.menu')}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className="site-nav__link">
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="site-head__side">
            <NotificationCenter />
            <select
              className="lang"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label={t('nav.language')}
            >
              <option value="ar">العربية</option>
              <option value="fr">Français</option>
            </select>
            {desktopAccountAction}
          </div>

          <div className="site-head__mobile-auth">
            <NotificationCenter />
            <select
              className="lang"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label={t('nav.language')}
              style={{
                textTransform: 'uppercase',
                paddingInlineStart: 8,
                paddingInlineEnd: 8,
                height: 32,
                borderRadius: 16,
                background: 'var(--mw-surface-2)',
                border: '1px solid var(--mw-line)',
                fontWeight: 'bold',
                appearance: 'none',
                textAlign: 'center'
              }}
            >
              <option value="ar">AR</option>
              <option value="fr">FR</option>
            </select>
            {mobileAccountAction}
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="sheet-scrim" onClick={() => setMenuOpen(false)} role="presentation">
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.menu')}
          >
            <div className="sheet__grip" aria-hidden="true" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn-icon" aria-label={t('nav.close')} onClick={() => setMenuOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <nav className="sheet__nav">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className="sheet__link" onClick={() => setMenuOpen(false)}>
                  <l.icon style={{ marginInlineEnd: 12 }} />
                  <span style={{ flex: 1 }}>{l.label}</span>
                  <ChevronIcon />
                </NavLink>
              ))}
            </nav>
            <div className="sheet__foot">
              {session ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <Link to={`${base}/admin`} className="btn btn--outline" onClick={() => setMenuOpen(false)}>
                    {t('nav.admin')}
                  </Link>
                  <button type="button" onClick={() => void signOut()} className="btn btn--ghost">
                    {t('action.signOut')}
                  </button>
                </div>
              ) : (
                <GoogleButton redirectTo={redirectTarget} block />
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="tabbar" aria-label={t('nav.menu')}>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className="tabbar__item">
            <l.icon size={22} style={{ marginBottom: 4 }} />
            <span className="tabbar__label">{l.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}

