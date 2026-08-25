import { PageHeader } from '@/components/shared/PageHeader'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenant, useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { Button, Field, Input, Spinner } from '@/components/ui'
import { WEEKDAY_KEYS } from '@/config/constants'
import { data } from '@/data'

type Win = { opensMin: number; closesMin: number }
type Day = { weekday: number; windows: Win[] }
type Closed = { day: string; label: string | null }

function toHM(m: number) {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
function toMin(v: string) {
  const parts = v.split(':').map((x) => Number(x))
  const h = parts[0]
  const m = parts[1]
  if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

export default function Hours() {
  const bundle = useTenantBundle()
  const { reload } = useTenant()
  const { t } = useLocale()
  const toast = useToast()
  const tenantId = bundle.tenant.id

  const [week, setWeek] = useState<Day[] | null>(null)
  const [baseline, setBaseline] = useState<string>('')
  const dirty = week !== null && JSON.stringify(week) !== baseline
  const [closed, setClosed] = useState<Closed[]>([])
  const [newDay, setNewDay] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const build = useCallback(() => {
    const rows = (bundle.workingHours ?? []) as Array<{
      weekday: number
      opensMin: number
      closesMin: number
      staffId: string | null
    }>
    const base: Day[] = Array.from({ length: 7 }, (_, i) => ({ weekday: i, windows: [] }))
    rows
      .filter((r) => !r.staffId)
      .forEach((r) => {
        const target = base[r.weekday]
        if (target) {
          target.windows.push({ opensMin: r.opensMin, closesMin: r.closesMin })
        }
      })
    base.forEach((d) => d.windows.sort((a, b) => a.opensMin - b.opensMin))
    return base
  }, [bundle.workingHours])

  useEffect(() => {
    const fresh = build()
    setWeek(fresh)
    setBaseline(JSON.stringify(fresh))
    data
      .listClosedDates(tenantId)
      .then((r) => setClosed(r as Closed[]))
      .catch((e) => console.error('[maweid] listClosedDates failed', e))
  }, [build, tenantId])

  useEffect(() => {
    if (!dirty) return
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  function patch(weekday: number, index: number, key: keyof Win, value: string) {
    if (!week) return
    const min = toMin(value)
    if (min === null) { toast.error(t('error.invalid_hours')); return }
    const next = week.map((d) =>
      d.weekday !== weekday
        ? d
        : { ...d, windows: d.windows.map((w, i) => (i === index ? { ...w, [key]: min } : w)) },
    )
    setWeek(next)
  }

  function addWindow(weekday: number) {
    if (!week) return
    setWeek(
      week.map((d) =>
        d.weekday !== weekday ? d : { ...d, windows: [...d.windows, { opensMin: 540, closesMin: 780 }] },
      ),
    )
  }

  function removeWindow(weekday: number, index: number) {
    if (!week) return
    setWeek(
      week.map((d) =>
        d.weekday !== weekday ? d : { ...d, windows: d.windows.filter((_, i) => i !== index) },
      ),
    )
  }

  async function save() {
    if (!week) return
    for (const d of week) {
      for (const w of d.windows) {
        if (w.closesMin <= w.opensMin) {
          toast.error(t('error.invalid_hours'))
          return
        }
      }
    }
    setBusy(true)
    try {
      await data.setWeekHours(tenantId, null, week)
      setBaseline(JSON.stringify(week))
      await reload()
      toast.success(t('common.saved'))
    } catch (e) {
      toast.error(t('error.invalid_hours'))
      console.error('[maweid] setWeekHours failed', e)
    } finally {
      setBusy(false)
    }
  }

  async function addClosed() {
    if (!newDay) return
    setBusy(true)
    try {
      const rows = await data.upsertClosedDate(tenantId, newDay, newLabel || undefined)
      setClosed(rows as Closed[])
      setNewDay('')
      setNewLabel('')
      await reload()
    } catch (e) {
      toast.error(t('error.unknown'))
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  async function removeClosed(day: string) {
    setBusy(true)
    try {
      const rows = await data.deleteClosedDate(tenantId, day)
      setClosed(rows as Closed[])
      await reload()
    } catch (e) {
      toast.error(t('error.unknown'))
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  if (!week) {
    return (
      <div className="page-center">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <section className="admin-page" dir="rtl">
      <PageHeader title={t('admin.hours')} description={t('admin.hoursSubtitle')} />

      <div style={{ display: 'grid', gap: 10 }}>
        {week.map((d) => (
          <article
            key={d.weekday}
            style={{ padding: 12, border: '1px solid rgba(0,0,0,.1)', borderRadius: 12 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{t(`weekday.${WEEKDAY_KEYS[d.weekday]}`)}</strong>
              <Button size="sm" variant="outline" onClick={() => addWindow(d.weekday)}>
                {t('admin.addWindow')}
              </Button>
            </div>

            {d.windows.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.7, margin: '8px 0 0' }}>{t('common.closed')}</p>
            ) : (
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {d.windows.map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
                    <Field label={t('common.from')}>
                      <Input
                        type="time"
                        value={toHM(w.opensMin)}
                        onChange={(e) => patch(d.weekday, i, 'opensMin', e.target.value)}
                      />
                    </Field>
                    <Field label={t('common.to')}>
                      <Input
                        type="time"
                        value={toHM(w.closesMin)}
                        onChange={(e) => patch(d.weekday, i, 'closesMin', e.target.value)}
                      />
                    </Field>
                    <Button size="sm" variant="quiet" onClick={() => removeWindow(d.weekday, i)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="save-bar" role="region" aria-label={t('common.save')}>
        <span className="save-bar__state">
          {dirty ? t('common.unsavedChanges') : t('common.allSaved')}
        </span>
        <div className="save-bar__actions">
          <Button variant="quiet" disabled={!dirty || busy} onClick={() => { const fresh = build(); setWeek(fresh); setBaseline(JSON.stringify(fresh)) }}>
            {t('common.discard')}
          </Button>
          <Button variant="primary" disabled={!dirty} loading={busy} onClick={() => void save()}>
            {t('common.saveHours')}
          </Button>
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>{t('admin.closedDates')}</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <Field label={t('admin.day')}>
          <Input type="date" value={newDay} onChange={(e) => setNewDay(e.target.value)} />
        </Field>
        <Field label={t('admin.reason')}>
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        </Field>
        <Button variant="outline" loading={busy} onClick={addClosed}>
          {t('common.add')}
        </Button>
      </div>

      <ul style={{ marginTop: 12, display: 'grid', gap: 6, listStyle: 'none', padding: 0 }}>
        {closed.map((c) => (
          <li key={c.day} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <code dir="ltr">{c.day}</code>
            <span style={{ flex: 1, opacity: 0.75 }}>{c.label ?? ''}</span>
            <Button size="sm" variant="quiet" onClick={() => removeClosed(c.day)}>
              {t('common.delete')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
