import { useCallback, useEffect, useRef, useState } from 'react'
import { data } from '@/data'
import { errorCodeOf, type ErrorCode } from '@/data/errors'
import type { HoldResult } from '@/data'
import type { UUID } from '@/types/domain'

/**
 * The temporary reservation.
 *
 * Without it, two customers open the same slot, both fill in a form, and the
 * second one gets an error after typing everything — the worst possible moment
 * to fail. With it, the slot is locked the instant the customer picks a time
 * and released automatically if they wander off.
 *
 * The hold is also released on unmount and on tab close, so an abandoned
 * checkout does not freeze a slot for the full TTL.
 */
export function useHold(slug: string) {
  const [hold, setHold] = useState<HoldResult | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  const holdRef = useRef<HoldResult | null>(null)

  holdRef.current = hold

  const acquire = useCallback(
    async (serviceId: UUID, staffId: UUID, startsAt: Date): Promise<HoldResult | null> => {
      setPending(true)
      setError(null)
      try {
        // never keep two holds at once
        if (holdRef.current) await data.releaseHold(holdRef.current.bookingId)
        const next = await data.holdSlot(slug, serviceId, staffId, startsAt)
        setHold(next)
        return next
      } catch (e) {
        setError(errorCodeOf(e))
        return null
      } finally {
        setPending(false)
      }
    },
    [slug],
  )

  const release = useCallback(async () => {
    const current = holdRef.current
    if (!current) return
    setHold(null)
    await data.releaseHold(current.bookingId)
  }, [])

  /** Called after a successful confirm so the cleanup does not delete it. */
  const forget = useCallback(() => setHold(null), [])

  // countdown
  useEffect(() => {
    if (!hold) {
      setRemainingMs(0)
      return
    }
    const update = () => setRemainingMs(hold.expiresAt.getTime() - Date.now())
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [hold])

  // expiry
  useEffect(() => {
    if (hold && remainingMs <= 0) {
      setHold(null)
      setError('hold_expired')
    }
  }, [hold, remainingMs])

  // release on unmount and on tab close
  useEffect(() => {
    const onUnload = () => {
      if (holdRef.current) void data.releaseHold(holdRef.current.bookingId)
    }
    window.addEventListener('pagehide', onUnload)
    return () => {
      window.removeEventListener('pagehide', onUnload)
      onUnload()
    }
  }, [])

  return {
    hold,
    remainingMs,
    expired: Boolean(hold) && remainingMs <= 0,
    urgent: remainingMs > 0 && remainingMs < 60_000,
    pending,
    error,
    acquire,
    release,
    forget,
  }
}
