import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { useEscape, useToast, ToastContext, useToastState } from '@/hooks'
import { useLocale } from '@/context/LocaleContext'

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'quiet'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn('btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', className)}
      disabled={disabled || loading}
      data-loading={loading ? 'true' : undefined}
      {...rest}
    >
      {loading && <Spinner size={size === 'lg' ? 20 : 16} />}
      <span>{children}</span>
    </button>
  )
})

/* -------------------------------------------------------------------------- */
/* Field wrapper + inputs                                                      */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className={cn('field', error && 'field--invalid')}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {!required && hint && <span className="field__optional">{hint}</span>}
      </label>
      {children}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn('input', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn('input', 'input--area', className)}
      aria-invalid={invalid || undefined}
      rows={3}
      {...rest}
    />
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn('input', 'input--select', className)} {...rest}>
      {children}
    </select>
  )
})

/* -------------------------------------------------------------------------- */
/* Spinner, Badge, Empty                                                       */
/* -------------------------------------------------------------------------- */

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="spinner"
      style={{ inlineSize: size, blockSize: size }}
      role="status"
      aria-hidden="true"
    />
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'ok' | 'warn' | 'err' | 'brand'
}) {
  return <span className={cn('badge', `badge--${tone}`)}>{children}</span>
}

export function EmptyState({
  icon = '📅',
  title,
  hint,
  body,
  action,
}: {
  icon?: string
  title: string
  hint?: string
  body?: string
  action?: ReactNode
}) {
  const message = hint ?? body
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      <p className="empty__title">{title}</p>
      {message && <p className="empty__hint">{message}</p>}
      {action}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Modal + Drawer                                                              */
/* -------------------------------------------------------------------------- */

/**
 * One overlay implementation, two skins. The drawer slides from the inline
 * start edge, which means it comes from the right in Arabic and the left in
 * French without a single conditional — the CSS uses `inset-inline-start`.
 */
function Overlay({
  open,
  onClose,
  children,
  variant,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  variant: 'modal' | 'drawer'
  labelledBy?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEscape(onClose, open)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="scrim" onMouseDown={onClose}>
      <div
        ref={ref}
        className={variant}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const id = useId()
  const { t } = useLocale()
  return (
    <Overlay open={open} onClose={onClose} variant="modal" labelledBy={id}>
      <header className="modal__head">
        <h2 id={id}>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label={t('action.close')}>
          ✕
        </button>
      </header>
      <div className="modal__body">{children}</div>
      {footer && <footer className="modal__foot">{footer}</footer>}
    </Overlay>
  )
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const id = useId()
  const { t } = useLocale()
  return (
    <Overlay open={open} onClose={onClose} variant="drawer" labelledBy={id}>
      <header className="drawer__head">
        <h2 id={id}>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label={t('action.close')}>
          ✕
        </button>
      </header>
      <div className="drawer__body">{children}</div>
      {footer && <footer className="drawer__foot">{footer}</footer>}
    </Overlay>
  )
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                      */
/* -------------------------------------------------------------------------- */

export function ToastProvider({ children }: { children: ReactNode }) {
  const value = useToastState()
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  )
}

function ToastViewport() {
  const { toasts, dismiss } = useToast()
  if (toasts.length === 0) return null
  return createPortal(
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          className={cn('toast', `toast--${toast.tone}`)}
          onClick={() => dismiss(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>,
    document.body,
  )
}
