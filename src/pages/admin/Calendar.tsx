import { PageHeader } from '@/components/shared/PageHeader'
import { useState } from 'react'
import { CalendarGrid } from '@/components/admin/CalendarGrid'
import { BookingDrawer } from '@/components/admin/BookingDrawer'
import { Button } from '@/components/ui'
import { useAdminCalendar } from '@/hooks'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenantBundle } from '@/contexts/TenantContext'
import { formatDayKey } from '@/lib/time'
import type { AgendaItem } from '@/data/domain'

export default function Calendar() {
  const { t, locale } = useLocale()
  const bundle = useTenantBundle()
  const cal = useAdminCalendar()
  const [selected, setSelected] = useState<AgendaItem | null>(null)

  return (
    <section className="admin-page admin-page--full">
      <header className="admin-page__head admin-page__head--cal">
        <div className="cal-nav">
          <Button variant="outline" size="sm" onClick={cal.prevDay}>
            ‹
          </Button>
          <Button variant="outline" size="sm" onClick={cal.goToday}>
            {t('admin.today')}
          </Button>
          <Button variant="outline" size="sm" onClick={cal.nextDay}>
            ›
          </Button>
          <span className="cal-nav__title">
            {formatDayKey(cal.day, locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
        </div>
      </header>

      <CalendarGrid
        day={cal.day}
        timeZone={cal.timeZone}
        columns={cal.columns}
        byStaff={cal.byStaff}
        snapMin={bundle.settings.slotGranularityMin ?? 15}
        onOpen={setSelected}
        onMove={(p) => cal.move(p.bookingId, p.startsAt, p.staffId)}
      />

      <BookingDrawer
        item={selected}
        timeZone={cal.timeZone}
        currency={bundle.tenant.currency}
        tenantName={bundle.tenant.name}
        onClose={() => setSelected(null)}
        onDecide={cal.decide}
        onCancel={cal.cancel}
        onDelete={cal.remove}
      />
    </section>
  )
}
