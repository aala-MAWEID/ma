import { useLocale } from '@/context/LocaleContext'
import { useTenant } from '@/context/TenantContext'
import { WEEKDAY_KEYS } from '@/config/constants'
import { minutesToClock } from '@/lib/time'

export function Footer() {
  const { t } = useLocale()
  const { bundle } = useTenant()
  if (!bundle) return null
  const { tenant, workingHours } = bundle
  const shopHours = workingHours.filter((h) => h.staffId === null)

  return (
    <footer className="site-foot">
      <div className="wrap site-foot__grid">
        <section>
          <h3>{tenant.name}</h3>
          <p>{tenant.tagline}</p>
          <p>{tenant.addressLine ?? tenant.address}</p>
          <p>{tenant.city}</p>
        </section>

        <section>
          <h3>{t('nav.contact')}</h3>
          <p>
            <a href={`tel:${tenant.phone}`}>{tenant.phone}</a>
          </p>
          {tenant.whatsapp && (
            <p>
              <a
                href={`https://wa.me/${tenant.whatsapp}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t('action.whatsapp')}
              </a>
            </p>
          )}
          {tenant.email && (
            <p>
              <a href={`mailto:${tenant.email}`}>{tenant.email}</a>
            </p>
          )}
        </section>

        <section>
          <h3>{t('booking.chooseTime')}</h3>
          <ul className="hours">
            {WEEKDAY_KEYS.map((key, weekday) => {
              const windows = shopHours.filter((h) => h.weekday === weekday)
              return (
                <li key={key}>
                  <span>{t(`day.${key}`)}</span>
                  <span className="hours__value">
                    {windows.length === 0
                      ? t('common.closedNow')
                      : windows
                          .map((w) => `${minutesToClock(w.opensMin)}–${minutesToClock(w.closesMin)}`)
                          .join(' · ')}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <div className="wrap site-foot__bar">
        <small>
          © {new Date().getFullYear()} {tenant.name}
        </small>
      </div>
    </footer>
  )
}
