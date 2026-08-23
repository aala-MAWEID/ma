import { useCallback, useEffect, useRef, useState } from 'react'
import { data } from '@/data'
import type { TurnStatus } from '@/types/domain'
import { pingTurn } from '@/lib/notify'

/**
 * يتتبع حالة الدور لرمز حجز، يجدّد دورياً كل 8 ثوانٍ،
 * ويُطلق تنبيهاً صوتياً خفيفاً عند اقتراب الدور (أقل من 2) أو حلوله.
 */
export function useTurnStatus(code: string | null | undefined, intervalMs = 8000) {
  const [turn, setTurn] = useState<TurnStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(code))
  const [error, setError] = useState<string | null>(null)
  const lastAhead = useRef<number | null>(null)

  const reload = useCallback(async () => {
    if (!code) {
      setTurn(null)
      setLoading(false)
      return
    }
    try {
      const res = await data.turnStatus(code)
      setTurn(res)
      setError(null)

      if (res.found && typeof res.ahead === 'number') {
        const prev = lastAhead.current
        const curr = res.ahead
        if (prev !== null && prev > curr) {
          if (curr === 0 || res.status === 'serving') pingTurn('now')
          else if (curr <= 2) pingTurn('approaching')
        }
        lastAhead.current = curr
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [code])

  useEffect(() => {
    lastAhead.current = null
    setLoading(Boolean(code))
    void reload()
    if (!code) return
    const id = window.setInterval(() => void reload(), intervalMs)
    return () => window.clearInterval(id)
  }, [code, intervalMs, reload])

  return { turn, loading, error, reload }
}
