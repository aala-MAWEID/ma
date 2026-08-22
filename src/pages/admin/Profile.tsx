import { useState } from 'react'
import { Button, Field, Input, Select } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { errorCodeOf, errorKey } from '@/data/errors'

export default function ProfilePage() {
  const { t, locale, setLocale } = useLocale()
  const { session, refresh } = useAuth()
  const toast = useToast()

  const [displayName, setDisplayName] = useState(session?.displayName ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError(t('error.invalid_name'))
      return
    }

    setBusy(true)
    setError(null)
    try {
      await data.updateMyProfile({
        displayName: displayName.trim(),
        locale,
      })
      toast(t('common.savedSuccessfully'), 'ok')
      await refresh()
    } catch (err) {
      setError(t(errorKey(errorCodeOf(err))))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{t('admin.profile')}</h1>
          <p className="admin-page__subtitle">{t('admin.profileSubtitle')}</p>
        </div>
      </header>

      <div className="max-w-md bg-surface border border-border rounded-xl p-6 shadow-sm">
        <form onSubmit={handleSave} className="space-y-4">
          {error && <div className="alert alert--err">{error}</div>}

          <Field label={t('field.email')}>
            <Input value={session?.email ?? ''} disabled dir="ltr" />
          </Field>

          <Field label={t('field.displayName')}>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </Field>

          <Field label={t('field.language')}>
            <Select
              value={locale}
              onChange={(e) => setLocale(e.target.value as any)}
            >
              <option value="ar">العربية (Arabic)</option>
              <option value="fr">Français (French)</option>
              <option value="en">English</option>
            </Select>
          </Field>

          <div className="pt-4 border-t border-border flex justify-end">
            <Button type="submit" loading={busy} variant="primary">
              {t('action.save')}
            </Button>
          </div>
        </form>
      </div>
    </section>
  )
}
