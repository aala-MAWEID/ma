import { useCallback, useEffect, useRef, useState } from 'react'
import { data } from '@/data'
import { errorCodeOf, type ErrorCode } from '@/data/errors'
import type { HoldResult } from '@/data'
import type { UUID } from '@/types/domain'

/**
 * الحجز المؤقت.
 *
 * درس مدفوع الثمن: النسخة السابقة كانت تحفظ remainingMs في state وتقرر الانتهاء
 * من خلاله، فكانت أول دورة عرض بعد الحجز ترى 0 وتُعلن الانتهاء فوراً.
 * الآن: مصدر الحقيقة الوحيد هو hold.expiresAt، والموقّت مجرد مُحدِّث عرض.
 */
export function useHold(slug: string) {
  const [hold, setHold] = useState<HoldResult | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  const holdRef = useRef<HoldResult | null>(null)

  const setBoth = useCallback((next: HoldResult | null) => {
    holdRef.current = next
    setHold(next)
  }, [])

  const expiresMs = hold ? hold.expiresAt.getTime() : 0
  const validExpiry = Number.isFinite(expiresMs) && expiresMs > 0
  const remainingMs = hold ? (validExpiry ? Math.max(0, expiresMs - now) : 600_000) : 0
  const expired = Boolean(hold) && validExpiry && expiresMs <= now

  const acquire = useCallback(
    async (serviceId: UUID, staffId: UUID, startsAt: Date): Promise<HoldResult | null> => {
      setPending(true)
      setError(null)
      try {
        const previous = holdRef.current
        if (previous?.bookingId) await data.releaseHold(previous.bookingId, previous.code)
        setBoth(null)

        const next = await data.holdSlot(slug, serviceId, staffId, startsAt)
        if (!next?.bookingId) {
          setError('unknown')
          return null
        }
        setBoth(next)
        setNow(Date.now())
        return next
      } catch (e) {
        setError(errorCodeOf(e))
        return null
      } finally {
        setPending(false)
      }
    },
    [slug, setBoth],
  )

  const release = useCallback(async () => {
    const current = holdRef.current
    setBoth(null)
    if (!current?.bookingId) return
    try {
      await data.releaseHold(current.bookingId, current.code)
    } catch {
      /* إلغاء حجز مؤقت لا يستحق رسالة خطأ للمستخدم */
    }
  }, [setBoth])

  /** بعد تأكيد ناجح: ننسى الحجز دون حذفه من القاعدة. */
  const forget = useCallback(() => setBoth(null), [setBoth])

  const clearError = useCallback(() => setError(null), [])

  // موقّت عرض واحد: يعمل فقط مع حجز قائم، ويتوقف عند الانتهاء.
  useEffect(() => {
    if (!hold || !validExpiry) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [hold, validExpiry])

  // الانتهاء الحقيقي فقط (لا يعتمد على حالة قديمة)
  useEffect(() => {
    if (!hold || !validExpiry) return
    if (expiresMs > Date.now()) return
    setBoth(null)
    setError('hold_expired')
  }, [hold, validExpiry, expiresMs, now, setBoth])

  // تحرير الحجز عند إغلاق اللسان فقط (ليس عند كل unmount لأن React 19 في StrictMode يركّب مرتين)
  useEffect(() => {
    const onHide = () => {
      const current = holdRef.current
      if (current?.bookingId) void data.releaseHold(current.bookingId, current.code)
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [])

  return {
    hold,
    remainingMs,
    expired,
    urgent: Boolean(hold) && remainingMs > 0 && remainingMs < 60_000,
    pending,
    error,
    clearError,
    acquire,
    release,
    forget,
  }
}
