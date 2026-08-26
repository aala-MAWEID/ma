import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button, Field, Input, Modal, Select, Spinner } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useShopSwitch, useQueueBoard } from '@/hooks/useQueueCore'
import { formatMoney } from '@/lib/money'
import { waLink, telLink } from '@/lib/url'
import { normalizePhone } from '@/lib/validation'
import { formatTime } from '@/lib/time'
import { errorCodeOf, errorKey } from '@/data/errors'

export default function QueueBoard() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const toast = useToast()
  const perms = usePermissions()

  const tenantId = bundle.tenant.id
  const slug = bundle.tenant.slug
  const timeZone = bundle.tenant.timeZone ?? 'Africa/Casablanca'

  const {
    open,
    note: switchNote,
    changedAt,
    busy: switchBusy,
    apply: applySwitch,
    setOpen,
    setNote: setSwitchNote,
    setChangedAt,
  } = useShopSwitch(tenantId)

  const {
    board,
    loading,
    error: boardError,
    acting,
    refresh,
    serve,
    finish,
    moveBy,
    place,
  } = useQueueBoard(tenantId)

  // Sync initial shop status from board or bundle
  useEffect(() => {
    if (board) {
      setOpen(board.shopOpen)
      setSwitchNote(board.shopNote)
    }
  }, [board?.shopOpen, board?.shopNote, setOpen, setSwitchNote])

  // Walk-in modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [serviceId, setServiceId] = useState(bundle.services[0]?.id ?? '')
  const [staffId, setStaffId] = useState(bundle.staff[0]?.id ?? '')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [addingWalkin, setAddingWalkin] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Custom position modal
  const [movingTicketId, setMovingTicketId] = useState<string | null>(null)
  const [customPos, setCustomPos] = useState<number>(1)

  const handleToggleShop = async () => {
    const nextState = !open
    try {
      await applySwitch(nextState)
      toast(nextState ? t('admin.shopOpenNow') : t('admin.shopClosedNow'), 'ok')
      await refresh()
    } catch (e) {
      toast(t(errorKey(errorCodeOf(e))), 'err')
    }
  }

  const handleServe = async (id: string) => {
    try {
      await serve(id)
      toast(t('status.serving'), 'ok')
    } catch (e) {
      toast(t(errorKey(errorCodeOf(e))), 'err')
    }
  }

  const handleFinish = async (id: string, outcome: 'completed' | 'no_show') => {
    try {
      await finish(id, outcome)
      toast(outcome === 'completed' ? t('action.complete') : t('admin.noShow'), 'ok')
    } catch (e) {
      toast(t(errorKey(errorCodeOf(e))), 'err')
    }
  }

  const handleMove = async (id: string, delta: number) => {
    try {
      await moveBy(id, delta)
      toast(t('common.savedSuccessfully'), 'ok')
    } catch (e) {
      toast(t(errorKey(errorCodeOf(e))), 'err')
    }
  }

  const handleCustomPlace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!movingTicketId) return
    try {
      await place(movingTicketId, customPos)
      toast(t('common.savedSuccessfully'), 'ok')
      setMovingTicketId(null)
    } catch (e) {
      toast(t(errorKey(errorCodeOf(e))), 'err')
    }
  }

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault()
    const normPhone = normalizePhone(phone)
    if (!normPhone) {
      setFormError(t('error.invalid_phone'))
      return
    }
    if (!fullName.trim()) {
      setFormError(t('error.invalid_name'))
      return
    }

    setAddingWalkin(true)
    setFormError(null)
    try {
      await data.queueTake({
        slug,
        serviceId,
        staffId: staffId || null,
        fullName: fullName.trim(),
        phone: normPhone,
        notes: notes.trim() || null,
      })
      setShowAddModal(false)
      setFullName('')
      setPhone('')
      setNotes('')
      toast(t('queue.joinedSuccess'), 'ok')
      await refresh()
    } catch (e) {
      setFormError(t(errorKey(errorCodeOf(e))))
    } finally {
      setAddingWalkin(false)
    }
  }

  const isShopOpen = open ?? board?.shopOpen ?? true
  const servingList = board?.serving ?? []
  const waitingList = board?.waiting ?? []

  if (loading && !board) {
    return (
      <div className="page-center">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <section className="admin-page admin-queue-board" id="admin-queue-page">
      <PageHeader
        title={t('admin.queue')}
        description={t('queue.boardSubtitle', { count: waitingList.length })}
        actions={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button
              id="btn-add-walkin"
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(true)}
            >
              + {t('admin.addWalkIn')}
            </Button>
            <Button
              id="btn-toggle-shop"
              variant={isShopOpen ? 'primary' : 'outline'}
              size="sm"
              loading={switchBusy}
              onClick={handleToggleShop}
              style={{
                borderColor: isShopOpen ? 'var(--mw-brand)' : 'var(--mw-err, #d32f2f)',
                color: isShopOpen ? '#fff' : 'var(--mw-err, #d32f2f)',
                background: isShopOpen ? 'var(--mw-brand)' : 'transparent',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: isShopOpen ? '#4ade80' : '#ef4444',
                  marginInlineEnd: 6,
                }}
              />
              {isShopOpen ? t('admin.shopOpenNow') : t('admin.shopClosedNow')}
            </Button>
          </div>
        }
      />

      {/* Shop Status Banner when closed */}
      {!isShopOpen && (
        <div
          id="shop-closed-banner"
          style={{
            marginBottom: 20,
            padding: '14px 18px',
            borderRadius: 12,
            backgroundColor: 'var(--mw-surface-2, rgba(239,68,68,0.08))',
            border: '1px solid var(--mw-err, #ef4444)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: 'var(--mw-err, #dc2626)' }}>
              ⚠️ {t('admin.shopClosedBanner')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mw-ink-muted, #6b7280)', marginTop: 2 }}>
              {t('admin.shopClosedHint')} · {t('admin.hoursAreAdvisory')}
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            loading={switchBusy}
            onClick={handleToggleShop}
          >
            {t('admin.startWork')}
          </Button>
        </div>
      )}

      {/* Serving Strip (Chairs) */}
      <div className="queue-board-serving-strip" id="queue-serving-strip">
        <h2 className="strip-title">{t('admin.nowServing')}</h2>
        {servingList.length === 0 ? (
          <div className="strip-empty">
            <span>{t('admin.chairFree')}</span>
            {perms.reorder_queue && waitingList.length > 0 && (
              <Button
                id="btn-serve-first"
                size="sm"
                variant="primary"
                loading={acting === waitingList[0]?.id}
                onClick={() => handleServe(waitingList[0]!.id)}
              >
                {t('admin.serveNow')} (#{waitingList[0]!.pos} - {waitingList[0]!.customerName})
              </Button>
            )}
          </div>
        ) : (
          <div className="strip-cards">
            {servingList.map((srv) => (
              <div key={srv.id} className="serving-card" id={`serving-card-${srv.id}`}>
                <div className="serving-card__head">
                  <span className="code">#{srv.code || srv.id.slice(0, 6)}</span>
                  <span className="staff-tag" style={{ borderColor: srv.staffColor ?? undefined }}>
                    {srv.staffName}
                  </span>
                </div>
                <div className="serving-card__body">
                  <h3 className="name">{srv.customerName}</h3>
                  <p className="service">
                    {srv.serviceName} ({srv.durationMin} {t('common.minutes')})
                  </p>
                  {srv.customerPhone && (
                    <div className="contacts">
                      <a href={telLink(srv.customerPhone)} className="link-action">
                        📞 {srv.customerPhone}
                      </a>
                      <a
                        href={waLink(srv.customerPhone)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="link-action"
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  )}
                  {srv.servedAt && (
                    <div style={{ fontSize: 12, color: 'var(--mw-ink-muted, #6b7280)', marginTop: 4 }}>
                      {t('common.at')}: {formatTime(srv.servedAt, timeZone, locale)}
                    </div>
                  )}
                </div>
                <div className="serving-card__actions">
                  <Button
                    id={`btn-finish-${srv.id}`}
                    size="sm"
                    variant="primary"
                    loading={acting === srv.id}
                    onClick={() => handleFinish(srv.id, 'completed')}
                  >
                    ✓ {t('admin.finish')}
                  </Button>
                  <Button
                    id={`btn-noshow-${srv.id}`}
                    size="sm"
                    variant="outline"
                    loading={acting === srv.id}
                    onClick={() => handleFinish(srv.id, 'no_show')}
                  >
                    {t('admin.noShow')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Waiting Queue List */}
      <div className="queue-board-waiting" id="queue-waiting-section">
        <div className="waiting-head">
          <h2>
            {t('admin.waitingList')} ({waitingList.length})
          </h2>
        </div>

        {waitingList.length === 0 ? (
          <div className="queue-empty-box">
            <p>{t('queue.noWaiters')}</p>
          </div>
        ) : (
          <div className="waiting-list">
            {waitingList.map((w, idx) => (
              <div key={w.id} className="waiting-row" id={`waiting-row-${w.id}`}>
                <div className="pos-badge">#{w.pos}</div>

                <div className="info-block">
                  <div className="title-row">
                    <span className="name">{w.customerName}</span>
                    <span className="code">#{w.code || w.id.slice(0, 6)}</span>
                  </div>
                  <div className="meta-row">
                    <span>{w.serviceName}</span>
                    <span>·</span>
                    <span style={{ color: w.staffColor ?? undefined }}>{w.staffName}</span>
                    <span>·</span>
                    <span>~{w.durationMin} {t('common.minutes')}</span>
                    {w.createdAt && (
                      <>
                        <span>·</span>
                        <span>{t('common.at')} {formatTime(w.createdAt, timeZone, locale)}</span>
                      </>
                    )}
                  </div>
                </div>

                {w.customerPhone && (
                  <div className="contact-block">
                    <a href={telLink(w.customerPhone)} className="btn-icon" title={w.customerPhone}>
                      📞
                    </a>
                    <a
                      href={waLink(w.customerPhone)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn-icon"
                      title="WhatsApp"
                    >
                      💬
                    </a>
                  </div>
                )}

                {perms.reorder_queue && (
                  <div className="action-buttons">
                    <Button
                      id={`btn-serve-${w.id}`}
                      size="sm"
                      variant="primary"
                      loading={acting === w.id}
                      onClick={() => handleServe(w.id)}
                    >
                      {t('admin.serveNow')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title={t('queue.advance')}
                      disabled={idx === 0 || acting === w.id}
                      onClick={() => handleMove(w.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title={t('queue.skip')}
                      disabled={idx === waitingList.length - 1 || acting === w.id}
                      onClick={() => handleMove(w.id, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      title={t('admin.moveTo')}
                      onClick={() => {
                        setMovingTicketId(w.id)
                        setCustomPos(w.pos)
                      }}
                    >
                      #
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Walk-in Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('admin.addWalkIn')}
        footer={
          <>
            <Button
              variant="quiet"
              onClick={() => setShowAddModal(false)}
              disabled={addingWalkin}
            >
              {t('action.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={(e) => void handleAddWalkIn(e)}
              loading={addingWalkin}
            >
              {t('action.add')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddWalkIn} className="modal-form">
          {formError && <div className="alert alert--err">{formError}</div>}

          <Field label={t('field.fullName')}>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('field.fullName')}
              required
            />
          </Field>

          <Field label={t('field.phone')}>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              dir="ltr"
              placeholder="0612345678"
              required
            />
          </Field>

          <Field label={t('step.service')}>
            <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {bundle.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMin} {t('common.minutes')} -{' '}
                  {formatMoney(s.priceCentimes, bundle.tenant.currency, locale)})
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('step.staff')}>
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              {bundle.staff.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.displayName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('field.notes')}>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('field.notesPlaceholder')}
            />
          </Field>

          <button type="submit" hidden />
        </form>
      </Modal>

      {/* Custom Place Modal */}
      <Modal
        open={Boolean(movingTicketId)}
        onClose={() => setMovingTicketId(null)}
        title={t('admin.moveTo')}
        footer={
          <>
            <Button variant="quiet" onClick={() => setMovingTicketId(null)}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" onClick={(e) => void handleCustomPlace(e)}>
              {t('action.save')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCustomPlace} className="modal-form">
          <Field label={t('queue.yourNumber')}>
            <Input
              type="number"
              min={1}
              max={100}
              value={customPos}
              onChange={(e) => setCustomPos(Number(e.target.value) || 1)}
              required
            />
          </Field>
          <button type="submit" hidden />
        </form>
      </Modal>
    </section>
  )
}
