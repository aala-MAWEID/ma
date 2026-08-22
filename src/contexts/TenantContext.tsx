import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { data, type TenantBundle, type Tenant, type TenantSettings, type Service, type Staff } from '@/data'
import { errorCodeOf, type ErrorCode } from '@/data/errors'
import { formatMinutes } from '@/lib/time'

interface TenantValue {
  bundle: TenantBundle | null
  tenant: Tenant
  settings: TenantSettings
  services: Service[]
  staff: Staff[]
  hours: Array<{ label: string; value: string }>
  loading: boolean
  error: ErrorCode | null
  reload: () => void
}

const TenantContext = createContext<TenantValue | null>(null)

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function TenantProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [bundle, setBundle] = useState<TenantBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)

    data
      .getTenantBundle(slug)
      .then((next) => {
        if (!alive) return
        setBundle(next)
        const root = document.documentElement
        root.style.setProperty('--mw-brand', next.tenant.brandColor)
        document.title = next.tenant.name
      })
      .catch((e) => alive && setError(errorCodeOf(e)))
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [slug, nonce])

  const value = useMemo<TenantValue>(() => {
    const defaultTenant: Tenant = bundle?.tenant ?? {
      id: '',
      slug,
      name: 'صالون الزيتونة',
      phone: '+212 522-123456',
      city: 'الدار البيضاء',
      brandColor: '#0E7C86',
      defaultLocale: 'ar',
      locales: ['ar', 'fr'],
      timeZone: 'Africa/Casablanca',
      currency: 'MAD',
      isPublished: true,
    }

    const hours = (bundle?.workingHours ?? [])
      .filter((h) => h.staffId === null)
      .map((h) => ({
        label: DAYS_AR[h.weekday] ?? String(h.weekday),
        value: `${formatMinutes(h.opensMin)} - ${formatMinutes(h.closesMin)}`,
      }))

    return {
      bundle,
      tenant: bundle?.tenant ?? defaultTenant,
      settings: bundle?.settings ?? {},
      services: bundle?.services ?? [],
      staff: bundle?.staff ?? [],
      hours: hours.length > 0 ? hours : [
        { label: 'الإثنين - السبت', value: '09:00 - 20:00' },
        { label: 'الأحد', value: '10:00 - 18:00' },
      ],
      loading,
      error,
      reload: () => setNonce((n) => n + 1),
    }
  }, [bundle, loading, error, slug])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant(): TenantValue {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used inside <TenantProvider>')
  return ctx
}

export function useTenantBundle(): TenantBundle {
  const { bundle } = useTenant()
  if (!bundle) throw new Error('Tenant bundle is not loaded yet')
  return bundle
}
