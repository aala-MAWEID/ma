import { useCallback, useEffect, useRef, useState } from 'react'
import { data } from '@/data'

export type LivePulse<T> = {
  /** Latest counts-only snapshot, or null until the first fetch lands. */
  snap: T | null
  /** True while a realtime transport is connected. */
  live: boolean
  /** Force an immediate refresh (used by manual refresh buttons). */
  refresh: () => void
}

type Options = {
  /** Coalesce bursts of DB changes into one fetch. */
  debounceMs?: number
  /** Safety net when realtime is down or a ping is missed. */
  heartbeatMs?: number
  /** Skip fetching entirely (e.g. no permission for this RPC). */
  enabled?: boolean
}

/**
 * Subscribes to the tenant pulse and keeps ONE small snapshot of numbers in
 * state. It never refetches a list, never remounts a route and never shows a
 * toast: a failed pulse just backs off and retries.
 */
export function useLivePulse<T>(
  tenantId: string | null | undefined,
  fetcher: () => Promise<T>,
  options?: Options,
): LivePulse<T> {
  const debounceMs = options?.debounceMs ?? 300
  const heartbeatMs = options?.heartbeatMs ?? 30_000
  const enabled = options?.enabled ?? true

  const [snap, setSnap] = useState<T | null>(null)
  const [live, setLive] = useState(false)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const aliveRef = useRef(true)
  const inFlightRef = useRef(false)
  const pendingRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const backoffRef = useRef(0)
  const genRef = useRef(0)

  const run = useCallback(async () => {
    if (!aliveRef.current || !enabled) return
    if (inFlightRef.current) {
      pendingRef.current = true
      return
    }
    inFlightRef.current = true
    const gen = ++genRef.current
    try {
      const next = await fetcherRef.current()
      if (!aliveRef.current || gen !== genRef.current) return
      setSnap(next)
      backoffRef.current = 0
    } catch (e) {
      // Silent by design: a pulse failure must not interrupt the user.
      console.warn('[maweid] pulse fetch فشل', e)
      backoffRef.current = Math.min(backoffRef.current === 0 ? 1_000 : backoffRef.current * 2, 30_000)
    } finally {
      inFlightRef.current = false
      if (pendingRef.current && aliveRef.current) {
        pendingRef.current = false
        window.setTimeout(() => void run(), 50)
      }
    }
  }, [enabled])

  const schedule = useCallback(
    (delay: number) => {
      if (!aliveRef.current) return
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        void run()
      }, Math.max(delay, backoffRef.current))
    },
    [run],
  )

  const refresh = useCallback(() => schedule(0), [schedule])

  useEffect(() => {
    aliveRef.current = true
    if (!tenantId || !enabled) return

    void run()

    const unsubscribe = data.subscribePulse(tenantId, () => {
      setLive(true)
      schedule(debounceMs)
    })

    const heartbeat = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      schedule(0)
    }, heartbeatMs)

    const onVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) schedule(0)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      aliveRef.current = false
      unsubscribe()
      window.clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisible)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
      setLive(false)
    }
  }, [tenantId, enabled, debounceMs, heartbeatMs, run, schedule])

  return { snap, live, refresh }
}
