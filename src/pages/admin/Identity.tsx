import { useState } from 'react'
import { Button, Field, Input } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle, useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { errorCodeOf, errorKey } from '@/data/errors'

const BRAND_COLORS = [
  '#0E7C86', // Deep Teal
  '#1E3A8A', // Deep Blue
  '#831843', // Deep Rose/Burgundy
  '#14532D', // Emerald Green
  '#78350F', // Warm Amber/Brown
  '#312E81', // Indigo
  '#0F172A', // Slate Dark
]

export default function IdentityPage() {
  const { t } = useLocale()
  const bundle = useTenantBundle()
  const { reload } = useTenant()
  const toast = useToast()

  const [form, setForm] = useState({
    name: bundle.tenant.name || '',
    nameFr: bundle.tenant.nameFr || '',
    tagline: bundle.tenant.tagline || '',
    taglineFr: bundle.tenant.taglineFr || '',
    phone: bundle.tenant.phone || '',
    whatsapp: bundle.tenant.whatsapp || '',
    email: bundle.tenant.email || '',
    address: bundle.tenant.address || bundle.tenant.addressLine || '',
    city: bundle.tenant.city || '',
    brandColor: bundle.tenant.brandColor || '#0E7C86',
    logoUrl: bundle.tenant.logoUrl || '',
  })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError(t('error.invalid_name'))
      return
    }

    setBusy(true)
    setError(null)
    try {
      await data.updateTenantIdentity(bundle.tenant.id, form)
      toast(t('common.savedSuccessfully'), 'ok')
      reload()
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
          <h1 className="admin-page__title">{t('admin.identity')}</h1>
          <p className="admin-page__subtitle">{t('admin.identitySubtitle')}</p>
        </div>
      </header>

      <div className="max-w-2xl bg-surface border border-border rounded-xl p-6 shadow-sm">
        <form onSubmit={handleSave} className="space-y-4">
          {error && <div className="alert alert--err">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('field.shopNameAr')}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label={t('field.shopNameFr')}>
              <Input
                value={form.nameFr}
                onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                dir="ltr"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('field.taglineAr')}>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              />
            </Field>
            <Field label={t('field.taglineFr')}>
              <Input
                value={form.taglineFr}
                onChange={(e) => setForm({ ...form, taglineFr: e.target.value })}
                dir="ltr"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('field.phone')}>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                type="tel"
                dir="ltr"
                required
              />
            </Field>
            <Field label={t('field.whatsapp')}>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                type="tel"
                dir="ltr"
              />
              <p style={{ fontSize: 12, opacity: 0.7, margin: '4px 0 0' }}>
                {t('admin.whatsappHint')}
              </p>
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t('field.email')}>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                type="email"
                dir="ltr"
              />
            </Field>
            <Field label={t('field.city')}>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
              />
            </Field>
          </div>

          <Field label={t('field.address')}>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>

          <Field label={t('field.brandColor')}>
            <div className="flex items-center gap-3 mt-1">
              {BRAND_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-9 h-9 rounded-full border-2 transition-transform ${
                    form.brandColor === c ? 'scale-110 border-black' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm({ ...form, brandColor: c })}
                />
              ))}
              <Input
                value={form.brandColor}
                onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                dir="ltr"
                className="w-28 text-center"
              />
            </div>
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
