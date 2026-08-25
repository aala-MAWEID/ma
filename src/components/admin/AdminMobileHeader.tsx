import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import type { Session } from '@/data/domain'
import { cn } from '@/lib/cn'
import { 
  CalendarIcon, 
  MenuIcon, 
  CloseIcon, 
  RefreshIcon, 
  UserIcon 
} from '@/components/ui/icons'
import type { AdminNavLinkItem } from './AdminSidebar'

interface AdminMobileHeaderProps {
  links: AdminNavLinkItem[]
  session: Session | null
  slug: string
  onSignOut: () => void
}

export function AdminMobileHeader({
  links,
  session,
  slug,
  onSignOut,
}: AdminMobileHeaderProps) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const base = `/${slug}/admin`

  return (
    <>
      {/* رأس اللوحة على الهاتف */}
      <header className="admin-head-mobile">
        <button
          type="button"
          className="btn-icon"
          onClick={() => setMenuOpen(true)}
          aria-label={t('nav.menu')}
        >
          <MenuIcon />
        </button>
        <span className="admin-head-mobile__title">
          {session?.tenantName || t('app.name')}
        </span>
        <div className="admin-head-mobile__actions">
          <button
            type="button"
            className="btn-icon"
            onClick={() => window.location.reload()}
            title={t('admin.refreshData')}
            aria-label={t('admin.refreshData')}
          >
            <RefreshIcon />
          </button>
          <Link
            to={`/${slug}`}
            className="btn-icon"
            title={t('admin.previewPublic')}
            aria-label={t('admin.previewPublic')}
          >
            <CalendarIcon />
          </Link>
          <button
            type="button"
            className="btn-icon"
            onClick={onSignOut}
            title={t('action.signOut')}
            aria-label={t('action.signOut')}
          >
            <UserIcon />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => navigate(`/${slug}`)}
            title={t('admin.closePanel')}
            aria-label={t('admin.closePanel')}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      {/* درج اللوحة (Drawer) على الهاتف */}
      {menuOpen && (
        <div
          className="sheet-scrim"
          onClick={() => setMenuOpen(false)}
          role="presentation"
        >
          <div
            className="sheet sheet--drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="sheet__head">
              <span className="sheet__title">{session?.tenantName}</span>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setMenuOpen(false)}
                aria-label={t('action.close')}
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="sheet__nav">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={`${base}/${link.to}`}
                  className={({ isActive }) => cn('sheet__link', isActive && 'active')}
                  onClick={() => setMenuOpen(false)}
                >
                  <link.icon className="sheet__icon" />
                  <span className="sheet__label">{t(link.key)}</span>
                  {typeof link.badge === 'number' && link.badge > 0 && (
                    <span className="badge">{link.badge}</span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
