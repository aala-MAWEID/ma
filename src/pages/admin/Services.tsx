import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button, EmptyState, Field, IconButton, Input, Modal, Spinner, Price } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle, useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useIsDesktop } from '@/hooks'
import { errorCodeOf, errorKey } from '@/data/errors'
import type { Service } from '@/data/domain'

type ServiceWithDetails = Service & {
  staffIds?: string[]
  bookingCount?: number
}

export default function ServicesPage() {
  const { t, dir } = useLocale()
  const bundle = useTenantBundle()
  const { reload } = useTenant()
  const toast = useToast()
  const perms = usePermissions()
  const isDesktop = useIsDesktop()

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
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      priceCentimes: 5000,
      priceHidden: false,
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
      const saved = await data.upsertService(bundle.tenant.id, {
        serviceId: editingService.id ?? null,
        name: editingService.name.trim(),
        nameFr: editingService.nameFr?.trim() || undefined,
        description: editingService.description?.trim() || undefined,
        durationMin: Number(editingService.durationMin) || 30,
        priceCentimes: Math.round(priceNum * 100),
        isActive: editingService.isActive ?? true,
        sortOrder: editingService.sortOrder ?? servicesList.length + 1,
      })

      if (editingService.priceHidden !== undefined && saved.id) {
        await data.setServicePriceVisibility(bundle.tenant.id, saved.id, Boolean(editingService.priceHidden))
      }

      toast.success(t('common.saved'))
      closeEdit()
      await loadData()
      await reload()
    } catch (err) {
      setError(t(errorKey(errorCodeOf(err))))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (s: ServiceWithDetails) => {
    if (!window.confirm(t('admin.confirmDeleteService'))) return
    try {
      await data.deleteService(bundle.tenant.id, s.id)
      toast.success(t('common.deleted'))
      await loadData()
      await reload()
    } catch (err) {
      toast.error(t(errorKey(errorCodeOf(err))))
    }
  }

  const toggleActive = async (s: ServiceWithDetails) => {
    try {
      await data.upsertService(bundle.tenant.id, {
        serviceId: s.id,
        name: s.name,
        isActive: !s.isActive,
      })
      toast.success(t('common.saved'))
      await loadData()
      await reload()
    } catch (err) {
      toast.error(t(errorKey(errorCodeOf(err))))
    }
  }

  const togglePriceVisibility = async (s: ServiceWithDetails) => {
    const next = !s.priceHidden
    try {
      await data.setServicePriceVisibility(bundle.tenant.id, s.id, next)
      setServicesList((prev) =>
        prev.map((item) => (item.id === s.id ? { ...item, priceHidden: next } : item))
      )
      toast.success(t('common.saved'))
      void reload()
    } catch (err) {
      toast.error(t(errorKey(errorCodeOf(err))))
    }
  }

  const moveService = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= servicesList.length) return

    const reordered = [...servicesList]
    const current = reordered[index]
    const target = reordered[targetIndex]
    if (!current || !target) return
    reordered[index] = target
    reordered[targetIndex] = current

    setServicesList(reordered)
    try {
      await data.reorderServices(bundle.tenant.id, reordered.map((s) => s.id))
      await reload()
    } catch {
      await loadData()
    }
  }

  const inactiveCount = servicesList.filter(s => !s.isActive).length

  return (
    <section className="admin-page" dir={dir}>
      <PageHeader
        title={`${t('admin.services')} (${servicesList.length})`}
        description={`${t('admin.servicesSubtitle')}${inactiveCount > 0 ? ` · ${inactiveCount} ${t('common.inactive')}` : ''}`}
        actions={
          perms.edit_services ? (
            <Button variant="primary" size="sm" onClick={handleOpenAdd}>
              + {t('admin.addService')}
            </Button>
          ) : undefined
        }
      />

      {loadingList ? (
        <div className="page-center">
          <Spinner size={28} />
        </div>
      ) : servicesList.length === 0 ? (
        <EmptyState icon="🏷️" title={t('admin.noServices')} body={t('admin.noServicesBody')} />
      ) : isDesktop ? (
        <div className="table-responsive bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ inlineSize: 40 }}>#</th>
                <th>{t('admin.serviceName')}</th>
                <th>{t('admin.duration')}</th>
                <th>{t('admin.price')}</th>
                <th>{t('common.active')}</th>
                {perms.edit_services && <th style={{ textAlign: 'end' }}>{t('common.actions') || ''}</th>}
              </tr>
            </thead>
            <tbody>
              {servicesList.map((s, index) => (
                <tr key={s.id}>
                  <td className="tabular-nums opacity-60 font-mono text-xs">{index + 1}</td>
                  <td>
                    <div className="font-semibold">{s.name}</div>
                    {s.nameFr && <div className="text-xs opacity-60">{s.nameFr}</div>}
                  </td>
                  <td className="tabular-nums">
                    ⏱ {s.durationMin} {t('common.min')}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Price
                        amountCentimes={s.priceCentimes}
                        service={s}
                        adminBadge={true}
                        currency={bundle.tenant.currency}
                      />
                      {perms.edit_services && (
                        <button
                          type="button"
                          className="btn-icon btn-icon--sm"
                          onClick={() => togglePriceVisibility(s)}
                          title={s.priceHidden ? t('admin.showPrice') : t('admin.hidePrice')}
                        >
                          {s.priceHidden ? '👁️' : '🕶️'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${s.isActive ? 'badge--ok' : 'badge--neutral'}`}>
                      {s.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  {perms.edit_services && (
                    <td style={{ textAlign: 'end' }}>
                      <div className="flex items-center justify-end gap-1">
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
                        <IconButton
                          icon="edit"
                          label={t('common.edit')}
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
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {servicesList.map((s, index) => (
            <div
              key={s.id}
              className="service-card border rounded-xl p-4 bg-surface shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-lg">{s.name}</h3>
                  <span className={`badge ${s.isActive ? 'badge--ok' : 'badge--neutral'}`}>
                    {s.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
                {s.description && <p className="text-sm opacity-75 mb-3">{s.description}</p>}
                <div className="flex items-center gap-4 text-sm font-semibold mb-4">
                  <span>⏱ {s.durationMin} {t('common.min')}</span>
                  <Price
                    amountCentimes={s.priceCentimes}
                    service={s}
                    adminBadge={true}
                    currency={bundle.tenant.currency}
                  />
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
                  <div className="row-actions flex items-center gap-1">
                    <IconButton
                      icon="edit"
                      label={t('common.edit')}
                      showLabel
                      onClick={() => handleOpenEdit(s)}
                    />
                    <Button size="sm" variant="quiet" onClick={() => toggleActive(s)}>
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
                    prev ? { ...prev, durationMin: Number(e.target.value) } : null,
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
                    prev ? { ...prev, bufferBeforeMin: Number(e.target.value) } : null,
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
                    prev ? { ...prev, bufferAfterMin: Number(e.target.value) } : null,
                  )
                }
              />
            </Field>
          </div>

          <Field label={t('admin.description')}>
            <Input
              value={editingService?.description ?? ''}
              onChange={(e) =>
                setEditingService((prev) =>
                  prev ? { ...prev, description: e.target.value } : null,
                )
              }
            />
          </Field>

          <div className="space-y-2 pt-2">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={editingService?.priceHidden ?? false}
                onChange={(e) =>
                  setEditingService((prev) =>
                    prev ? { ...prev, priceHidden: e.target.checked } : null,
                  )
                }
              />
              <span>{t('admin.hidePrice')}</span>
            </label>
          </div>
        </form>
      </Modal>
    </section>
  )
}
