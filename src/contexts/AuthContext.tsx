import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { data } from '../data'
import { NO_PERMS } from '../data/adapter'
import type { Permissions, Session, AuthStatus } from '../data/domain'

interface AuthValue {
  session: Session | null
  perms: Permissions
  loading: boolean
  /** true only when the signed-in account owns this shop */
  isOwner: boolean
  /** true for owner, manager or staff of this shop */
  isMember: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: (redirectTo?: string) => Promise<void>
  status: (slug: string) => Promise<AuthStatus>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setSession(await data.getSession())
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return data.onAuthChange((s) => {
      setSession(s)
      setLoading(false)
    })
  }, [load])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      perms: session?.perms ?? NO_PERMS,
      loading,
      isOwner: session?.isShopOwner === true,
      isMember: session != null,
      async signIn(email, password) {
        setSession(await data.signIn(email, password))
      },
      async signInWithGoogle(redirectTo) {
        await data.signInWithGoogle(redirectTo)
      },
      async status(slug: string) {
        return await data.authStatus(slug)
      },
      async signOut() {
        await data.signOut()
        setSession(null)
      },
      refresh: load,
    }),
    [session, loading, load],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
