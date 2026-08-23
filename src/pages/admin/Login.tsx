import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { GoogleButton } from '@/components/shared/GoogleButton'
import { useAuth } from '@/contexts/AuthContext'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { Button, Spinner } from '@/components/ui'
import { data } from '@/data'
import type { AuthStatus } from '@/data/adapter'

export default function Login() {
  const { slug = '' } = useParams<{ slug: string }>()
  const bundle = useTenantBundle()
  const { session, loading } = useAuth()
  const { t } = useLocale()
  const toast = useToast()
  const navigate = useNavigate()

  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const redirectTo = useMemo(
    () => window.location.origin + import.meta.env.BASE_URL + slug + '/admin',
    [slug],
  )

  useEffect(() => {
    if (!session) return
    let alive = true
    data
      .authStatus(slug)
      .then((s) => alive && setStatus(s))
      .catch((e) => console.error('[maweid] authStatus failed', e))
    return () => {
      alive = false
    }
  }, [session, slug])

  async function claim() {
    setBusy(true)
    try {
      await data.claimShop(slug)
      toast.success(t('admin.claimed'))
      navigate(`/${slug}/admin`, { replace: true })
    } catch (e) {
      toast.error(t('error.forbidden'))
      console.error('[maweid] claimShop failed', e)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="page-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (session && status?.isMember) return <Navigate to={`/${slug}/admin`} replace />

  return (
    <div className="page-center" dir="rtl">
      <div className="auth-card">
        <h1 className="auth-card__title">{bundle.tenant.name}</h1>
        <p className="auth-card__subtitle">{t('admin.loginSubtitle')}</p>

        {!session ? (
          <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
            <GoogleButton redirectTo={redirectTo} block />
            <p className="signin__hint">{t('admin.googleOnlyHint')}</p>
          </div>
        ) : status?.canClaim ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <p className="auth-card__subtitle">
              {t('admin.signedInAs')}: <strong>{status.email}</strong>
            </p>
            <p className="auth-card__subtitle">{t('admin.claimHint')}</p>
            <Button variant="primary" block loading={busy} onClick={claim}>
              {t('admin.claimShop')}
            </Button>
          </div>
        ) : (
          <div className="alert alert--err">{t('admin.notMember')}</div>
        )}
      </div>
    </div>
  )
}
