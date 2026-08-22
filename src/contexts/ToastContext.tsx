import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface Toast {
  id: number
  message: string
  tone: 'ok' | 'err' | 'error' | 'info' | 'warn'
}

interface ToastValue {
  toasts: Toast[]
  push: (message: string, tone?: Toast['tone']) => void
  toast: (message: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: Toast['tone'] = 'info') => {
      const id = next.current++
      setToasts((list) => [...list, { id, message, tone }])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  const value = useMemo<ToastValue>(
    () => ({
      toasts,
      push,
      toast: push,
      dismiss,
    }),
    [toasts, push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-dock" aria-live="polite" role="region">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast"
            data-tone={t.tone === 'error' ? 'err' : t.tone}
            onClick={() => dismiss(t.id)}
          >
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastValue & ((message: string, tone?: Toast['tone']) => void) {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')

  const fn = (message: string, tone?: Toast['tone']) => ctx.push(message, tone)
  Object.assign(fn, ctx)
  return fn as any
}
