import { useState } from 'react'
import { Button, Field, Input, Select } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle, useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { errorCodeOf, errorKey } from '@/data/errors'
import type { Staff } from '@/data/domain'

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

export default function StaffPage() {
  const { t } = useLocale()
  const bundle = useTenantBundle()
  const { reload } = useTenant()
  const toast = useToast()
  const perms = usePermissions()

  const [editingStaff, setEditingStaff] = useState<Partial<Staff> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingStaff?.displayName?.trim()) {
      setError(t('error.invalid_name'))
      return
    }

    setBusy(true)
    setError(null)
    try {
      await data.upsertStaff(bundle.tenant.id, {
        staffId: editingStaff.id ?? null,
        displayName: editingStaff.displayName.trim(),
        title: editingStaff.title?.trim() || undefined,
        color: editingStaff.color ?? '#0E7C86',
        isActive: editingStaff.isActive ?? true,
        sortOrder: editingStaff.sortOrder ?? bundle.staff.length + 1,
      })
      toast(t('common.savedSuccessfully'), 'ok')
      setEditingStaff(null)
      reload()
    } catch (err) {
      setError(t(errorKey(errorCodeOf(err))))
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (st: Staff) => {
    try {
      await data.upsertStaff(bundle.tenant.id, {
        staffId: st.id,
        isActive: !st.isActive,
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
          <h1 className="admin-page__title">{t('admin.staff')} ({bundle.staff.length})</h1>
          <p className="admin-page__subtitle">{t('admin.staffSubtitle')}</p>
        </div>
        {perms.edit_staff && (
          <div className="admin-page__actions">
            <Button
              variant="primary"
              onClick={() =>
                setEditingStaff({
                  displayName: '',
                  title: '',
                  color: PRESET_COLORS[0],
                  isActive: true,
                  sortOrder: bundle.staff.length + 1,
                })
              }
            >
              + {t('admin.addStaff')}
            </Button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bundle.staff.map((st) => (
          <div key={st.id} className="staff-card border rounded-xl p-4 bg-surface shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: st.color }}
              >
                {st.displayName.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg">{st.displayName}</h3>
                <p className="text-sm text-subtle">{st.title || t('admin.specialist')}</p>
              </div>
              <span
                className={`badge ${st.isActive ? 'badge--ok' : 'badge--neutral'}`}
              >
                {st.isActive ? t('status.active') : t('status.inactive')}
              </span>
            </div>

            {perms.edit_staff && (
              <div className="flex gap-2 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingStaff(st)}
                >
                  {t('action.edit')}
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => toggleActive(st)}
                >
                  {st.isActive ? t('action.deactivate') : t('action.activate')}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editingStaff && (
        <div className="modal-backdrop" onClick={() => setEditingStaff(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingStaff.id ? t('admin.editStaff') : t('admin.addStaff')}</h2>
            <form onSubmit={handleSave} className="modal-form">
              {error && <div className="alert alert--err">{error}</div>}

              <Field label={t('field.fullName')}>
                <Input
                  value={editingStaff.displayName ?? ''}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, displayName: e.target.value })
                  }
                  required
                />
              </Field>

              <Field label={t('field.title')}>
                <Input
                  value={editingStaff.title ?? ''}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, title: e.target.value })
                  }
                  placeholder={t('admin.titlePlaceholder')}
                />
              </Field>

              <Field label={t('field.color')}>
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

              <div className="modal-actions">
                <Button type="submit" loading={busy} variant="primary">
                  {t('action.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingStaff(null)}
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
