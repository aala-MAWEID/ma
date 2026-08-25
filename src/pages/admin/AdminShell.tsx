import { useEffect, useState, useMemo } from 'react'
import { Navigate, Outlet, useParams, useLocation, Link } from 'react-router-dom'
import { AdminNav } from '@/components/admin/AdminNav'
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary'
import { useAuth } from '@/contexts/AuthContext'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { useIsDesktop } from '@/hooks'
import { Button, Spinner } from '@/components/ui'
import { 
  CalendarIcon, 
  RefreshIcon, 
  SearchIcon,
  UserIcon
} from '@/components/ui/icons'
import { data } from '@/data'
import type { AuthStatus } from '@/data/adapter'
import { cn } from '@/lib/cn'
import { safeStorage } from '@/lib/safeStorage'

const COLLAPSED_STORAGE_KEY = 'maweid.nav.collapsed'

export default function AdminShell() {
  const { slug = '' } = useParams<{ slug: string }>()
  const bundle = useTenantBundle()
  const { session, loading: authLoading, refresh, signOut } = useAuth()
  const { t, dir, locale } = useLocale()
  const toast = useToast()
  const location = useLocation()
  const isDesktop = useIsDesktop()

  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [checking, setChecking] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [queueCount, setQueueCount] = useState(0)
  const [lastSynced, setLastSynced] = useState<Date>(() => new Date())

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return safeStorage.get(COLLAPSED_STORAGE_KEY) === 'true'
  })

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      safeStorage.set(COLLAPSED_STORAGE_KEY, String(next))
      return next
    })
  }

  // Load counts & sync
  const refreshCounts = () => {
    if (!bundle?.tenant?.id) return
    setLastSynced(new Date())
    
    data.getStats(bundle.tenant.id)
      .then((stats) => {
        setPendingCount(stats.pendingCount ?? 0)
        setQueueCount(stats.queueCount ?? 0)
      })
      .catch(() => {})
  }

  useEffect(() => {
    let alive = true
    if (!session) {
      setChecking(false)
      return () => {
        alive = false
      }
    }
    setChecking(true)
    data
      .authStatus(slug)
      .then((s) => {
        if (alive) setStatus(s)
      })
      .catch((e) => {
        console.error('[maweid] authStatus failed', e)
        if (alive) setStatus(null)
      })
      .finally(() => {
        if (alive) setChecking(false)
      })
    return () => {
      alive = false
    }
  }, [session, slug])

  // Realtime subscription for pending and queue badges
  useEffect(() => {
    if (!bundle?.tenant?.id || !session) return
    refreshCounts()
    const unsubscribe = data.subscribeBookings(bundle.tenant.id, () => {
      refreshCounts()
    })
    return () => {
      unsubscribe()
    }
  }, [bundle?.tenant?.id, session])

  // Compute current page label for breadcrumbs
  const currentPageKey = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1] ?? ''
    const routeMap: Record<string, string> = {
      agenda: 'admin.calendar',
      schedule: 'admin.schedule',
      hours: 'admin.hours',
      queue: 'admin.queue',
      requests: 'admin.requests',
      customers: 'admin.customers',
      staff: 'admin.staff',
      services: 'admin.services',
      identity: 'admin.identity',
      settings: 'admin.settings',
      stats: 'admin.stats',
      profile: 'admin.profile',
    }
    return routeMap[last] || 'admin.calendar'
  }, [location.pathname])

  async function claim() {
    setClaiming(true)
    try {
      await data.claimShop(slug)
      const fresh = await data.authStatus(slug)
      setStatus(fresh)
      await refresh()
      toast.success(t('admin.claimed'))
    } catch (e) {
      toast.error(t('error.forbidden'))
      console.error('[maweid] claimShop failed', e)
    } finally {
      setClaiming(false)
    }
  }

  if (authLoading || checking) {
    return (
      <div className="page-center">
        <Spinner size={32} />
      </div>
    )
  }

  // Not signed in -> login screen
  if (!session) return <Navigate to={`/${slug}/admin/login`} replace />

  // Signed in but not a member -> claim shop or forbidden
  if (!status?.isMember) {
    return (
      <div className="page-center" dir={dir}>
        <div className="auth-card">
          <h1 className="auth-card__title">{bundle.tenant.name}</h1>
          <p className="auth-card__subtitle">
            {t('admin.signedInAs')}: <strong>{status?.email ?? ''}</strong>
          </p>
          {status?.canClaim ? (
            <>
              <p className="auth-card__subtitle">{t('admin.claimHint')}</p>
              <Button variant="primary" block loading={claiming} onClick={claim}>
                {t('admin.claimShop')}
              </Button>
            </>
          ) : (
            <div className="alert alert--err">{t('admin.notMember')}</div>
          )}
        </div>
      </div>
    )
  }

  const formattedSyncTime = lastSynced.toLocaleTimeString(
    locale === 'ar' ? 'ar-MA' : 'fr-FR',
    { hour: '2-digit', minute: '2-digit', second: '2-digit' }
  )

  return (
    <div
      className={cn(
        'admin',
        isDesktop ? 'admin--desktop' : 'admin--mobile',
        isDesktop && isCollapsed && 'is-collapsed'
      )}
      dir={dir}
    >
      <AdminNav
        pendingCount={pendingCount}
        queueCount={queueCount}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapsed}
      />
      
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Desktop App Bar */}
        {isDesktop && (
          <header className="admin-appbar">
            <div className="admin-appbar__start">
              <nav className="admin-appbar__breadcrumb" aria-label="Breadcrumb">
                <span>{session?.tenantName || bundle?.tenant?.name}</span>
                <span className="admin-appbar__breadcrumb-sep" aria-hidden="true">/</span>
                <span className="admin-appbar__breadcrumb-current">{t(currentPageKey)}</span>
              </nav>
            </div>

            <div className="admin-appbar__center">
              <div className="admin-appbar__search" role="button" tabIndex={0}>
                <SearchIcon size={14} />
                <span>{t('admin.searchCommand')}</span>
                <kbd className="admin-appbar__search-kbd">⌘K</kbd>
              </div>
            </div>

            <div className="admin-appbar__end">
              <div className="admin-appbar__sync" title={t('admin.lastSynced')}>
                <span className="admin-appbar__sync-dot" />
                <span>{formattedSyncTime}</span>
              </div>

              <button
                type="button"
                className="btn-icon btn-icon--sm"
                onClick={refreshCounts}
                title={t('admin.refreshData')}
                aria-label={t('admin.refreshData')}
              >
                <RefreshIcon size={16} />
              </button>

              <Link
                to={`/${slug}`}
                className="btn-icon btn-icon--sm"
                title={t('admin.previewPublic')}
                aria-label={t('admin.previewPublic')}
                target="_blank"
                rel="noreferrer"
              >
                <CalendarIcon size={16} />
              </Link>

              <div className="admin-appbar__user">
                <div className="admin-appbar__avatar" aria-hidden="true">
                  {(session?.displayName || 'U').charAt(0).toUpperCase() || 'U'}
                </div>
              </div>
            </div>
          </header>
        )}

        <main className="admin__main">
          <AdminErrorBoundary key={location.pathname}>
            <Outlet />
          </AdminErrorBoundary>
        </main>
      </div>
    </div>
  )
}
