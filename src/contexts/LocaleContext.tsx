import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Locale } from '@/data/domain'
import { translate } from '@/i18n'
import { safeStorage } from '@/lib/safeStorage'

interface LocaleValue {
  locale: Locale
  dir: 'rtl' | 'ltr'
  setLocale: (next: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleValue | null>(null)
const STORAGE_KEY = 'maweid.locale'

function initial(fallback: Locale): Locale {
  const saved = safeStorage.get(STORAGE_KEY)
  return saved === 'ar' || saved === 'fr' || saved === 'en' ? saved : fallback
}

export function LocaleProvider({
  children,
  defaultLocale = 'ar',
}: {
  children: ReactNode
  defaultLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initial(defaultLocale))
  const dir: 'rtl' | 'ltr' = locale === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale, dir])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    safeStorage.set(STORAGE_KEY, next)
  }, [])

  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      dir,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, dir, setLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>')
  return ctx
}
