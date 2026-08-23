import { useEffect, useState } from 'react'
import { Button, EmptyState, Field, Input, Spinner } from '@/components/ui'
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
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
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(st)}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => toggleActive(st)}
                    >
                      {st.isActive ? t('common.deactivate') : t('common.activate')}
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => handleDelete(st)}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editingStaff && (
        <div className="modal-backdrop" onClick={() => setEditingStaff(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <h2>{editingStaff.id ? t('common.edit') : t('admin.addStaff')}</h2>
            <form onSubmit={handleSave} className="modal-form">
              {error && <div className="alert alert--err">{error}</div>}

              <Field label={t('admin.staffName')}>
                <Input
                  value={editingStaff.displayName ?? ''}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, displayName: e.target.value })
                  }
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t('admin.staffTitle')}>
                  <Input
                    value={editingStaff.title ?? ''}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, title: e.target.value })
                    }
                  />
                </Field>
                <Field label={t('admin.staffTitleFr')}>
                  <Input
                    value={editingStaff.titleFr ?? ''}
                    onChange={(e) =>
                      setEditingStaff({ ...editingStaff, titleFr: e.target.value })
                    }
                    dir="ltr"
                  />
                </Field>
              </div>

              <Field label={t('admin.color')}>
                <div className="flex gap-2 flex-wrap mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        editingStaff.color === c ? 'scale-110 border-black' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditingStaff({ ...editingStaff, color: c })}
                    />
                  ))}
                </div>
              </Field>

              <Field label={t('admin.linkedServices')}>
                {allServices.length === 0 ? (
                  <p className="text-sm opacity-70">{t('admin.noServicesYet')}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
                    {allServices.map((svc) => (
                      <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer">
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
                        <span className="truncate">{svc.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </Field>

              <div className="modal-actions">
                <Button type="submit" loading={busy} variant="primary">
                  {t('common.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingStaff(null)}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
