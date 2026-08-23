import { Link, NavLink } from 'react-router-dom'
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

  const slug = bundle.tenant.slug
  const base = `/${slug}`
  const redirectTarget = window.location.origin + import.meta.env.BASE_URL + slug + '/admin'

  return (
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
            <strong>{bundle.tenant.name}</strong>
            <span className={cn('brand__state', openNow ? 'is-open' : 'is-closed')}>
              {t(openNow ? 'common.openNow' : 'common.closedNow')}
            </span>
          </span>
        </Link>

        <nav className="site-nav" aria-label={t('app.name')}>
          <NavLink to={`${base}/book`} className="site-nav__link">
            {t('nav.book')}
          </NavLink>
          <NavLink to={`${base}/queue`} className="site-nav__link">
            {t('nav.queue')}
          </NavLink>
          <NavLink to={`${base}/me`} className="site-nav__link">
            {t('nav.myBookings')}
          </NavLink>
        </nav>

        <div className="site-head__side">
          <select
            className="lang"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label="Language"
          >
            <option value="ar">العربية</option>
            <option value="fr">Français</option>
          </select>

          {session ? (
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
          )}
        </div>
      </div>
    </header>
  )
}
