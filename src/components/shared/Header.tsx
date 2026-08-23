import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useAuth } from '@/contexts/AuthContext'
import { useOpenNow } from '@/hooks'
import { cn } from '@/lib/cn'
import type { Locale } from '@/data/domain'
import { GoogleButton } from '@/components/shared/GoogleButton'

export function Header() {
  const { t, locale, setLocale } = useLocale()
  const bundle = useTenantBundle()
  const { session, signOut } = useAuth()
  const openNow = useOpenNow(bundle)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // إغلاق القائمة عند أي تنقل
  useEffect(() => setMenuOpen(false), [location.pathname])

  // منع تمرير الخلفية والقائمة مفتوحة
  useEffect(() => {
    document.body.classList.toggle('is-locked', menuOpen)
    return () => document.body.classList.remove('is-locked')
  }, [menuOpen])

  const slug = bundle.tenant.slug
  const base = `/${slug}`
  const redirectTarget = window.location.origin + import.meta.env.BASE_URL + slug + '/admin'

  const links = [
    { to: `${base}/book`, label: t('nav.book') },
    { to: `${base}/queue`, label: t('nav.queue') },
    { to: `${base}/me`, label: t('nav.myBookings') },
  ]

  const accountActionCompact = session ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Link to={`${base}/admin`} className="btn btn--outline btn--sm">
        {session.displayName ? session.displayName.split(' ')[0] : t('nav.admin')}
      </Link>
      <button type="button" onClick={() => void signOut()} className="btn btn--ghost btn--sm">
        {t('action.signOut')}
      </button>
    </div>
  ) : (
    <GoogleButton size="sm" redirectTo={redirectTarget} compact />
  )

  return (
    <>
      <header className="site-head" dir="rtl">
        <div className="wrap site-head__inner">
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

          {/* سطح المكتب فقط */}
          <nav className="site-nav" aria-label={t('nav.menu')}>
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className="site-nav__link">
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="site-head__side">
            <select
              className="lang"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label={t('nav.language')}
            >
              <option value="ar">العربية</option>
              <option value="fr">Français</option>
            </select>
            {accountActionCompact}
          </div>

          {/* الهاتف فقط */}
          <button
            type="button"
            className="burger"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t('nav.close') : t('nav.menu')}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="sheet-scrim" onClick={() => setMenuOpen(false)} role="presentation">
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.menu')}
            dir="rtl"
          >
            <div className="sheet__grip" aria-hidden="true" />
            <nav className="sheet__nav">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className="sheet__link" onClick={() => setMenuOpen(false)}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="sheet__foot">
              <div className="sheet__langs" role="group" aria-label={t('nav.language')}>
                <button
                  type="button"
                  className={'chip ' + (locale === 'ar' ? 'is-on' : '')}
                  onClick={() => setLocale('ar')}
                >
                  العربية
                </button>
                <button
                  type="button"
                  className={'chip ' + (locale === 'fr' ? 'is-on' : '')}
                  onClick={() => setLocale('fr')}
                >
                  Français
                </button>
              </div>
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
      ) : null}

      {/* شريط تنقل سفلي — هاتف فقط (يُخفى بالـ CSS على الحاسوب) */}
      <nav className="tabbar" aria-label={t('nav.menu')} dir="rtl">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className="tabbar__item">
            <span className="tabbar__label">{l.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
