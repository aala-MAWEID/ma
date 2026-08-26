import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

/** النبرات التي يعرفها CSS فعلاً: .toast--ok / .toast--err / .toast--info / .toast--warn */
export type ToastTone = 'ok' | 'err' | 'info' | 'warn'

/** ما تقبله مواضع النداء القديمة، ونطبّعه داخلياً. */
export type ToastToneInput = ToastTone | 'error' | 'success' | 'danger' | 'warning'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

function normalizeTone(tone: ToastToneInput | undefined): ToastTone {
  switch (tone) {
    case 'success':
      return 'ok'
    case 'error':
    case 'danger':
      return 'err'
    case 'warning':
      return 'warn'
    case 'ok':
    case 'err':
    case 'warn':
    case 'info':
      return tone
    default:
      return 'info'
  }
}

/**
 * الواجهة قابلة للنداء ومفكوكة في الوقت نفسه، حتى يعمل كل نمط قائم:
 *   const toast = useToast(); toast('حسناً'); toast.error('فشل')
 *   const { push, success } = useToast()
 */
export type ToastApi = ((message: string, tone?: ToastToneInput, ms?: number) => void) & {
  push: (message: string, tone?: ToastToneInput, ms?: number) => void
  show: (message: string, tone?: ToastToneInput, ms?: number) => void
  success: (message: string, ms?: number) => void
  error: (message: string, ms?: number) => void
  info: (message: string, ms?: number) => void
  warn: (message: string, ms?: number) => void
  dismiss: (id: number) => void
  clear: () => void
  toasts: Toast[]
}

export const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((x) => x.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (message: string, tone?: ToastToneInput, ms = 4200) => {
      const text = (message ?? '').toString().trim()
      if (!text) return
      seq.current += 1
      const id = seq.current
      const item: Toast = { id, message: text, tone: normalizeTone(tone) }
      // ثلاث رسائل كحدّ أقصى على الشاشة
      setToasts((list) => [...list, item].slice(-3))
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), Math.max(1200, ms)),
      )
    },
    [dismiss],
  )

  const clear = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer))
    timers.current.clear()
    setToasts([])
  }, [])

  useEffect(() => {
    const timersRef = timers.current
    return () => {
      timersRef.forEach((timer) => clearTimeout(timer))
      timersRef.clear()
    }
  }, [])

  // The identity of this object must NEVER change: consumers put it in
  // useCallback/useEffect dependency arrays. Including `toasts` here used to
  // re-create it on every toast, which turned a single failed request into an
  // infinite request/toast loop (V19-5 A0).
  const toastsRef = useRef(toasts)
  toastsRef.current = toasts

  const api = useMemo<ToastApi>(() => {
    const fn = ((message: string, tone?: ToastToneInput, ms?: number) =>
      push(message, tone, ms)) as ToastApi
    fn.push = push
    fn.show = push
    fn.success = (message, ms) => push(message, 'ok', ms)
    fn.error = (message, ms) => push(message, 'err', ms)
    fn.info = (message, ms) => push(message, 'info', ms)
    fn.warn = (message, ms) => push(message, 'warn', ms)
    fn.dismiss = dismiss
    fn.clear = clear
    Object.defineProperty(fn, 'toasts', {
      get: () => toastsRef.current,
      configurable: true,
    })
    return fn
  }, [push, dismiss, clear])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document === 'undefined'
        ? null
        : createPortal(
            <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
              {toasts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={'toast toast--' + item.tone}
                  onClick={() => dismiss(item.id)}
                >
                  {item.message}
                </button>
              ))}
            </div>,
            document.body,
          )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}

/** لا يرمي خطأ: للمكوّنات التي قد تُركَّب خارج المزوّد (مثل ErrorBoundary). */
export function useOptionalToast(): ToastApi | null {
  return useContext(ToastContext)
}
