import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Field, Input } from '@/components/ui'
import { useAuth } from '@/contexts/AuthContext'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { errorCodeOf, errorKey } from '@/data/errors'

export default function Login() {
  const { t } = useLocale()
  const { slug } = useParams()
  const bundle = useTenantBundle()
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      navigate(`/${slug ?? bundle.tenant.slug}/admin/agenda`, { replace: true })
    } catch (err) {
      setError(t(errorKey(errorCodeOf(err))))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-center">
      <form className="signin max-w-sm w-full bg-surface border border-border rounded-2xl p-6 shadow-md" onSubmit={submit}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{t('admin.signInTitle')}</h1>
          <p className="text-sm text-subtle mt-1">{bundle.tenant.name}</p>
        </div>

        {error && <div className="alert alert--err mb-4">{error}</div>}

        <Field label={t('field.email')}>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            dir="ltr"
            autoComplete="username"
            placeholder="owner@zaytouna.ma"
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

        <Button type="submit" loading={busy} variant="primary" block className="mt-4">
          {t('action.signIn')}
        </Button>
      </form>
    </div>
  )
}
