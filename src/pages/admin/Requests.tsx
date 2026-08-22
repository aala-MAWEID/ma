import { useEffect, useState } from 'react'
import type { FC } from 'react'
import { RequestCard } from '@/components/admin/RequestCard'
import { EmptyState, Spinner } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/context/LocaleContext'
import { useTenantBundle } from '@/context/TenantContext'
import { useToast } from '@/hooks'
import { errorCodeOf, errorKey } from '@/data/errors'
import type { AgendaItem } from '@/types/domain'

export default function Requests() {
  const { t } = useLocale()
  const bundle = useTenantBundle()
  const toast = useToast()
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    setLoading(true)
    try {
      setItems(await data.listRequests(bundle.tenant.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    return data.subscribeBookings(bundle.tenant.id, () => void reload())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.tenant.id])

  const decide = async (id: string, decision: 'confirm' | 'decline') => {
    try {
      await data.decide(id, decision)
      toast.push(t(decision === 'confirm' ? 'status.confirmed' : 'status.declined'), 'ok')
      await reload()
      return true
    } catch (e) {
      toast.push(t(errorKey(errorCodeOf(e))), 'err')
      return false
    }
  }

  return (
    <section className="admin-page">
      <header className="admin-page__head">
        <h1>
          {t('admin.requests')} ({items.length})
        </h1>
      </header>

      {loading ? (
        <Spinner size={24} />
      ) : items.length === 0 ? (
        <EmptyState icon="✓" title={t('admin.noRequests')} />
      ) : (
        <div className="requests">
          {items.map((item) => (
            <div key={item.id}>
              <RequestCard
                item={item}
                timeZone={bundle.tenant.timeZone}
                currency={bundle.tenant.currency}
                onDecide={decide}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
