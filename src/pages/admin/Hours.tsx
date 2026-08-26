import { PageHeader } from '@/components/shared/PageHeader'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/contexts/LocaleContext'
import { useTenant, useTenantBundle } from '@/contexts/TenantContext'
import { useToast } from '@/contexts/ToastContext'
import { Button, Field, Input, Spinner } from '@/components/ui'
import { WEEKDAY_KEYS } from '@/config/constants'
import { data } from '@/data'
import { errorCodeOf, errorKey } from '@/data/errors'

type Win = { opensMin: number; closesMin: number }
type Day = { weekday: number; windows: Win[] }
type Closed = { day: string; label: string | null }

function toHM(m: number) {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function toMin(v: string) {
  if (!v) return null
  const parts = v.split(':').map((x) => Number(x))
  const h = parts[0]
  const m = parts[1]
  if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function validateDayWindows(dayLabel: string, windows: Win[]): string | null {
  if (windows.length > 5) {
    return `الحد الأقصى 5 فترات عمل في اليوم الواحد (${dayLabel})`
  }
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i]
    if (w && w.closesMin <= w.opensMin) {
      return `وقت الإغلاق يجب أن يكون بعد وقت الفتح في يوم ${dayLabel}`
    }
  }
  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length; j++) {
      const w1 = windows[i]
      const w2 = windows[j]
      if (w1 && w2 && w1.opensMin < w2.closesMin && w2.opensMin < w1.closesMin) {
        return `تداخل في أوقات العمل في يوم ${dayLabel}`
      }
    }
  }
  return null
}

export default function Hours() {
  const bundle = useTenantBundle()
  const { reload } = useTenant()
  const { t } = useLocale()
  const toast = useToast()
  const tenantId = bundle.tenant.id

  const hoursMode = bundle.settings.hoursMode ?? 'scheduled'
  const showHours = bundle.settings.showHours !== false

  const [modeBusy, setModeBusy] = useState(false)
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
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  async function handleModeChange(newMode: 'scheduled' | 'always_open', newShowHours: boolean) {
    setModeBusy(true)
    try {
      await data.setHoursMode(tenantId, newMode, newShowHours)
      await reload()
      toast.success(t('common.saved'))
    } catch (e) {
      const code = errorCodeOf(e)
      toast.error(t(errorKey(e)))
      console.error('[maweid] setHoursMode failed', { tenantId, newMode, newShowHours, code, e })
    } finally {
      setModeBusy(false)
    }
  }

  function patch(weekday: number, index: number, key: keyof Win, value: string) {
    if (!week) return
    const min = toMin(value)
    if (min === null) return // Accept transient empty string without toast
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
      week.map((d) => {
        if (d.weekday !== weekday) return d
        let opensMin = 540
        let closesMin = 780
        if (d.windows.length > 0) {
          const last = d.windows[d.windows.length - 1]
          if (last) {
            opensMin = Math.min(1380, last.closesMin + 60)
            closesMin = Math.min(1440, opensMin + 120)
          }
        }
        return { ...d, windows: [...d.windows, { opensMin, closesMin }] }
      }),
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

  function clearDay(weekday: number) {
    if (!week) return
    setWeek(week.map((d) => (d.weekday !== weekday ? d : { ...d, windows: [] })))
  }

  function copyToAllDays(sourceWeekday: number) {
    if (!week) return
    const source = week.find((d) => d.weekday === sourceWeekday)
    if (!source) return
    setWeek(
      week.map((d) => ({
        ...d,
        windows: source.windows.map((w) => ({ ...w })),
      })),
    )
    toast.info(t('common.saved'))
  }

  // Validate entire week
  const dayErrors: Record<number, string | null> = {}
  let hasAnyError = false
  if (week) {
    for (const d of week) {
      const dayName = t(`day.${WEEKDAY_KEYS[d.weekday]}`)
      const err = validateDayWindows(dayName, d.windows)
      dayErrors[d.weekday] = err
      if (err) hasAnyError = true
    }
  }

  async function save() {
    if (!week) return
    setBusy(true)
    try {
      const cleaned: Day[] = week.map((d) => ({
        weekday: d.weekday,
        windows: d.windows
          .filter((w) => w.opensMin !== w.closesMin)
          .map((w) =>
            w.closesMin < w.opensMin
              ? { opensMin: w.closesMin, closesMin: w.opensMin }
              : { ...w },
          )
          .slice(0, 5),
      }))
      await data.setWeekHours(tenantId, null, cleaned)
      setBaseline(JSON.stringify(cleaned))
      await reload()
      toast.success(t('common.saved'))
    } catch (e) {
      const code = errorCodeOf(e)
      toast.error(t(errorKey(e)))
      console.error('[maweid] setWeekHours failed', { tenantId, code, week, e })
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
      const code = errorCodeOf(e)
      toast.error(t(errorKey(e)))
      console.error('[maweid] upsertClosedDate failed', {
        tenantId,
        day: newDay,
        label: newLabel,
        code,
        e,
      })
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
      const code = errorCodeOf(e)
      toast.error(t(errorKey(e)))
      console.error('[maweid] deleteClosedDate failed', { tenantId, day, code, e })
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

      {/* Advisory Notice */}
      <div
        style={{
          borderRadius: 14,
          border: '1px solid var(--mw-border-info, #bfdbfe)',
          backgroundColor: 'var(--mw-surface-info, #eff6ff)',
          padding: 12,
          fontSize: 13,
          color: 'var(--mw-ink, #1e3a8a)',
          marginBlockEnd: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>ℹ️</span>
        <span>{t('admin.hoursAreAdvisory')}</span>
      </div>

      {/* Mode Controls */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 shadow-sm space-y-4">
        <h3 className="font-bold text-base">{t('admin.hoursMode')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${hoursMode === 'scheduled' ? 'border-primary bg-primary/5 font-semibold' : 'border-border'}`}
          >
            <input
              type="radio"
              name="hoursMode"
              checked={hoursMode === 'scheduled'}
              disabled={modeBusy}
              onChange={() => handleModeChange('scheduled', showHours)}
            />
            <span>{t('admin.modeScheduled')}</span>
          </label>
          <label
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${hoursMode === 'always_open' ? 'border-primary bg-primary/5 font-semibold' : 'border-border'}`}
          >
            <input
              type="radio"
              name="hoursMode"
              checked={hoursMode === 'always_open'}
              disabled={modeBusy}
              onChange={() => handleModeChange('always_open', showHours)}
            />
            <span>{t('admin.modeAlwaysOpen')}</span>
          </label>
        </div>

        <div className="pt-2 border-t border-border flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
            <input
              type="checkbox"
              checked={showHours}
              disabled={modeBusy}
              onChange={(e) => handleModeChange(hoursMode, e.target.checked)}
            />
            <span>{t('admin.showHoursOnSite')}</span>
          </label>
        </div>
      </div>

      {hoursMode === 'always_open' && (
        <div className="alert alert--info mb-6">ℹ️ {t('admin.alwaysOpenInfo')}</div>
      )}

      {/* Week Schedule Cards */}
      <div className={hoursMode === 'always_open' ? 'opacity-70' : ''}>
        <div style={{ display: 'grid', gap: 12 }}>
          {week.map((d) => {
            const err = dayErrors[d.weekday]
            const dayName = t(`day.${WEEKDAY_KEYS[d.weekday]}`)
            return (
              <article
                key={d.weekday}
                className={`bg-surface border p-4 rounded-xl shadow-sm ${err ? 'border-amber-400' : 'border-border'}`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <strong className="text-base">{dayName}</strong>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => copyToAllDays(d.weekday)}>
                      📋 {t('admin.copyToAllDays')}
                    </Button>
                    {d.windows.length > 0 && (
                      <Button size="sm" variant="quiet" onClick={() => clearDay(d.weekday)}>
                        🚫 {t('admin.clearDay')}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => addWindow(d.weekday)}>
                      + {t('admin.addWindow')}
                    </Button>
                  </div>
                </div>

                {err && <p className="text-xs text-amber-600 font-medium my-2">⚠️ {err}</p>}

                {d.windows.length === 0 ? (
                  <p className="text-sm opacity-60 my-2">{t('common.closed')}</p>
                ) : (
                  <div className="grid gap-3 mt-3">
                    {d.windows.map((w, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 flex-wrap bg-surface-muted/30 p-2 rounded-lg border border-border/50"
                      >
                        <Field label={`${t('common.from')} (${toHM(w.opensMin)})`}>
                          <Input
                            type="time"
                            step={300}
                            value={toHM(w.opensMin)}
                            onChange={(e) => patch(d.weekday, i, 'opensMin', e.target.value)}
                          />
                        </Field>
                        <Field label={`${t('common.to')} (${toHM(w.closesMin)})`}>
                          <Input
                            type="time"
                            step={300}
                            value={toHM(w.closesMin)}
                            onChange={(e) => patch(d.weekday, i, 'closesMin', e.target.value)}
                          />
                        </Field>
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => removeWindow(d.weekday, i)}
                        >
                          {t('common.delete')}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>

        <div className="save-bar" role="region" aria-label={t('common.save')}>
          <span className="save-bar__state">
            {dirty ? t('common.unsavedChanges') : t('common.allSaved')}
          </span>
          <div className="save-bar__actions">
            <Button
              variant="quiet"
              disabled={!dirty || busy}
              onClick={() => {
                const fresh = build()
                setWeek(fresh)
                setBaseline(JSON.stringify(fresh))
              }}
            >
              {t('common.discard')}
            </Button>
            <Button
              variant="primary"
              disabled={!dirty}
              loading={busy}
              onClick={() => void save()}
            >
              {t('common.saveHours')}
            </Button>
          </div>
        </div>
      </div>

      {/* Closed Dates */}
      <h2 className="text-xl font-bold mt-8 mb-4">{t('admin.closedDates')}</h2>
      <div className="flex gap-3 items-end flex-wrap bg-surface border border-border p-4 rounded-xl shadow-sm">
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

      <ul className="mt-4 grid gap-2 list-none p-0">
        {closed.map((c) => (
          <li
            key={c.day}
            className="flex gap-3 items-center bg-surface border border-border p-3 rounded-lg"
          >
            <code dir="ltr" className="font-mono text-sm font-semibold">
              {c.day}
            </code>
            <span className="flex-1 opacity-75 text-sm">{c.label ?? ''}</span>
            <Button size="sm" variant="quiet" onClick={() => removeClosed(c.day)}>
              {t('common.delete')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
