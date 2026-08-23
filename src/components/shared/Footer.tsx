import { Link, useParams } from 'react-router-dom'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'

const WA_BASE = 'https://wa.me/'

export function Footer() {
  const bundle = useTenantBundle()
  const { t } = useLocale()
  const { slug = '' } = useParams<{ slug: string }>()
  const tenant = bundle.tenant

  const waDigits = String(tenant.whatsapp ?? tenant.phone ?? '').replace(/[^0-9]/g, '')
  const waMessage = t('footer.waMessage').replace('{shop}', tenant.name ?? '')
  const waHref = waDigits ? WA_BASE + waDigits + '?text=' + encodeURIComponent(waMessage) : null
  const telHref = tenant.phone ? 'tel:' + String(tenant.phone).replace(/\s/g, '') : null
  const mailHref = tenant.email ? 'mailto:' + tenant.email : null
  const mapHref =
    tenant.lat && tenant.lng
      ? 'https://www.google.com/maps/search/?api=1&query=' + tenant.lat + ',' + tenant.lng
      : tenant.address
        ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(tenant.address)
        : null

  return (
    <footer className="site-foot" dir="rtl">
      <div className="site-foot__grid">
        <section>
          <h3>{tenant.name}</h3>
          {tenant.tagline ? <p style={{ opacity: 0.75 }}>{tenant.tagline}</p> : null}
          {tenant.address ? (
            mapHref ? (
              <p>
                <a href={mapHref} target="_blank" rel="noreferrer">
                  {tenant.address}
                  {tenant.city ? ` ، ${tenant.city}` : ''}
                </a>
              </p>
            ) : (
              <p>
                {tenant.address}
                {tenant.city ? ` ، ${tenant.city}` : ''}
              </p>
            )
          ) : null}
        </section>

        <section>
          <h3>{t('footer.contact')}</h3>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
            {mailHref ? (
              <li>
                <a href={mailHref} dir="ltr">
                  {tenant.email}
                </a>
              </li>
            ) : null}
            {telHref ? (
              <li>
                <a href={telHref} dir="ltr">
                  {tenant.phone}
                </a>
              </li>
            ) : null}
            {waHref ? (
              <li>
                <a href={waHref} target="_blank" rel="noreferrer">
                  {t('footer.whatsappBook')}
                </a>
              </li>
            ) : null}
          </ul>
        </section>

        <section>
          <h3>{t('footer.quickLinks')}</h3>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
            <li>
              <Link to={`/${slug}/book`}>{t('nav.book')}</Link>
            </li>
            <li>
              <Link to={`/${slug}/queue`}>{t('nav.queue')}</Link>
            </li>
            <li>
              <Link to={`/${slug}/me`}>{t('nav.myBookings')}</Link>
            </li>
          </ul>
        </section>
      </div>

      <div className="site-foot__bar">
        <span>
          © {new Date().getFullYear()} {tenant.name}
        </span>
      </div>
    </footer>
  )
}
