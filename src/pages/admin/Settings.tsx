import { useState, type FormEvent } from 'react'
import { Button, Field, Input, Select } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle, useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { errorCodeOf, errorKey } from '@/data/errors'
import type { TenantSettings } from '@/data/domain'

export default function Settings() {
  const { t } = useLocale()
  const bundle = useTenantBundle()
  const { reload } = useTenant()
  const toast = useToast()

  const [settings, setSettings] = useState<TenantSettings>(bundle.settings)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<TenantSettings>) => setSettings((s) => ({ ...s, ...patch }))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await data.updateSettings(bundle.tenant.id, settings)
      toast(t('common.savedSuccessfully'), 'ok')
      reload()
    } catch (err) {
      toast(t(errorKey(errorCodeOf(err))), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{t('admin.settings')}</h1>
          <p className="admin-page__subtitle">{t('admin.settingsSubtitle')}</p>
        </div>
      </header>

      <form className="settings max-w-2xl bg-surface border border-border rounded-xl p-6 shadow-sm space-y-4" onSubmit={save}>
        <Field label={t('settings.confirmMode')}>
          <Select
            value={settings.autoConfirm ? 'auto' : 'manual'}
            onChange={(e) => set({ autoConfirm: e.target.value === 'auto' })}
          >
            <option value="auto">{t('settings.autoConfirm')}</option>
            <option value="manual">{t('settings.manualConfirm')}</option>
          </Select>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t('settings.slotGranularity')}>
            <Input
              type="number"
              min={5}
              max={60}
              step={5}
              value={settings.slotGranularityMin ?? 15}
              onChange={(e) => set({ slotGranularityMin: Number(e.target.value) })}
            />
          </Field>

          <Field label={t('settings.holdTtl')}>
            <Input
              type="number"
              min={1}
              max={30}
              value={settings.holdTtlMin ?? 5}
              onChange={(e) => set({ holdTtlMin: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t('settings.minNotice')}>
            <Input
              type="number"
              min={0}
              max={4320}
              step={15}
              value={settings.minNoticeMin ?? 60}
              onChange={(e) => set({ minNoticeMin: Number(e.target.value) })}
            />
          </Field>

          <Field label={t('settings.maxAdvance')}>
            <Input
              type="number"
              min={1}
              max={180}
              value={settings.maxAdvanceDays ?? 30}
              onChange={(e) => set({ maxAdvanceDays: Number(e.target.value) })}
            />
          </Field>
        </div>

        {/* Queue settings */}
        <div className="p-4 bg-muted/40 rounded-lg border border-border space-y-3">
          <h3 className="font-bold text-sm">{t('queue.settingsHeader')}</h3>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.queue_enabled ?? settings.queueEnabled ?? true}
              onChange={(e) =>
                set({
                  queue_enabled: e.target.checked,
                  queueEnabled: e.target.checked,
                })
              }
            />
            <span>{t('queue.enableQueue')}</span>
          </label>

          <Field label={t('queue.maxQueueSize')}>
            <Input
              type="number"
              min={1}
              max={50}
              value={settings.queue_max_size ?? settings.queueMaxSize ?? 20}
              onChange={(e) =>
                set({
                  queue_max_size: Number(e.target.value),
                  queueMaxSize: Number(e.target.value),
                })
              }
            />
          </Field>
        </div>

        <div className="space-y-2 pt-2">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.allowAnyStaff ?? true}
              onChange={(e) => set({ allowAnyStaff: e.target.checked })}
            />
            <span>{t('settings.allowAnyStaff')}</span>
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.showStaffPicker ?? true}
              onChange={(e) => set({ showStaffPicker: e.target.checked })}
            />
            <span>{t('settings.showStaffPicker')}</span>
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.allowCustomerCancel ?? true}
              onChange={(e) => set({ allowCustomerCancel: e.target.checked })}
            />
            <span>{t('settings.allowCustomerCancel')}</span>
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.allowCustomerReschedule ?? true}
              onChange={(e) => set({ allowCustomerReschedule: e.target.checked })}
            />
            <span>{t('settings.allowCustomerReschedule')}</span>
          </label>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.requireEmail ?? false}
              onChange={(e) => set({ requireEmail: e.target.checked })}
            />
            <span>{t('settings.requireEmail')}</span>
          </label>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <Button type="submit" loading={busy} variant="primary">
            {t('action.save')}
          </Button>
        </div>
      </form>
    </section>
  )
}
