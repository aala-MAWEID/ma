import { useEffect, useState } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { AdminNav } from '@/components/admin/AdminNav'
import { useAuth } from '@/contexts/AuthContext'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { Button, Spinner } from '@/components/ui'
import { data } from '@/data'
import type { AuthStatus } from '@/data/adapter'

export default function AdminShell() {
  const { slug = '' } = useParams<{ slug: string }>()
  const bundle = useTenantBundle()
  const { session, loading: authLoading, refresh } = useAuth()
  const { t } = useLocale()
  const toast = useToast()

  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [checking, setChecking] = useState(true)
  const [claiming, setClaiming] = useState(false)

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

  // غير مسجّل → إلى صفحة الدخول (لا نموج دخول داخل اللوحة)
  if (!session) return <Navigate to={`/${slug}/admin/login`} replace />

  // مسجّل ولكنه ليس عضواً → بطاقة مطالبة بالمحل أو رفض واضح
  if (!status?.isMember) {
    return (
      <div className="page-center" dir="rtl">
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

  return (
    <div className="admin" dir="rtl">
      <AdminNav />
      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  )
}
