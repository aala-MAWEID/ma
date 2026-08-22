import { useEffect, useState } from 'react'
import { Button, Field, Input, Select, Spinner } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { formatMoney } from '@/lib/money'
import { waLink, telLink } from '@/lib/url'
import { normalizePhone } from '@/lib/validation'
import { errorCodeOf, errorKey } from '@/data/errors'
import type { QueueTicket } from '@/data/domain'

export default function QueueBoard() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const toast = useToast()
  const perms = usePermissions()

  const [tickets, setTickets] = useState<QueueTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all')
  const [busyAction, setBusyAction] = useState<string | null>(null)

  // Walk-in modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [serviceId, setServiceId] = useState(bundle.services[0]?.id ?? '')
  const [staffId, setStaffId] = useState(bundle.staff[0]?.id ?? '')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const loadQueue = async () => {
    try {
      const q = await data.getQueue(bundle.tenant.id)
      setTickets(q)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
    const unsub = data.subscribeBookings(bundle.tenant.id, () => {
      loadQueue()
    })
    return () => unsub()
  }, [bundle.tenant.id])

  const filteredTickets =
    selectedStaffId === 'all'
      ? tickets
      : tickets.filter((t) => t.staffId === selectedStaffId)

  const servingTickets = filteredTickets.filter((t) => t.status === 'serving')
  const waitingTickets = filteredTickets.filter(
    (t) => t.status !== 'serving' && t.status !== 'completed' && t.status !== 'cancelled',
  )

  const handleNext = async (staffTarget: string | null = null, closeAs: 'completed' | 'no_show' = 'completed') => {
    setBusyAction('next')
    try {
      const target = staffTarget || (selectedStaffId !== 'all' ? selectedStaffId : null)
      const res = await data.queueNext(bundle.tenant.id, target, closeAs)
      if (res.nextName) {
        toast(`${t('queue.nowServing')}: ${res.nextName}`, 'ok')
      } else {
        toast(t('queue.noWaiters'), 'info')
      }
      await loadQueue()
    } catch (e) {
      toast(t(errorKey(errorCodeOf(e))), 'err')
    } finally {
      setBusyAction(null)
    }
  }

  const handleAdvance = async (id: string, places?: number) => {
    setBusyAction(`adv-${id}`)
    try {
      await data.queueAdvance(id, places)
      toast(t('queue.advancedSuccess'), 'ok')
      await loadQueue()
    } catch (e) {
      toast(t(errorKey(errorCodeOf(e))), 'err')
    } finally {
      setBusyAction(null)
    }
  }

  const handleSkip = async (id: string, places: number = 1) => {
    setBusyAction(`skip-${id}`)
    try {
      await data.queueSkip(id, places)
      toast(t('queue.skippedSuccess'), 'ok')
      await loadQueue()
    } catch (e) {
      toast(t(errorKey(errorCodeOf(e))), 'err')
    } finally {
      setBusyAction(null)
    }
  }

  const handleCall = async (id: string) => {
    setBusyAction(`call-${id}`)
    try {
      await data.queueCall(id)
      toast(t('status.serving'), 'ok')
      await loadQueue()
    } catch (e) {
      toast(t(errorKey(errorCodeOf(e))), 'err')
    } finally {
      setBusyAction(null)
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

    setBusyAction('add-walkin')
    setFormError(null)
    try {
      await data.queueJoin(
        bundle.tenant.slug,
        serviceId,
        staffId,
        fullName.trim(),
        normPhone,
        notes.trim() || null,
      )
      setShowAddModal(false)
      setFullName('')
      setPhone('')
      setNotes('')
      toast(t('queue.joinedSuccess'), 'ok')
      await loadQueue()
    } catch (e) {
      setFormError(t(errorKey(errorCodeOf(e))))
    } finally {
      setBusyAction(null)
    }
  }

  if (loading && tickets.length === 0) {
    return (
      <div className="page-center">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <section className="admin-page admin-queue-board">
      <header className="admin-page__head">
        <div>
          <h1 className="admin-page__title">{t('admin.queue')}</h1>
          <p className="admin-page__subtitle">
            {t('queue.boardSubtitle', { count: waitingTickets.length })}
          </p>
        </div>

        <div className="admin-page__actions">
          <Select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="w-auto"
          >
            <option value="all">{t('admin.allStaff')}</option>
            {bundle.staff.map((st) => (
              <option key={st.id} value={st.id}>
                {st.displayName}
              </option>
            ))}
          </Select>

          {perms.reorder_queue && (
            <Button
              variant="primary"
              loading={busyAction === 'next'}
              onClick={() => handleNext(null, 'completed')}
            >
              ⚡ {t('queue.callNext')}
            </Button>
          )}

          <Button variant="outline" onClick={() => setShowAddModal(true)}>
            + {t('queue.addWalkIn')}
          </Button>
        </div>
      </header>

      {/* Serving Strip */}
      <div className="queue-board-serving-strip">
        <h2 className="strip-title">{t('queue.inChair')}</h2>
        {servingTickets.length === 0 ? (
          <div className="strip-empty">
            <span>{t('queue.chairFree')}</span>
            {perms.reorder_queue && waitingTickets.length > 0 && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleNext(null, 'completed')}
              >
                {t('queue.callNext')}
              </Button>
            )}
          </div>
        ) : (
          <div className="strip-cards">
            {servingTickets.map((tkt) => (
              <div key={tkt.id} className="serving-card">
                <div className="serving-card__head">
                  <span className="code">#{tkt.code}</span>
                  <span className="staff-tag" style={{ borderColor: tkt.staffColor }}>
                    {tkt.staffName}
                  </span>
                </div>
                <div className="serving-card__body">
                  <h3 className="name">{tkt.customerName}</h3>
                  <p className="service">{tkt.serviceName}</p>
                  {tkt.customerPhone && (
                    <div className="contacts">
                      <a href={telLink(tkt.customerPhone)} className="link-action">
                        📞 {tkt.customerPhone}
                      </a>
                      <a
                        href={waLink(tkt.customerPhone)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="link-action"
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  )}
                </div>
                <div className="serving-card__actions">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busyAction === 'next'}
                    onClick={() => handleNext(tkt.staffId, 'completed')}
                  >
                    ✓ {t('action.complete')} & {t('queue.callNext')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busyAction === 'next'}
                    onClick={() => handleNext(tkt.staffId, 'no_show')}
                  >
                    {t('action.noShow')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Waiting Queue List */}
      <div className="queue-board-waiting">
        <div className="waiting-head">
          <h2>{t('queue.waitingList')} ({waitingTickets.length})</h2>
        </div>

        {waitingTickets.length === 0 ? (
          <div className="queue-empty-box">
            <p>{t('queue.noWaiters')}</p>
          </div>
        ) : (
          <div className="waiting-list">
            {waitingTickets.map((tkt, idx) => (
              <div key={tkt.id} className="waiting-row">
                <div className="pos-badge">#{idx + 1}</div>

                <div className="info-block">
                  <div className="title-row">
                    <span className="name">{tkt.customerName}</span>
                    <span className="code">#{tkt.code}</span>
                    {tkt.skippedCount > 0 && (
                      <span className="skipped-tag">
                        ⚠️ {tkt.skippedCount}x {t('queue.skipped')}
                      </span>
                    )}
                  </div>
                  <div className="meta-row">
                    <span>{tkt.serviceName}</span>
                    <span>·</span>
                    <span style={{ color: tkt.staffColor }}>{tkt.staffName}</span>
                    <span>·</span>
                    <span>~{tkt.etaMinutes} {t('common.minutes')}</span>
                  </div>
                </div>

                {tkt.customerPhone && (
                  <div className="contact-block">
                    <a href={telLink(tkt.customerPhone)} className="btn-icon">
                      📞
                    </a>
                    <a
                      href={waLink(tkt.customerPhone)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="btn-icon"
                    >
                      💬
                    </a>
                  </div>
                )}

                {perms.reorder_queue && (
                  <div className="action-buttons">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busyAction === `call-${tkt.id}`}
                      onClick={() => handleCall(tkt.id)}
                    >
                      {t('queue.callNow')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title={t('queue.advanceToTop')}
                      loading={busyAction === `adv-${tkt.id}`}
                      onClick={() => handleAdvance(tkt.id)}
                    >
                      ↑ {t('queue.advance')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title={t('queue.skipBack')}
                      loading={busyAction === `skip-${tkt.id}`}
                      onClick={() => handleSkip(tkt.id, 1)}
                    >
                      ↓ {t('queue.skip')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Walk-in Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{t('queue.addWalkIn')}</h2>
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

              <div className="modal-actions">
                <Button type="submit" loading={busyAction === 'add-walkin'} variant="primary">
                  {t('action.add')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
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
