import { useState, useEffect, type ComponentType } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import type { Session } from '@/data/domain'
import { cn } from '@/lib/cn'
import { 
  CalendarIcon, 
  RefreshIcon, 
  CloseIcon, 
  ChevronRightIcon, 
  ChevronLeftIcon,
  UserIcon
} from '@/components/ui/icons'

export interface AdminNavLinkItem {
  to: string
  key: string
  icon: ComponentType<{ size?: number; className?: string }>
  badge?: number
}

interface AdminSidebarProps {
  links: AdminNavLinkItem[]
  session: Session | null
  onSignOut: () => void
  slug: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

const COLLAPSED_STORAGE_KEY = 'maweid.nav.collapsed'

export function AdminSidebar({
  links,
  session,
  onSignOut,
  slug,
  isCollapsed: controlledCollapsed,
  onToggleCollapse: controlledToggle,
}: AdminSidebarProps) {
  const { t, dir } = useLocale()
  const navigate = useNavigate()
  const base = `/${slug}/admin`

  const [collapsedInternal, setCollapsedInternal] = useState(() => {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true'
  })

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : collapsedInternal

  const toggleCollapse = () => {
    if (controlledToggle) {
      controlledToggle()
    } else {
      const next = !collapsedInternal
      setCollapsedInternal(next)
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next))
      } catch {
        /* ignore */
      }
    }
  }

  useEffect(() => {
    if (controlledCollapsed === undefined) {
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsedInternal))
      } catch {
        /* ignore */
      }
    }
  }, [collapsedInternal, controlledCollapsed])

  return (
    <aside className="admin-sidebar desktop-only" aria-label={t('nav.admin')}>
      <div className="admin-sidebar__head">
        <Link to={`/${slug}/admin`} className="admin-sidebar__brand">
          <span className="admin-sidebar__mark" aria-hidden="true">⏱</span>
          <span>{session?.tenantName || t('app.name')}</span>
        </Link>
        <button
          type="button"
          className="btn-icon btn-icon--sm admin-sidebar__toggle"
          onClick={toggleCollapse}
          title={isCollapsed ? t('admin.expandSidebar') : t('admin.collapseSidebar')}
          aria-label={isCollapsed ? t('admin.expandSidebar') : t('admin.collapseSidebar')}
        >
          {dir === 'rtl' ? (
            isCollapsed ? <ChevronLeftIcon size={16} /> : <ChevronRightIcon size={16} />
          ) : (
            isCollapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />
          )}
        </button>
      </div>

      <ul className="admin-sidebar__nav">
        {links.map((link) => (
          <li key={link.to} className="admin-sidebar__item">
            <NavLink
              to={`${base}/${link.to}`}
              className={({ isActive }) =>
                cn('admin-sidebar__link', isActive && 'is-active')
              }
              title={isCollapsed ? t(link.key) : undefined}
            >
              <span className="admin-sidebar__icon" aria-hidden="true">
                <link.icon size={18} />
              </span>
              <span className="admin-sidebar__label">{t(link.key)}</span>
              {typeof link.badge === 'number' && link.badge > 0 && (
                <span className="admin-sidebar__badge">{link.badge}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="admin-sidebar__foot">
        <div className="admin-nav__user-info">
          <span className="admin-nav__user">{session?.displayName}</span>
          <span className="admin-nav__role">
            {session?.isShopOwner
              ? t('role.owner')
              : session?.role
              ? t(`role.${session.role}`)
              : ''}
          </span>
        </div>
        <button
          type="button"
          className="btn btn--quiet btn--sm"
          onClick={onSignOut}
          title={t('action.signOut')}
        >
          <UserIcon size={16} />
          {!isCollapsed && <span>{t('action.signOut')}</span>}
        </button>
      </div>
    </aside>
  )
}
