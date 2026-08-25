import { useParams } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsDesktop } from '@/hooks'
import { 
  CalendarIcon, ClockIcon, QueueIcon, BellIcon, UserIcon, 
  EditIcon, ListIcon 
} from '@/components/ui/icons'
import { AdminSidebar, type AdminNavLinkItem } from './AdminSidebar'
import { AdminMobileHeader } from './AdminMobileHeader'
import { AdminTabbar } from './AdminTabbar'

export type { AdminNavLinkItem }

export function AdminNav({
  pendingCount = 0,
  queueCount = 0,
  isCollapsed,
  onToggleCollapse,
}: {
  pendingCount?: number
  queueCount?: number
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const { t } = useLocale()
  const { signOut, session } = useAuth()
  const perms = usePermissions()
  const params = useParams<{ slug: string }>()
  const slug = params.slug || ''
  const base = `/${slug}/admin`
  const isDesktop = useIsDesktop()

  const links: AdminNavLinkItem[] = [
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

  const topMobileLinks: AdminNavLinkItem[] = [
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

  if (isDesktop) {
    return (
      <AdminSidebar
        links={links}
        session={session}
        onSignOut={handleSignOut}
        slug={slug}
        isCollapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
      />
    )
  }

  return (
    <>
      <AdminMobileHeader
        links={links}
        session={session}
        slug={slug}
        onSignOut={handleSignOut}
      />
      <AdminTabbar links={topMobileLinks} base={base} />
    </>
  )
}
