import { Link, NavLink } from 'react-router-dom'
import { useLocale } from '@/context/LocaleContext'
import { useTenant } from '@/context/TenantContext'
import { useOpenNow } from '@/hooks'
import { cn } from '@/lib/cn'
import type { Locale } from '@/types/domain'

export function Header() {
  const { t, locale, setLocale } = useLocale()
  const { bundle } = useTenant()
  const openNow = useOpenNow(bundle)
  if (!bundle) return null

  const base = `/${bundle.tenant.slug}`

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
          <Link to={`${base}/book`} className="btn btn--primary btn--sm">
            {t('action.book')}
          </Link>
        </div>
      </div>
    </header>
  )
}
