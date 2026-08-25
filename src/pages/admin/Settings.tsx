import { useState, useEffect, type FormEvent } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button, Field, Input, Select } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle, useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { errorCodeOf, errorKey } from '@/data/errors'
import type { TenantSettings, SettingFieldSchema } from '@/data/domain'

export default function Settings() {
  const { t } = useLocale()
  const bundle = useTenantBundle()
  const { reload } = useTenant()
  const toast = useToast()

  const [settings, setSettings] = useState<TenantSettings>(bundle.settings)
  const [schema, setSchema] = useState<Record<string, SettingFieldSchema>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    data.getSettingsSchema()
      .then((s) => {
        if (alive) setSchema(s)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

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

  const slotGranularitySchema = schema['slot_granularity_min']
  const minNoticeSchema = schema['min_notice_min']
  const maxAdvanceSchema = schema['max_advance_days']
  const holdTtlSchema = schema['hold_ttl_min']
  const queueMaxSizeSchema = schema['queue_max_size']

  return (
    <section className="admin-page">
      <PageHeader title={t('admin.settings')} description={t('admin.settingsSubtitle')} />

      <form
        className="settings max-w-3xl bg-surface border border-border rounded-xl p-6 shadow-sm space-y-6"
        onSubmit={save}
      >
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
          {slotGranularitySchema && (
            <Field label={t('settings.slotGranularity')}>
              <Input
                type="number"
                min={slotGranularitySchema.min ?? undefined}
                max={slotGranularitySchema.max ?? undefined}
                step={slotGranularitySchema.step ?? undefined}
                value={settings.slotGranularityMin ?? ''}
                onChange={(e) => set({ slotGranularityMin: Number(e.target.value) })}
              />
            </Field>
          )}

          {holdTtlSchema && (
            <Field label={t('settings.holdTtl')}>
              <Input
                type="number"
                min={holdTtlSchema.min ?? undefined}
                max={holdTtlSchema.max ?? undefined}
                step={holdTtlSchema.step ?? undefined}
                value={settings.holdTtlMin ?? ''}
                onChange={(e) => set({ holdTtlMin: Number(e.target.value) })}
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {minNoticeSchema && (
            <Field label={t('settings.minNotice')}>
              <Input
                type="number"
                min={minNoticeSchema.min ?? undefined}
                max={minNoticeSchema.max ?? undefined}
                step={minNoticeSchema.step ?? undefined}
                value={settings.minNoticeMin ?? ''}
                onChange={(e) => set({ minNoticeMin: Number(e.target.value) })}
              />
            </Field>
          )}

          {maxAdvanceSchema && (
            <Field label={t('settings.maxAdvance')}>
              <Input
                type="number"
                min={maxAdvanceSchema.min ?? undefined}
                max={maxAdvanceSchema.max ?? undefined}
                step={maxAdvanceSchema.step ?? undefined}
                value={settings.maxAdvanceDays ?? ''}
                onChange={(e) => set({ maxAdvanceDays: Number(e.target.value) })}
              />
            </Field>
          )}
        </div>

        {/* Queue settings */}
        <div className="p-4 bg-muted/40 rounded-lg border border-border space-y-3">
          <h3 className="font-bold text-sm">{t('queue.settingsHeader')}</h3>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.queueEnabled ?? true}
              onChange={(e) => set({ queueEnabled: e.target.checked })}
            />
            <span>{t('queue.enableQueue')}</span>
          </label>

          {queueMaxSizeSchema && (
            <Field label={t('queue.maxQueueSize')}>
              <Input
                type="number"
                min={queueMaxSizeSchema.min ?? undefined}
                max={queueMaxSizeSchema.max ?? undefined}
                step={queueMaxSizeSchema.step ?? undefined}
                value={settings.queueMaxSize ?? ''}
                onChange={(e) => set({ queueMaxSize: Number(e.target.value) })}
              />
            </Field>
          )}
        </div>

        {/* Price Visibility */}
        <div className="p-4 bg-muted/40 rounded-lg border border-border space-y-2">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.showPrices ?? true}
              onChange={(e) => set({ showPrices: e.target.checked })}
            />
            <span className="font-medium">{t('settings.showPrices')}</span>
          </label>
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
