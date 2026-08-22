import { useState } from 'react'
import { Button, Drawer } from '@/components/ui'
import { StatusPill } from '@/components/shared/StatusPill'
import { useLocale } from '@/contexts/LocaleContext'
import { usePermissions } from '@/hooks/usePermissions'
import { formatDateTime, formatTime } from '@/lib/time'
import { formatMoney } from '@/lib/money'
import { waLink, telLink, waConfirmText } from '@/lib/url'
import type { AgendaItem, Booking } from '@/data/domain'

export function BookingDrawer({
  item,
  timeZone,
  currency,
  tenantName,
  onClose,
  onDecide,
  onCancel,
  onDelete,
}: {
  item: AgendaItem | Booking | null
  timeZone: string
  currency: string
  tenantName?: string
  onClose: () => void
  onDecide: (
    id: string,
    decision: 'confirm' | 'decline' | 'complete' | 'no_show',
  ) => Promise<boolean>
  onCancel?: (id: string, reason?: string) => Promise<boolean>
  onDelete?: (id: string, reason?: string) => Promise<boolean>
}) {
  const { t, locale } = useLocale()
  const perms = usePermissions()
  const [busy, setBusy] = useState(false)
  const [cancelPrompt, setCancelPrompt] = useState(false)
  const [deletePrompt, setDeletePrompt] = useState(false)
  const [reason, setReason] = useState('')

  if (!item) return null

  const customerName = (item as AgendaItem).customerName ?? item.notesCustomer?.split('\n')[0] ?? t('common.empty')
  const serviceName = (item as AgendaItem).serviceName ?? t('step.service')
  const staffName = (item as AgendaItem).staffName ?? t('step.staff')
  const customerPhone = (item as AgendaItem).customerPhone ?? (item.notesCustomer?.match(/0[5-7]\d{8}/)?.[0] ?? '')

  const act = async (decision: 'confirm' | 'decline' | 'complete' | 'no_show') => {
    setBusy(true)
    const ok = await onDecide(item.id, decision)
    setBusy(false)
    if (ok) onClose()
  }

  const handleCancel = async () => {
    if (!onCancel) return
    setBusy(true)
    const ok = await onCancel(item.id, reason || undefined)
    setBusy(false)
    if (ok) onClose()
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setBusy(true)
    const ok = await onDelete(item.id, reason || undefined)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={customerName}
      footer={
        <div className="drawer__actions">
          {item.status === 'pending' && perms.decide && (
            <>
              <Button loading={busy} onClick={() => void act('confirm')}>
                {t('action.approve')}
              </Button>
              <Button variant="danger" loading={busy} onClick={() => void act('decline')}>
                {t('action.decline')}
              </Button>
            </>
          )}
          {item.status === 'confirmed' && perms.decide && (
            <>
              <Button loading={busy} onClick={() => void act('complete')}>
                {t('action.complete')}
              </Button>
              <Button variant="outline" loading={busy} onClick={() => void act('no_show')}>
                {t('action.noShow')}
              </Button>
            </>
          )}
          {perms.cancel && item.status !== 'cancelled' && onCancel && (
            <Button
              variant="outline"
              loading={busy}
              onClick={() => setCancelPrompt(!cancelPrompt)}
            >
              {t('action.cancel')}
            </Button>
          )}
          {perms.delete && onDelete && (
            <Button
              variant="danger"
              loading={busy}
              onClick={() => setDeletePrompt(!deletePrompt)}
            >
              {t('action.delete')}
            </Button>
          )}
        </div>
      }
    >
      <div className="detail">
        <StatusPill status={item.status} />

        {cancelPrompt && (
          <div className="alert alert--warn">
            <p>{t('booking.confirmCancelPrompt')}</p>
            <input
              type="text"
              placeholder={t('field.reason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input mt-2 mb-2"
            />
            <div className="flex gap-2">
              <Button variant="danger" loading={busy} onClick={handleCancel}>
                {t('action.confirm')}
              </Button>
              <Button variant="outline" onClick={() => setCancelPrompt(false)}>
                {t('action.cancel')}
              </Button>
            </div>
          </div>
        )}

        {deletePrompt && (
          <div className="alert alert--err">
            <p>{t('booking.confirmDeletePrompt')}</p>
            <input
              type="text"
              placeholder={t('field.reason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input mt-2 mb-2"
            />
            <div className="flex gap-2">
              <Button variant="danger" loading={busy} onClick={handleDelete}>
                {t('action.delete')}
              </Button>
              <Button variant="outline" onClick={() => setDeletePrompt(false)}>
                {t('action.cancel')}
              </Button>
            </div>
          </div>
        )}

        <dl className="detail__list">
          <div>
            <dt>{t('step.time')}</dt>
            <dd>
              {formatDateTime(item.startsAt, timeZone, locale)} – {formatTime(item.endsAt, timeZone, locale)}
            </dd>
          </div>
          <div>
            <dt>{t('step.service')}</dt>
            <dd>{serviceName}</dd>
          </div>
          <div>
            <dt>{t('step.staff')}</dt>
            <dd>{staffName}</dd>
          </div>
          {customerPhone && (
            <div>
              <dt>{t('field.phone')}</dt>
              <dd dir="ltr">{customerPhone}</dd>
            </div>
          )}
          <div>
            <dt>{t('booking.total')}</dt>
            <dd>{formatMoney(item.priceCentimes, currency, locale)}</dd>
          </div>
          <div>
            <dt>{t('booking.yourCode')}</dt>
            <dd dir="ltr">
              <code>{item.code}</code>
            </dd>
          </div>
        </dl>

        {item.notesCustomer && <p className="detail__note">“{item.notesCustomer}”</p>}

        {customerPhone && (
          <div className="detail__contact">
            <a className="btn btn--outline btn--sm" href={telLink(customerPhone)}>
              {t('action.call')}
            </a>
            <a
              className="btn btn--outline btn--sm"
              href={waLink(
                customerPhone,
                waConfirmText(
                  customerName,
                  formatDateTime(item.startsAt, timeZone, locale),
                  tenantName ?? 'صالون الزيتونة',
                ),
              )}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('action.whatsapp')}
            </a>
          </div>
        )}
      </div>
    </Drawer>
  )
}
