import { useState } from 'react'
import { NavLink, useParams, Link, useNavigate } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/cn'
import { 
  CalendarIcon, ClockIcon, QueueIcon, BellIcon, UserIcon, 
  EditIcon, ListIcon, MenuIcon, CloseIcon, RefreshIcon 
} from '@/components/ui/icons'

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
  const params = useParams<{ slug: string }>()
  const slug = params.slug || ''
  const base = `/${slug}/admin`
  const navigate = useNavigate()
  
  const [menuOpen, setMenuOpen] = useState(false)

  const links = [
    { to: 'agenda', key: 'admin.calendar', icon: CalendarIcon },
    { to: 'schedule', key: 'admin.schedule', icon: ClockIcon },
    ...(perms.edit_settings ? [{ to: 'hours', key: 'admin.hours', icon: ClockIcon }] : []),
    { to: 'queue', key: 'admin.queue', icon: QueueIcon, badge: queueCount },
    { to: 'requests', key: 'admin.requests', icon: BellIcon, badge: pendingCount },
    { to: 'customers', key: 'admin.customers', icon: UserIcon },
    ...(perms.edit_staff ? [{ to: 'staff', key: 'admin.staff', icon: EditIcon }] : []),
    ...(perms.edit_services ? [{ to: 'services', key: 'admin.services', icon: ListIcon }] : []),
    ...(perms.isOwner ? [{ to: 'identity', key: 'admin.identity', icon: EditIcon }] : []),
    ...(perms.edit_settings ? [{ to: 'settings', key: 'admin.settings', icon: EditIcon }] : []),
    { to: 'stats', key: 'admin.stats', icon: ListIcon },
    { to: 'profile', key: 'admin.profile', icon: UserIcon },
  ]

  const topMobileLinks = [
    { to: 'agenda', key: 'admin.calendar', icon: CalendarIcon },
    { to: 'requests', key: 'admin.requests', icon: BellIcon, badge: pendingCount },
    { to: 'queue', key: 'admin.queue', icon: QueueIcon, badge: queueCount },
    { to: 'schedule', key: 'admin.schedule', icon: ClockIcon },
  ]

  const handleSignOut = () => {
    if (window.confirm(t('action.confirmSignOut') || 'هل أنت متأكد من تسجيل الخروج؟')) {
      void signOut()
    }
  }

  return (
    <>
      {/* رأس اللوحة على الهاتف */}
      <header className="admin-head-mobile">
        <button className="btn-icon" onClick={() => setMenuOpen(true)} aria-label={t('nav.menu')}>
          <MenuIcon />
        </button>
        <span className="admin-head-mobile__title">{session?.tenantName || t('app.name')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-icon" onClick={() => window.location.reload()} aria-label="تحديث البيانات">
            <RefreshIcon />
          </button>
          <Link to={`/${slug}`} className="btn-icon" aria-label="معاينة الموقع العام">
            <CalendarIcon />
          </Link>
          <button className="btn-icon" onClick={handleSignOut} aria-label="خروج من الحساب">
            <UserIcon />
          </button>
          <button className="btn-icon" onClick={() => navigate(`/${slug}`)} aria-label="إغلاق اللوحة">
            <CloseIcon />
          </button>
        </div>
      </header>

      {/* درج اللوحة (Drawer) على الهاتف */}
      {menuOpen && (
        <div className="sheet-scrim" onClick={() => setMenuOpen(false)} role="presentation">
          <div className="sheet sheet--drawer" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="sheet__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--mw-line)' }}>
              <span style={{ fontWeight: 'bold' }}>{session?.tenantName}</span>
              <button className="btn-icon" onClick={() => setMenuOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <nav className="sheet__nav" style={{ padding: '16px', overflowY: 'auto', maxHeight: 'calc(100vh - 140px)' }}>
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={`${base}/${link.to}`}
                  className={({ isActive }) => cn('sheet__link', isActive && 'active')}
                  onClick={() => setMenuOpen(false)}
                >
                  <link.icon style={{ marginInlineEnd: 12 }} />
                  <span style={{ flex: 1 }}>{t(link.key)}</span>
                  {typeof link.badge === 'number' && link.badge > 0 && (
                    <span className="badge">{link.badge}</span>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* شريط سفلي للوحة على الهاتف */}
      <nav className="tabbar admin-tabbar" aria-label={t('nav.admin')}>
        {topMobileLinks.map((l) => (
          <NavLink key={l.to} to={`${base}/${l.to}`} className="tabbar__item">
            <div style={{ position: 'relative' }}>
              <l.icon size={22} style={{ marginBottom: 4 }} />
              {typeof l.badge === 'number' && l.badge > 0 && (
                <span style={{ position: 'absolute', top: -4, insetInlineEnd: -8, background: 'var(--mw-err)', color: '#fff', fontSize: 10, padding: '2px 4px', borderRadius: 99, lineHeight: 1 }}>{l.badge}</span>
              )}
            </div>
            <span className="tabbar__label">{t(l.key)}</span>
          </NavLink>
        ))}
      </nav>

      {/* القائمة الجانبية لسطح المكتب */}
      <nav className="admin-nav desktop-only" aria-label={t('nav.admin')}>
        <div className="admin-nav__brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="admin-nav__mark" aria-hidden="true">
              ⏱
            </span>
            <span>{session?.tenantName || t('app.name')}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn-icon" style={{ width: 32, height: 32 }} onClick={() => window.location.reload()} title="تحديث البيانات">
              <RefreshIcon size={16} />
            </button>
            <Link to={`/${slug}`} className="btn-icon" style={{ width: 32, height: 32 }} title="معاينة الموقع العام">
              <CalendarIcon size={16} />
            </Link>
            <button className="btn-icon" style={{ width: 32, height: 32 }} onClick={() => navigate(`/${slug}`)} title="إغلاق اللوحة">
              <CloseIcon size={16} />
            </button>
          </div>
        </div>

        <ul className="admin-nav__list">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={`${base}/${link.to}`}
                className={({ isActive }) => cn('admin-nav__link', isActive && 'is-active')}
              >
                <span className="admin-nav__icon" aria-hidden="true">
                  <link.icon size={18} />
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
          <button type="button" className="btn btn--quiet btn--sm" onClick={handleSignOut} style={{ width: '100%' }}>
            {t('action.signOut')}
          </button>
        </div>
      </nav>
    </>
  )
}
