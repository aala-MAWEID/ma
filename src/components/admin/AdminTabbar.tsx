import { NavLink } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import { cn } from '@/lib/cn'
import type { AdminNavLinkItem } from './AdminSidebar'

interface AdminTabbarProps {
  links: AdminNavLinkItem[]
  base: string
}

export function AdminTabbar({ links, base }: AdminTabbarProps) {
  const { t } = useLocale()

  return (
    <nav className="admin-tabbar" aria-label={t('nav.admin')}>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={`${base}/${link.to}`}
          className={({ isActive }) =>
            cn('admin-tabbar__item', isActive && 'active')
          }
        >
          <div className="admin-tabbar__icon-wrap">
            <link.icon className="admin-tabbar__icon" />
            {typeof link.badge === 'number' && link.badge > 0 && (
              <span className="admin-tabbar__badge">{link.badge}</span>
            )}
          </div>
          <span className="admin-tabbar__label">{t(link.key)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
