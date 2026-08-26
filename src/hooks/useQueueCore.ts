import { useCallback, useEffect, useRef, useState } from 'react'
import type { QueueBoard } from '@/data/adapter'
import { data } from '@/data'

const POLL_MS = 15000

/** The open/closed switch. Optimistic, and it rolls back on failure. */
export function useShopSwitch(tenantId: string | null) {
  const [open, setOpen] = useState<boolean | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [changedAt, setChangedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const apply = useCallback(
    async (next: boolean, nextNote?: string | null) => {
      if (!tenantId) return
      const previous = open
      setOpen(next)
      setBusy(true)
      setError(null)
      try {
        const res = await data.setShopOpen(tenantId, next, nextNote ?? null)
        setOpen(res.open)
        setNote(res.note)
        setChangedAt(res.changedAt)
      } catch (e) {
        setOpen(previous)
        setError(e)
      } finally {
        setBusy(false)
      }
    },
    [open, tenantId],
  )

  return { open, note, changedAt, busy, error, apply, setOpen, setNote, setChangedAt }
}

/**
 * The whole board, ordered by the server. Never sort or slice the arrays:
 * `waiting[i].pos` is the number the customer was given.
 */
export function useQueueBoard(tenantId: string | null) {
  const [board, setBoard] = useState<QueueBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [acting, setActing] = useState<string | null>(null)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    if (!tenantId) return
    try {
      const next = await data.queueBoard(tenantId)
      if (alive.current) {
        setBoard(next)
        setError(null)
      }
    } catch (e) {
      if (alive.current) setError(e)
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    alive.current = true
    void refresh()
    const timer = window.setInterval(() => void refresh(), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive.current = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  /** Wraps every mutation: one in flight at a time, always followed by a refresh. */
  const run = useCallback(
    async (id: string, fn: () => Promise<unknown>) => {
      if (acting) return
      setActing(id)
      try {
        await fn()
        await refresh()
      } catch (e) {
        setError(e)
      } finally {
        setActing(null)
      }
    },
    [acting, refresh],
  )

  const serve = useCallback(
    (id: string) => run(id, () => data.queueServe(tenantId as string, id)),
    [run, tenantId],
  )
  const finish = useCallback(
    (id: string, outcome: 'completed' | 'no_show') =>
      run(id, () => data.queueFinish(tenantId as string, id, outcome, true)),
    [run, tenantId],
  )
  const place = useCallback(
    (id: string, position: number) =>
      run(id, () => data.queuePlace(tenantId as string, id, Math.max(1, Math.floor(position)))),
    [run, tenantId],
  )

  /** ↑ / ↓ are just "place at my position minus/plus one". */
  const moveBy = useCallback(
    (id: string, delta: number) => {
      const row = board?.waiting.find((w) => w.id === id)
      if (!row) return Promise.resolve()
      return place(id, row.pos + delta)
    },
    [board, place],
  )

  return { board, loading, error, acting, refresh, serve, finish, place, moveBy }
}
