import { PageHeader } from '@/components/shared/PageHeader'
import { useEffect, useState } from 'react'
import { Button, Field, Input, Spinner, EmptyState } from '@/components/ui'
import { data } from '@/data'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { formatDateTime } from '@/lib/time'
import { waLink, telLink } from '@/lib/url'
import type { Customer } from '@/data/domain'

export default function Customers() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let alive = true
    data
      .listCustomers(bundle.tenant.id)
      .then((res) => {
        if (alive) setCustomers(res)
      })
      .catch(console.error)
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [bundle.tenant.id])

  const filtered = customers.filter(
    (c) =>
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <section className="admin-page">
      <PageHeader title={`${t('admin.customers')} (${customers.length})`} description={t('admin.customersSubtitle')} />

      {loading ? (
        <div className="page-center">
          <Spinner size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="👥"
          title={t('admin.noCustomersFound')}
          body={search ? t('common.tryAnotherSearch') : undefined}
        />
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('field.fullName')}</th>
                <th>{t('field.phone')}</th>
                <th>{t('admin.bookingsCount')}</th>
                <th>{t('admin.noShowCount')}</th>
                <th>{t('admin.registeredAt')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">
                    {c.fullName}
                    {c.isBlocked && (
                      <span className="badge badge--danger ml-2 mr-2">
                        {t('status.blocked')}
                      </span>
                    )}
                  </td>
                  <td dir="ltr">{c.phone}</td>
                  <td>{c.totalBookings ?? 1}</td>
                  <td>
                    {c.noShowCount > 0 ? (
                      <span className="text-danger font-bold">{c.noShowCount}</span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td>{formatDateTime(c.createdAt, locale)}</td>
                  <td>
                    <div className="flex gap-2">
                      <a
                        href={telLink(c.phone)}
                        className="btn btn--outline btn--sm"
                        title={t('action.call')}
                      >
                        📞
                      </a>
                      <a
                        href={waLink(c.phone)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="btn btn--outline btn--sm"
                        title={t('action.whatsapp')}
                      >
                        💬
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
