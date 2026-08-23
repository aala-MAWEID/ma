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
  const { session, signInWithGoogle, signOut } = useAuth()
  const location = useLocation()
  const openNow = useOpenNow(bundle)
  
  // If we don't have a bundle yet, we can't render the header
  if (!bundle) return null

  const base = `/${bundle.tenant.slug}`
  const redirectTarget = window.location.origin + import.meta.env.BASE_URL + bundle.tenant.slug + '/admin'

  return (
    <header className="site-head">
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
            <>
              <Link to={`${base}/admin`} className="btn btn--outline btn--sm">
                اللوحة
              </Link>
              <button onClick={signOut} className="btn btn--ghost btn--sm">
                خروج
              </button>
            </>
          ) : (
            <GoogleButton 
              label="تسجيل الدخول" 
              onClick={() => signInWithGoogle(redirectTarget)} 
              small 
            />
          )}
        </div>
      </div>
    </header>
  )
}
