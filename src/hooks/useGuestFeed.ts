import { useCallback, useEffect, useRef, useState } from 'react'
import { data } from '@/data'
import { announce } from '@/lib/notify'
import type { GuestFeed, GuestNotification, GuestTicket } from '@/data/guest'

/**
 * Polls guest_feed and announces every new notification exactly once.
 * Cadence: urgent 4s · active ticket 12s · idle 60s · hidden tab 30s (urgent) or paused.
 */

const URGENT_MS = 4_000
const ACTIVE_MS = 12_000
const IDLE_MS = 60_000
const HIDDEN_URGENT_MS = 30_000

function isUrgentTicket(t: GuestTicket): boolean {
  if (t.status === 'serving') return true
  const ahead = t.turn?.ahead
  return typeof ahead === 'number' && ahead <= 1
}

export function useGuestFeed(slug: string, token: string | null, enabled = true) {
  const [feed, setFeed] = useState<GuestFeed | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const seen = useRef<Set<string>>(new Set())
  const primed = useRef(false)
  const timer = useRef<number | null>(null)
  const alive = useRef(true)
  const latest = useRef<GuestFeed | null>(null)

  const load = useCallback(
    async (announceNew: boolean): Promise<GuestFeed | null> => {
      if (!slug || !token || !enabled) return null
      setLoading(true)
      try {
        const next = await data.guestFeed(slug, token, 30)
        if (!alive.current) return next
        latest.current = next
        setFeed(next)
        setError(null)

        const fresh = (next.notifications ?? []).filter(
          (n: GuestNotification) => !seen.current.has(n.id),
        )
        for (const n of next.notifications ?? []) seen.current.add(n.id)

        // The first poll stays silent: those messages are history.
        if (announceNew && primed.current) {
          const unheard = fresh
            .filter((n) => !n.readAt)
            .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
          for (const n of unheard) {
            announce({
              kind: n.kind,
              title: n.title,
              body: n.body,
              urgent: n.urgent,
              sound: n.sound,
              soundAllowed: next.soundEnabled !== false,
            })
          }
        }
        primed.current = true
        return next
      } catch (err: unknown) {
        if (alive.current) setError(err instanceof Error ? err.message : String(err))
        return null
      } finally {
        if (alive.current) setLoading(false)
      }
    },
    [slug, token, enabled],
  )

  useEffect(() => {
    alive.current = true
    if (!slug || !token || !enabled) return

    let stopped = false

    const delayFor = (f: GuestFeed | null): number | null => {
      const tickets = f?.tickets ?? []
      const urgent = tickets.some(isUrgentTicket)
      const hidden = typeof document !== 'undefined' && document.hidden
      if (hidden) return urgent ? HIDDEN_URGENT_MS : null
      if (urgent) return URGENT_MS
      if (tickets.length > 0) return ACTIVE_MS
      return IDLE_MS
    }

    const tick = async () => {
      if (stopped) return
      const next = await load(true)
      if (stopped) return
      const ms = delayFor(next ?? latest.current)
      if (ms === null) return // paused; visibilitychange restarts the loop
      timer.current = window.setTimeout(() => void tick(), ms)
    }

    void tick()

    const onVisible = () => {
      if (document.hidden) return
      if (timer.current) window.clearTimeout(timer.current)
      void tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      stopped = true
      alive.current = false
      if (timer.current) window.clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [slug, token, enabled, load])

  const markRead = useCallback(
    async (ids?: string[]) => {
      if (!token) return
      try {
        await data.guestMarkRead(token, ids ?? null)
        setFeed((prev) =>
          prev
            ? {
                ...prev,
                unread: ids ? Math.max(0, prev.unread - ids.length) : 0,
                notifications: prev.notifications.map((n) =>
                  !ids || ids.includes(n.id)
                    ? { ...n, readAt: n.readAt ?? new Date().toISOString() }
                    : n,
                ),
              }
            : prev,
        )
      } catch {
        /* non-fatal */
      }
    },
    [token],
  )

  const tickets = feed?.tickets ?? []
  const activeTicket =
    tickets.find((t) => t.status === 'serving') ??
    tickets.find((t) => t.status === 'confirmed' || t.status === 'pending') ??
    null

  return {
    feed,
    notifications: feed?.notifications ?? [],
    tickets,
    activeTicket,
    unread: feed?.unread ?? 0,
    ahead: activeTicket?.turn?.ahead ?? null,
    waitMin: activeTicket?.turn?.waitMin ?? null,
    isMyTurn: activeTicket?.status === 'serving',
    soundEnabled: feed?.soundEnabled !== false,
    pushEnabled: feed?.pushEnabled === true,
    loading,
    error,
    reload: () => load(false),
    markRead,
  }
}
