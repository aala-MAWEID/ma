import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenant } from '@/contexts/TenantContext'
import { EmptyState, Price } from '@/components/ui'
import { useOpenNow } from '@/hooks'

export default function Home() {
  const { t, dir } = useLocale()
  const { bundle, tenant, reload, hours } = useTenant()
  const { slug } = useParams()
  const openNow = useOpenNow(bundle)

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!bundle) return null

  const isReady = bundle.services.length > 0 && bundle.staff.length > 0
  const services = [...bundle.services].sort((a, b) => a.sortOrder - b.sortOrder)
  const staff = [...bundle.staff].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="home-page" dir={dir}>
      <section className="hero">
        <div className="wrap hero__inner">
          {tenant.tagline && <p className="hero__eyebrow">{tenant.tagline}</p>}
          <h1 className="hero__title">{tenant.name}</h1>
          <p className="hero__lead">
            {tenant.addressLine ?? tenant.address}
            {tenant.city ? ` · ${tenant.city}` : ''}
          </p>

          <div className="hero__actions">
            {isReady ? (
              <Link to={`/${slug}/book`} className="btn btn--primary btn--lg">
                {t('action.book')}
              </Link>
            ) : null}
            {tenant.whatsapp ? (
              <a
                className="btn btn--outline btn--lg"
                href={`https://wa.me/${String(tenant.whatsapp).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  t('footer.waMessage').replace('{shop}', tenant.name ?? ''),
                )}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t('action.whatsapp')}
              </a>
            ) : null}
          </div>

          <p className={openNow ? 'hero__state is-open' : 'hero__state is-closed'}>
            {t(openNow ? 'common.openNow' : 'common.closedNow')}
          </p>
        </div>
      </section>

      {!isReady ? (
        <div className="wrap section" style={{ padding: '40px 16px' }}>
          <EmptyState
            icon="✂"
            title={t('public.notReady')}
            body={t('public.notReadyBody')}
          />
        </div>
      ) : (
        <>
          <section className="wrap section">
            <h2 className="section__title">{t('nav.services')}</h2>
            <div className="service-list service-list--preview">
              {services.map((service) => (
                <Link
                  key={service.id}
                  to={`/${slug}/book?service=${service.id}`}
                  className="service-card"
                  style={{ ['--card-accent' as string]: service.color ?? 'var(--mw-brand)' }}
                >
                  <span className="service-card__main">
                    <span className="service-card__name">{service.name}</span>
                    {service.description && (
                      <span className="service-card__desc">{service.description}</span>
                    )}
                  </span>
                  <span className="service-card__meta">
                    <Price
                      className="service-card__price"
                      amountCentimes={service.priceCentimes}
                      service={service}
                      currency={tenant.currency}
                    />
                    <span className="service-card__dur">
                      {t('booking.minutes', { n: service.durationMin })}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="wrap section">
            <h2 className="section__title">{t('booking.chooseStaff')}</h2>
            <div className="staff-list">
              {staff.map((person) => (
                <div
                  key={person.id}
                  className="staff-card is-static"
                  style={{ ['--card-accent' as string]: person.color }}
                >
                  {person.avatarUrl ? (
                    <img src={person.avatarUrl} alt="" className="staff-card__avatar" />
                  ) : (
                    <span className="staff-card__avatar" aria-hidden="true">
                      {person.displayName.slice(0, 1)}
                    </span>
                  )}
                  <span className="staff-card__name">{person.displayName}</span>
                  {person.title && <span className="staff-card__role">{person.title}</span>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {hours.length > 0 && (
        <section className="wrap section">
          <h2 className="section__title">{t('admin.hours')}</h2>
          <div className="hours-list" style={{ maxWidth: 400, margin: '0 auto' }}>
            {hours.map((h, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ fontWeight: 500 }}>{h.label}</span>
                <span style={{ color: 'var(--text-subtle)' }}>{h.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
