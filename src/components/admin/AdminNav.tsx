import { NavLink, useParams } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

export function AdminNav({
  pendingCount = 0,
  queueCount = 0,
}: {
  pendingCount?: number
  queueCount?: number
}) {
  const { t } = useLocale()
  const { signOut, session } = useAuth()
  const perms = usePermissions()
  const { slug } = useParams()
  const base = `/${slug}/admin`

  const links = [
    { to: 'agenda', key: 'admin.calendar', icon: '📅' },
    { to: 'queue', key: 'admin.queue', icon: '⏱', badge: queueCount },
    { to: 'requests', key: 'admin.requests', icon: '⚑', badge: pendingCount },
    { to: 'customers', key: 'admin.customers', icon: '👥' },
    ...(perms.edit_staff ? [{ to: 'staff', key: 'admin.staff', icon: '✂️' }] : []),
    ...(perms.edit_services ? [{ to: 'services', key: 'admin.services', icon: '🏷️' }] : []),
    ...(perms.isOwner ? [{ to: 'identity', key: 'admin.identity', icon: '🏢' }] : []),
    ...(perms.edit_settings ? [{ to: 'settings', key: 'admin.settings', icon: '⚙️' }] : []),
    { to: 'stats', key: 'admin.stats', icon: '📊' },
    { to: 'profile', key: 'admin.profile', icon: '👤' },
  ]

  return (
    <nav className="admin-nav" aria-label={t('nav.admin')}>
      <div className="admin-nav__brand">
        <span className="admin-nav__mark" aria-hidden="true">
          ⏱
        </span>
        <span>{session?.tenantName || t('app.name')}</span>
      </div>

      <ul className="admin-nav__list">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={`${base}/${link.to}`}
              className={({ isActive }) => cn('admin-nav__link', isActive && 'is-active')}
            >
              <span className="admin-nav__icon" aria-hidden="true">
                {link.icon}
              </span>
              <span>{t(link.key)}</span>
              {typeof link.badge === 'number' && link.badge > 0 && (
                <span className="admin-nav__count">{link.badge}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="admin-nav__foot">
        <div className="admin-nav__user-info">
          <span className="admin-nav__user">{session?.displayName}</span>
          <span className="admin-nav__role">
            {session?.isShopOwner ? t('role.owner') : session?.role ? t(`role.${session.role}`) : ''}
          </span>
        </div>
        <Button variant="quiet" size="sm" onClick={() => void signOut()}>
          {t('action.signOut')}
        </Button>
      </div>
    </nav>
  )
}
