import { useEffect, useRef, useState } from 'react'

export type LiveNumberProps = {
  value: number | string | null | undefined
  /** Shown while value is null/undefined. */
  placeholder?: string
  className?: string
}

/**
 * Renders a single figure and animates it only when it actually changes.
 * aria-live keeps screen readers in sync without shouting on every render.
 */
export function LiveNumber({ value, placeholder = '—', className }: LiveNumberProps) {
  const shown = value === null || value === undefined || value === '' ? placeholder : String(value)
  const prevRef = useRef(shown)
  const [bump, setBump] = useState(false)

  useEffect(() => {
    if (prevRef.current === shown) return
    prevRef.current = shown
    setBump(true)
    const id = window.setTimeout(() => setBump(false), 520)
    return () => window.clearTimeout(id)
  }, [shown])

  return (
    <span
      className={['live-num', bump ? 'live-num--bump' : '', className ?? ''].filter(Boolean).join(' ')}
      aria-live="polite"
      aria-atomic="true"
    >
      {shown}
    </span>
  )
}
