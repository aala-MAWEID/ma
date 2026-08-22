import { Link, useParams } from 'react-router-dom'
import { Header } from '@/components/shared/Header'
import { Footer } from '@/components/shared/Footer'
import { useLocale } from '@/context/LocaleContext'
import { useTenantBundle } from '@/context/TenantContext'
import { useOpenNow } from '@/hooks'
import { formatMoney } from '@/lib/money'

export default function Home() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const { slug } = useParams()
  const openNow = useOpenNow(bundle)
  const { tenant } = bundle

  return (
    <>
      <Header />

      <main>
        <section className="hero">
          <div className="wrap hero__inner">
            <p className="hero__eyebrow">{tenant.tagline}</p>
            <h1 className="hero__title">{tenant.name}</h1>
            <p className="hero__lead">
              {tenant.addressLine ?? tenant.address} · {tenant.city}
            </p>

            <div className="hero__actions">
              <Link to={`/${slug}/book`} className="btn btn--primary btn--lg">
                {t('action.book')}
              </Link>
              {tenant.whatsapp && (
                <a
                  className="btn btn--outline btn--lg"
                  href={`https://wa.me/${tenant.whatsapp}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {t('action.whatsapp')}
                </a>
              )}
            </div>

            <p className={openNow ? 'hero__state is-open' : 'hero__state is-closed'}>
              {t(openNow ? 'common.openNow' : 'common.closedNow')}
            </p>
          </div>
        </section>

        <section className="wrap section">
          <h2 className="section__title">{t('nav.services')}</h2>
          <div className="service-list service-list--preview">
            {bundle.services.map((service) => (
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
                  <span className="service-card__price">
                    {formatMoney(service.priceCentimes, tenant.currency, locale)}
                  </span>
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
            {bundle.staff.map((person) => (
              <div
                key={person.id}
                className="staff-card is-static"
                style={{ ['--card-accent' as string]: person.color }}
              >
                <span className="staff-card__avatar" aria-hidden="true">
                  {person.displayName.slice(0, 1)}
                </span>
                <span className="staff-card__name">{person.displayName}</span>
                {person.title && <span className="staff-card__role">{person.title}</span>}
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
