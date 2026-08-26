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
import { useEscape } from '@/hooks'
import { useLocale } from '@/contexts/LocaleContext'

/* -------------------------------------------------------------------------- */
/* Button & IconButton                                                         */
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
      type="button"
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

type IconName = 'edit' | 'trash' | 'plus' | 'refresh' | 'bell'

const ICON_PATHS: Record<IconName, string> = {
  edit: 'M4 20h4l10-10-4-4L4 16v4zm12.7-12.7 2-2a1.4 1.4 0 0 0 0-2l-2-2a1.4 1.4 0 0 0-2 0l-2 2 4 4z',
  trash: 'M6 7h12l-1 13H7L6 7zm3-3h6l1 2H8l1-2z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z',
  refresh: 'M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z',
  bell: 'M12 2a6 6 0 0 0-6 6v4l-2 3h16l-2-3V8a6 6 0 0 0-6-6zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3z',
}

export function IconButton({
  icon,
  label,
  showLabel = false,
  tone = 'default',
  className,
  ...rest
}: {
  icon: IconName
  label: string
  showLabel?: boolean
  tone?: 'default' | 'danger'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={showLabel ? undefined : label}
      className={cn('btn-icon', tone === 'danger' && 'btn-icon--danger', className)}
      {...rest}
    >
      <svg className="btn-icon__svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={ICON_PATHS[icon]} />
      </svg>
      {showLabel ? <span>{label}</span> : null}
    </button>
  )
}

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
  className,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  variant: 'modal' | 'drawer'
  className?: string
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
    <div
      className="scrim"
      onClick={(e) => {
        // Close only on a real click on the backdrop itself. Using onMouseDown
        // here used to close the dialog when the page regained focus after a
        // native file/camera sheet, which cancelled in-flight uploads.
        if (e.target !== e.currentTarget) return
        if (document.body.dataset.mwLock === '1') return
        onClose()
      }}
    >
      <div
        ref={ref}
        className={cn(variant, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
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
  subtitle,
  wide,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  wide?: boolean
  children: ReactNode
  footer?: ReactNode
}) {
  const id = useId()
  const { t } = useLocale()
  return (
    <Overlay open={open} onClose={onClose} variant="modal" className={wide ? 'modal--wide' : undefined} labelledBy={id}>
      <header className="modal__head">
        <div>
          <h2 id={id} className="modal__title">{title}</h2>
          {subtitle && <p className="modal__sub">{subtitle}</p>}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={t('action.close')}>
          ✕
        </button>
      </header>
      <div className="modal__body">{children}</div>
      {footer && <footer className="modal__foot">{footer}</footer>}
    </Overlay>
  )
}

export { Price, type PriceProps } from './Price'

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
