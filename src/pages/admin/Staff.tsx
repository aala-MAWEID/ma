import { useEffect, useState } from 'react'
import { Button, EmptyState, Field, IconButton, Input, Modal, Spinner } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle, useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { errorCodeOf, errorKey } from '@/data/errors'
import type { Staff, Service } from '@/data/domain'

const PRESET_COLORS = [
  '#0E7C86',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#DC2626',
  '#D97706',
  '#059669',
  '#4B5563',
]

type StaffWithDetails = Staff & {
  serviceIds?: string[]
  bookingCount?: number
}

export default function StaffPage() {
  const { t } = useLocale()
  const bundle = useTenantBundle()
  const { reload } = useTenant()
  const toast = useToast()
  const perms = usePermissions()

  const [staffList, setStaffList] = useState<StaffWithDetails[]>([])
  const [allServices, setAllServices] = useState<Service[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [editingStaff, setEditingStaff] = useState<Partial<StaffWithDetails> | null>(null)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoadingList(true)
    try {
      const [staffData, servicesData] = await Promise.all([
        data.listAllStaff(bundle.tenant.id).catch(() => bundle.staff),
        data.listAllServices(bundle.tenant.id).catch(() => bundle.services),
      ])
      setStaffList(staffData as StaffWithDetails[])
      setAllServices(servicesData)
    } catch {
      setStaffList(bundle.staff)
      setAllServices(bundle.services)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.tenant.id])

  const openAdd = () => {
    setEditingStaff({
      displayName: '',
      title: '',
      titleFr: '',
      color: PRESET_COLORS[0],
      isActive: true,
      sortOrder: staffList.length + 1,
    })
    setSelectedServiceIds(allServices.map((s) => s.id))
    setError(null)
  }

  const openEdit = (st: StaffWithDetails) => {
    setEditingStaff(st)
    const linked = st.serviceIds || bundle.staffServices.filter((ss) => ss.staffId === st.id).map((ss) => ss.serviceId)
    setSelectedServiceIds(linked)
    setError(null)
  }

  const closeEdit = () => {
    setEditingStaff(null)
    setError(null)
  }

  const handleSave = async () => {
    if (!editingStaff?.displayName?.trim()) {
      setError(t('error.invalid_name'))
      return
    }

    setBusy(true)
    setError(null)
    try {
      const saved = await data.upsertStaff(bundle.tenant.id, {
        staffId: editingStaff.id ?? null,
        displayName: editingStaff.displayName.trim(),
        title: editingStaff.title?.trim() || undefined,
        titleFr: editingStaff.titleFr?.trim() || undefined,
        color: editingStaff.color ?? '#0E7C86',
        isActive: editingStaff.isActive ?? true,
        sortOrder: editingStaff.sortOrder ?? staffList.length + 1,
      })

      if (saved.id) {
        await data.setStaffServices(bundle.tenant.id, saved.id, selectedServiceIds).catch(() => {})
      }

      toast.success(t('common.saved'))
      setEditingStaff(null)
      await reload()
      await loadData()
    } catch (err) {
      setError(t(errorKey(errorCodeOf(err))))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (st: StaffWithDetails) => {
    try {
      await data.upsertStaff(bundle.tenant.id, {
        staffId: st.id,
        isActive: !st.isActive,
      })
      toast.success(t('common.saved'))
      await reload()
      await loadData()
    } catch (err) {
      toast.error(t(errorKey(errorCodeOf(err))))
    }
  }

  const handleDelete = async (st: StaffWithDetails) => {
    if (!window.confirm(t('admin.confirmDeleteStaff'))) return
    try {
      await data.deleteStaff(bundle.tenant.id, st.id)
      toast.success(t('common.deleted'))
      await reload()
      await loadData()
    } catch (err) {
      toast.error(t(errorKey(errorCodeOf(err))))
    }
  }

  const moveStaff = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= staffList.length) return
    const reordered = [...staffList]
    const temp = reordered[index]!
    reordered[index] = reordered[targetIndex]!
    reordered[targetIndex] = temp

    setStaffList(reordered)
    try {
      await data.reorderStaff(bundle.tenant.id, reordered.map((s) => s.id))
      await reload()
    } catch {
      await loadData()
    }
  }

  return (
    <section className="admin-page" dir="rtl">
      <header className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{t('admin.staff')} ({staffList.length})</h1>
          <p className="admin-page__subtitle">{t('admin.staffSubtitle')}</p>
        </div>
        {perms.edit_staff && (
          <div className="admin-page__actions">
            <Button variant="primary" onClick={openAdd}>
              + {t('admin.addStaff')}
            </Button>
          </div>
        )}
      </header>

      {loadingList ? (
        <div className="page-center">
          <Spinner size={28} />
        </div>
      ) : staffList.length === 0 ? (
        <EmptyState icon="✂" title={t('admin.noStaff')} body={t('admin.noStaffBody')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((st, index) => (
            <div key={st.id} className="staff-card border rounded-xl p-4 bg-surface shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                  style={{ backgroundColor: st.color }}
                >
                  {st.displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate">{st.displayName}</h3>
                  <p className="text-sm opacity-75 truncate">{st.title || t('admin.staffTitle')}</p>
                </div>
                <span
                  className={`badge ${st.isActive ? 'badge--ok' : 'badge--neutral'}`}
                >
                  {st.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </div>

              {perms.edit_staff && (
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-border flex-wrap">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={index === 0}
                      onClick={() => moveStaff(index, 'up')}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={index === staffList.length - 1}
                      onClick={() => moveStaff(index, 'down')}
                    >
                      ↓
                    </Button>
                  </div>
                  <div className="row-actions">
                    <IconButton
                      icon="edit"
                      label={t('common.edit')}
                      showLabel
                      onClick={() => openEdit(st)}
                    />
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => toggleActive(st)}
                    >
                      {st.isActive ? t('common.deactivate') : t('common.activate')}
                    </Button>
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={t('common.delete')}
                      onClick={() => handleDelete(st)}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editingStaff)}
        onClose={closeEdit}
        title={editingStaff?.id ? t('admin.editStaff') : t('admin.addStaff')}
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

          <Field label={t('admin.staffName')}>
            <Input
              value={editingStaff?.displayName ?? ''}
              onChange={(e) =>
                setEditingStaff((prev) => (prev ? { ...prev, displayName: e.target.value } : null))
              }
              required
            />
          </Field>

          <div className="modal-form__row">
            <Field label={t('admin.staffTitle')}>
              <Input
                value={editingStaff?.title ?? ''}
                onChange={(e) =>
                  setEditingStaff((prev) => (prev ? { ...prev, title: e.target.value } : null))
                }
              />
            </Field>
            <Field label={t('admin.staffTitleFr')}>
              <Input
                value={editingStaff?.titleFr ?? ''}
                onChange={(e) =>
                  setEditingStaff((prev) => (prev ? { ...prev, titleFr: e.target.value } : null))
                }
                dir="ltr"
              />
            </Field>
          </div>

          <Field label={t('admin.color')}>
            <div className="color-swatches" role="group" aria-label={t('admin.color')}>
              {PRESET_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className="color-swatch"
                  style={{ backgroundColor: hex }}
                  aria-label={hex}
                  aria-pressed={editingStaff?.color === hex}
                  onClick={() =>
                    setEditingStaff((prev) => (prev ? { ...prev, color: hex } : null))
                  }
                />
              ))}
            </div>
          </Field>

          <Field label={t('admin.linkedServices')}>
            {allServices.length === 0 ? (
              <p className="modal-form__hint">{t('admin.noServicesYet')}</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, maxHeight: 160, overflowY: 'auto', padding: 8, border: '1px solid var(--mw-line)', borderRadius: 'var(--r-md)' }}>
                {allServices.map((svc) => (
                  <label key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedServiceIds.includes(svc.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedServiceIds([...selectedServiceIds, svc.id])
                        } else {
                          setSelectedServiceIds(selectedServiceIds.filter((id) => id !== svc.id))
                        }
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.name}</span>
                  </label>
                ))}
              </div>
            )}
          </Field>

          <button type="submit" hidden />
        </form>
      </Modal>
    </section>
  )
}
