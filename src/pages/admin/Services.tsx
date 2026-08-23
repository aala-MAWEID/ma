import { PageHeader } from '@/components/shared/PageHeader'
import { useEffect, useState } from 'react'
import { Button, EmptyState, Field, IconButton, Input, Modal, Spinner } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle, useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { formatMoney } from '@/lib/money'
import { errorCodeOf, errorKey } from '@/data/errors'
import type { Service } from '@/data/domain'

type ServiceWithDetails = Service & {
  staffIds?: string[]
  bookingCount?: number
}

export default function ServicesPage() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const { reload } = useTenant()
  const toast = useToast()
  const perms = usePermissions()

  const [servicesList, setServicesList] = useState<ServiceWithDetails[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [editingService, setEditingService] = useState<Partial<ServiceWithDetails> | null>(null)
  const [priceInput, setPriceInput] = useState<string>('50')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoadingList(true)
    try {
      const dataList = await data.listAllServices(bundle.tenant.id).catch(() => bundle.services)
      setServicesList(dataList as ServiceWithDetails[])
    } catch {
      setServicesList(bundle.services)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.tenant.id])

  const handleOpenEdit = (s: ServiceWithDetails) => {
    setEditingService(s)
    setPriceInput((s.priceCentimes / 100).toString())
    setError(null)
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
      sortOrder: servicesList.length + 1,
    })
    setPriceInput('50')
    setError(null)
  }

  const closeEdit = () => {
    setEditingService(null)
    setError(null)
  }

  const handleSave = async () => {
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
        sortOrder: editingService.sortOrder ?? servicesList.length + 1,
      })
      toast.success(t('common.saved'))
      setEditingService(null)
      await reload()
      await loadData()
    } catch (err) {
      setError(t(errorKey(errorCodeOf(err))))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (s: ServiceWithDetails) => {
    try {
      await data.upsertService(bundle.tenant.id, {
        serviceId: s.id,
        isActive: !s.isActive,
      })
      toast.success(t('common.saved'))
      await reload()
      await loadData()
    } catch (err) {
      toast.error(t(errorKey(errorCodeOf(err))))
    }
  }

  const handleDelete = async (s: ServiceWithDetails) => {
    if (!window.confirm(t('admin.confirmDeleteService'))) return
    try {
      await data.deleteService(bundle.tenant.id, s.id)
      toast.success(t('common.deleted'))
      await reload()
      await loadData()
    } catch (err) {
      toast.error(t(errorKey(errorCodeOf(err))))
    }
  }

  const moveService = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= servicesList.length) return
    const reordered = [...servicesList]
    const temp = reordered[index]!
    reordered[index] = reordered[targetIndex]!
    reordered[targetIndex] = temp

    setServicesList(reordered)
    try {
      await data.reorderServices(bundle.tenant.id, reordered.map((s) => s.id))
      await reload()
    } catch {
      await loadData()
    }
  }

  return (
    <section className="admin-page" dir="rtl">
      <PageHeader title={`${t('admin.services')} (${servicesList.length})`} description={t('admin.servicesSubtitle')} />

      {loadingList ? (
        <div className="page-center">
          <Spinner size={28} />
        </div>
      ) : servicesList.length === 0 ? (
        <EmptyState icon="🏷️" title={t('admin.noServices')} body={t('admin.noServicesBody')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicesList.map((s, index) => (
            <div key={s.id} className="service-card border rounded-xl p-4 bg-surface shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-lg">{s.name}</h3>
                  <span
                    className={`badge ${s.isActive ? 'badge--ok' : 'badge--neutral'}`}
                  >
                    {s.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
                {s.description && (
                  <p className="text-sm opacity-75 mb-3">{s.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm font-semibold mb-4">
                  <span>⏱ {s.durationMin} {t('common.min')}</span>
                  <span>💰 {formatMoney(s.priceCentimes, bundle.tenant.currency, locale)}</span>
                </div>
              </div>

              {perms.edit_services && (
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-border flex-wrap">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={index === 0}
                      onClick={() => moveService(index, 'up')}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={index === servicesList.length - 1}
                      onClick={() => moveService(index, 'down')}
                    >
                      ↓
                    </Button>
                  </div>
                  <div className="row-actions">
                    <IconButton
                      icon="edit"
                      label={t('common.edit')}
                      showLabel
                      onClick={() => handleOpenEdit(s)}
                    />
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => toggleActive(s)}
                    >
                      {s.isActive ? t('common.deactivate') : t('common.activate')}
                    </Button>
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={t('common.delete')}
                      onClick={() => handleDelete(s)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editingService)}
        onClose={closeEdit}
        title={editingService?.id ? t('common.edit') : t('admin.addService')}
        footer={
          <>
            <Button variant="quiet" onClick={closeEdit} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={busy}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSave()
          }}
        >
          {error && <div className="alert alert--err">{error}</div>}

          <div className="modal-form__row">
            <Field label={t('admin.serviceName')}>
              <Input
                value={editingService?.name ?? ''}
                onChange={(e) =>
                  setEditingService((prev) => (prev ? { ...prev, name: e.target.value } : null))
                }
                required
              />
            </Field>
            <Field label={t('admin.serviceNameFr')}>
              <Input
                value={editingService?.nameFr ?? ''}
                onChange={(e) =>
                  setEditingService((prev) => (prev ? { ...prev, nameFr: e.target.value } : null))
                }
                dir="ltr"
              />
            </Field>
          </div>

          <div className="modal-form__row">
            <Field label={`${t('admin.price')} (${bundle.tenant.currency})`}>
              <Input
                type="number"
                min="0"
                step="5"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                required
              />
            </Field>

            <Field label={`${t('admin.duration')} (${t('common.min')})`}>
              <Input
                type="number"
                min="5"
                step="5"
                value={editingService?.durationMin ?? 30}
                onChange={(e) =>
                  setEditingService((prev) =>
                    prev ? { ...prev, durationMin: parseInt(e.target.value) || 30 } : null,
                  )
                }
                required
              />
            </Field>
          </div>

          <div className="modal-form__row">
            <Field label={t('admin.bufferBefore')}>
              <Input
                type="number"
                min="0"
                step="5"
                value={editingService?.bufferBeforeMin ?? 0}
                onChange={(e) =>
                  setEditingService((prev) =>
                    prev ? { ...prev, bufferBeforeMin: parseInt(e.target.value) || 0 } : null,
                  )
                }
              />
            </Field>
            <Field label={t('admin.bufferAfter')}>
              <Input
                type="number"
                min="0"
                step="5"
                value={editingService?.bufferAfterMin ?? 0}
                onChange={(e) =>
                  setEditingService((prev) =>
                    prev ? { ...prev, bufferAfterMin: parseInt(e.target.value) || 0 } : null,
                  )
                }
              />
            </Field>
          </div>

          <Field label={t('admin.description')}>
            <Input
              value={editingService?.description ?? ''}
              onChange={(e) =>
                setEditingService((prev) => (prev ? { ...prev, description: e.target.value } : null))
              }
            />
          </Field>

          <button type="submit" hidden />
        </form>
      </Modal>
    </section>
  )
}
