import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MoreIcon } from '@/components/ui/icons'

export type RowMenuItem = {
  key: string
  label: string
  icon?: ReactNode
  /** Renders an anchor instead of a button (tel:, https://wa.me, …). */
  href?: string
  external?: boolean
  onSelect?: () => void
  disabled?: boolean
  danger?: boolean
}

export type RowMenuProps = {
  /** Accessible name of the trigger, e.g. t('queue.more'). */
  label: string
  items: RowMenuItem[]
  /** Extra class for the trigger button. */
  className?: string
}

/**
 * A small overflow menu for a list row. Popover on desktop, bottom sheet on
 * phones (CSS only, no breakpoint logic in JS). Closes on outside pointer,
 * on Escape, and after any item is chosen.
 */
export function RowMenu({ label, items, className }: RowMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return

    const onPointer = (e: PointerEvent) => {
      const root = rootRef.current
      if (root && e.target instanceof Node && !root.contains(e.target)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }

    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey)

    const first = panelRef.current?.querySelector<HTMLElement>('[data-menuitem]:not([aria-disabled="true"])')
    first?.focus()

    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const visible = items.filter((item) => item.href || item.onSelect)
  if (visible.length === 0) return null

  return (
    <div className="row-menu" ref={rootRef}>
      <button
        type="button"
        className={['row-menu__trigger', className ?? ''].filter(Boolean).join(' ')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreIcon size={18} />
      </button>

      {open && (
        <div className="row-menu__panel" role="menu" aria-label={label} ref={panelRef}>
          {visible.map((item) =>
            item.href ? (
              <a
                key={item.key}
                data-menuitem
                role="menuitem"
                className={['row-menu__item', item.danger ? 'row-menu__item--danger' : ''].filter(Boolean).join(' ')}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noreferrer noopener' : undefined}
                onClick={close}
              >
                <span className="row-menu__icon" aria-hidden="true">{item.icon}</span>
                <span className="row-menu__label">{item.label}</span>
              </a>
            ) : (
              <button
                key={item.key}
                data-menuitem
                type="button"
                role="menuitem"
                className={['row-menu__item', item.danger ? 'row-menu__item--danger' : ''].filter(Boolean).join(' ')}
                disabled={item.disabled}
                aria-disabled={item.disabled ? 'true' : undefined}
                onClick={() => {
                  close()
                  item.onSelect?.()
                }}
              >
                <span className="row-menu__icon" aria-hidden="true">{item.icon}</span>
                <span className="row-menu__label">{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
