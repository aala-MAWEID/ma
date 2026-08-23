import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Field, Input, Select, Spinner } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenant, useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { formatMoney } from '@/lib/money'
import { normalizePhone } from '@/lib/validation'
import { errorCodeOf, errorKey } from '@/data/errors'
import type { QueueTicket } from '@/data/domain'

export default function QueueLive() {
  const { t, locale } = useLocale()
  const { reload } = useTenant()
  const bundle = useTenantBundle()
  const { slug } = useParams()
  const toast = useToast()

  const [tickets, setTickets] = useState<QueueTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [myTicketId, setMyTicketId] = useState<string | null>(null)

  // Join form state
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [serviceId, setServiceId] = useState(bundle.services[0]?.id ?? '')
  const [staffId, setStaffId] = useState(bundle.staff[0]?.id ?? '')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const loadQueue = async () => {
    try {
      const q = await data.getQueue(bundle.tenant.id)
      setTickets(q)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    loadQueue()
    const unsub = data.subscribeBookings(bundle.tenant.id, () => {
      loadQueue()
    })
    const timer = setInterval(loadQueue, 15000)
    return () => {
      unsub()
      clearInterval(timer)
    }
  }, [bundle.tenant.id])

  const serving = tickets.filter((t) => t.status === 'serving')
  const waiting = tickets.filter((t) => t.status !== 'serving' && t.status !== 'completed' && t.status !== 'cancelled')

  const myTicket = myTicketId ? tickets.find((t) => t.id === myTicketId) : null

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const normPhone = normalizePhone(phone)
    if (!normPhone) {
      setJoinError(t('error.invalid_phone'))
      return
    }
    if (!fullName.trim()) {
      setJoinError(t('error.invalid_name'))
      return
    }

    setJoining(true)
    setJoinError(null)
    try {
      const b = await data.queueJoin(
        bundle.tenant.slug,
        serviceId,
        staffId,
        fullName.trim(),
        normPhone,
        notes.trim() || null,
      )
      setMyTicketId(b.id)
      setShowJoinModal(false)
      toast(t('queue.joinedSuccess'), 'ok')
      await loadQueue()
    } catch (err) {
      setJoinError(t(errorKey(errorCodeOf(err))))
    } finally {
      setJoining(false)
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
    <div className="wrap queue-live">
      <div className="queue-live__header">
        <div>
          <h1 className="queue-live__title">{t('queue.title')}</h1>
          <p className="queue-live__subtitle">
            {t('queue.subtitle', { name: bundle.tenant.name })}
          </p>
        </div>
        <Button onClick={() => setShowJoinModal(true)} variant="primary">
          {t('queue.joinNow')}
        </Button>
      </div>

      {myTicket && (
        <div className="queue-my-ticket">
          <div className="queue-my-ticket__badge">
            {myTicket.status === 'serving' ? t('status.serving') : t('queue.yourTurn')}
          </div>
          <div className="queue-my-ticket__content">
            <div>
              <h3>{myTicket.customerName}</h3>
              <p>
                {t('common.code')}: <code>{myTicket.code}</code> · {myTicket.serviceName} (
                {myTicket.staffName})
              </p>
            </div>
            <div className="queue-my-ticket__pos">
              <span className="num">#{myTicket.position}</span>
              <span className="eta">
                {myTicket.status === 'serving'
                  ? t('queue.inChair')
                  : `${t('queue.eta')} ~${myTicket.etaMinutes} ${t('common.minutes')}`}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="queue-grid">
        {/* Currently Serving */}
        <section className="queue-card">
          <div className="queue-card__head is-serving">
            <h2>{t('queue.nowServing')}</h2>
            <span className="count-pill">{serving.length}</span>
          </div>

          {serving.length === 0 ? (
            <div className="queue-empty">
              <p>{t('queue.chairFree')}</p>
            </div>
          ) : (
            <ul className="queue-list">
              {serving.map((ticket) => (
                <li key={ticket.id} className="queue-item is-serving">
                  <div className="queue-item__main">
                    <span className="queue-item__code">#{ticket.code}</span>
                    <div>
                      <h4 className="queue-item__name">{ticket.customerName}</h4>
                      <p className="queue-item__srv">
                        {ticket.serviceName} · {ticket.staffName}
                      </p>
                    </div>
                  </div>
                  <span className="status-pill status-pill--serving">
                    {t('status.serving')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Waiting List */}
        <section className="queue-card">
          <div className="queue-card__head">
            <h2>{t('queue.waitingList')}</h2>
            <span className="count-pill">{waiting.length}</span>
          </div>

          {waiting.length === 0 ? (
            <div className="queue-empty">
              <p>{t('queue.noWaiters')}</p>
            </div>
          ) : (
            <ul className="queue-list">
              {waiting.map((ticket, idx) => (
                <li key={ticket.id} className="queue-item">
                  <div className="queue-item__pos">#{idx + 1}</div>
                  <div className="queue-item__main">
                    <div>
                      <h4 className="queue-item__name">
                        {ticket.customerName ? `${ticket.customerName.slice(0, 1)}***` : 'زبون'}
                      </h4>
                      <p className="queue-item__srv">
                        {ticket.serviceName} · {ticket.staffName}
                      </p>
                    </div>
                  </div>
                  <div className="queue-item__eta">
                    <span>~{ticket.etaMinutes} {t('common.minutes')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showJoinModal && (
        <div className="modal-backdrop" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{t('queue.joinTitle')}</h2>
            <p className="modal-desc">{t('queue.joinDesc')}</p>

            <form onSubmit={handleJoin} className="modal-form">
              {joinError && <div className="alert alert--err">{joinError}</div>}

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
                      {st.displayName} {st.title ? `(${st.title})` : ''}
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
                <Button type="submit" loading={joining} variant="primary">
                  {t('queue.confirmJoin')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowJoinModal(false)}
                >
                  {t('action.cancel')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
