import { useEffect, useState, type FormEvent } from 'react'
import { Outlet } from 'react-router-dom'
import { AdminNav } from '@/components/admin/AdminNav'
import { Button, Field, Input, Spinner } from '@/components/ui'
import { data } from '@/data'
import { useAuth } from '@/contexts/AuthContext'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { errorCodeOf, errorKey } from '@/data/errors'

export default function AdminShell() {
  const { t } = useLocale()
  const bundle = useTenantBundle()
  const { session, loading, signIn } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    if (!session) return
    const refresh = () => {
      void data.listRequests(bundle.tenant.id).then((list) => setPendingCount(list.length)).catch(() => {})
      void data.getQueue(bundle.tenant.id).then((q) => {
        const waiting = q.filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
        setQueueCount(waiting.length)
      }).catch(() => {})
    }
    refresh()
    return data.subscribeBookings(bundle.tenant.id, refresh)
  }, [session, bundle.tenant.id])

  if (loading) {
    return (
      <div className="page-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (!session) return <SignIn onSubmit={signIn} />

  return (
    <div className="admin">
      <AdminNav pendingCount={pendingCount} queueCount={queueCount} />
      <div className="admin__main">
        <Outlet />
      </div>
    </div>
  )
}

function SignIn({ onSubmit }: { onSubmit: (email: string, password: string) => Promise<void> }) {
  const { t } = useLocale()
  const [email, setEmail] = useState('owner@zaytouna.ma')
  const [password, setPassword] = useState('demo1234')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(email, password)
    } catch (err) {
      setError(t(errorKey(errorCodeOf(err))))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-center">
      <form className="signin" onSubmit={submit}>
        <h1>{t('admin.signInTitle')}</h1>
        <p className="signin__hint">
          {t('admin.demoHint', { email: 'owner@zaytouna.ma', password: 'demo1234' })}
        </p>

        {error && <div className="alert alert--err">{error}</div>}

        <Field label={t('field.email')}>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            dir="ltr"
            autoComplete="username"
            required
          />
        </Field>

        <Field label={t('field.password')}>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
          />
        </Field>

        <Button type="submit" loading={busy} block>
          {t('action.signIn')}
        </Button>
      </form>
    </div>
  )
}
