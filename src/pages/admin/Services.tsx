import { useState } from 'react'
import { Button, Field, Input, Select } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle, useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { formatMoney } from '@/lib/money'
import { errorCodeOf, errorKey } from '@/data/errors'
import type { Service } from '@/data/domain'

export default function ServicesPage() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const { reload } = useTenant()
  const toast = useToast()
  const perms = usePermissions()

  const [editingService, setEditingService] = useState<Partial<Service> | null>(null)
  const [priceInput, setPriceInput] = useState<string>('50')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenEdit = (s: Service) => {
    setEditingService(s)
    setPriceInput((s.priceCentimes / 100).toString())
  }

  const handleOpenAdd = () => {
    setEditingService({
      name: '',
      nameFr: '',
      description: '',
      category: 'general',
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      priceCentimes: 5000,
      requiresApproval: false,
      isActive: true,
      sortOrder: bundle.services.length + 1,
    })
    setPriceInput('50')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingService?.name?.trim()) {
      setError(t('error.invalid_name'))
      return
    }

    const priceNum = parseFloat(priceInput)
    if (isNaN(priceNum) || priceNum < 0) {
      setError(t('error.invalid_price'))
      return
    }

    setBusy(true)
    setError(null)
    try {
      await data.upsertService(bundle.tenant.id, {
        serviceId: editingService.id ?? null,
        name: editingService.name.trim(),
        nameFr: editingService.nameFr?.trim() || undefined,
        description: editingService.description?.trim() || undefined,
        category: editingService.category || 'general',
        durationMin: Number(editingService.durationMin) || 30,
        priceCentimes: Math.round(priceNum * 100),
        bufferBeforeMin: Number(editingService.bufferBeforeMin) || 0,
        bufferAfterMin: Number(editingService.bufferAfterMin) || 0,
        requiresApproval: editingService.requiresApproval ?? false,
        isActive: editingService.isActive ?? true,
        sortOrder: editingService.sortOrder ?? bundle.services.length + 1,
      })
      toast(t('common.savedSuccessfully'), 'ok')
      setEditingService(null)
      reload()
    } catch (err) {
      setError(t(errorKey(errorCodeOf(err))))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (s: Service) => {
    try {
      await data.upsertService(bundle.tenant.id, {
        serviceId: s.id,
        isActive: !s.isActive,
      })
      toast(t('common.savedSuccessfully'), 'ok')
      reload()
    } catch (err) {
      toast(t(errorKey(errorCodeOf(err))), 'err')
    }
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{t('admin.services')} ({bundle.services.length})</h1>
          <p className="admin-page__subtitle">{t('admin.servicesSubtitle')}</p>
        </div>
        {perms.edit_services && (
          <div className="admin-page__actions">
            <Button variant="primary" onClick={handleOpenAdd}>
              + {t('admin.addService')}
            </Button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bundle.services.map((s) => (
          <div key={s.id} className="service-card border rounded-xl p-4 bg-surface shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold text-lg">{s.name}</h3>
                <span
                  className={`badge ${s.isActive ? 'badge--ok' : 'badge--neutral'}`}
                >
                  {s.isActive ? t('status.active') : t('status.inactive')}
                </span>
              </div>
              {s.description && (
                <p className="text-sm text-subtle mb-3">{s.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm font-semibold mb-4">
                <span>⏱ {s.durationMin} {t('common.minutes')}</span>
                <span>💰 {formatMoney(s.priceCentimes, bundle.tenant.currency, locale)}</span>
              </div>
            </div>

            {perms.edit_services && (
              <div className="flex gap-2 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenEdit(s)}
                >
                  {t('action.edit')}
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => toggleActive(s)}
                >
                  {s.isActive ? t('action.deactivate') : t('action.activate')}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editingService && (
        <div className="modal-backdrop" onClick={() => setEditingService(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingService.id ? t('admin.editService') : t('admin.addService')}</h2>
            <form onSubmit={handleSave} className="modal-form">
              {error && <div className="alert alert--err">{error}</div>}

              <Field label={t('field.serviceName')}>
                <Input
                  value={editingService.name ?? ''}
                  onChange={(e) =>
                    setEditingService({ ...editingService, name: e.target.value })
                  }
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={`${t('field.price')} (${bundle.tenant.currency})`}>
                  <Input
                    type="number"
                    min="0"
                    step="5"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    required
                  />
                </Field>

                <Field label={`${t('field.duration')} (${t('common.minutes')})`}>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={editingService.durationMin ?? 30}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        durationMin: parseInt(e.target.value) || 30,
                      })
                    }
                    required
                  />
                </Field>
              </div>

              <Field label={t('field.description')}>
                <Input
                  value={editingService.description ?? ''}
                  onChange={(e) =>
                    setEditingService({ ...editingService, description: e.target.value })
                  }
                />
              </Field>

              <div className="modal-actions">
                <Button type="submit" loading={busy} variant="primary">
                  {t('action.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingService(null)}
                >
                  {t('action.cancel')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
