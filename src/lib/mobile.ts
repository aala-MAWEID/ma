/** Safari على iOS يتجاهل user-scalable=no، فنمنع إيماءة التكبير والنقر المزدوج يدوياً. */
export function lockViewport(): () => void {
  const stopGesture = (e: Event) => e.preventDefault()
  const stopMultiTouch = (e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault()
  }
  let lastTouch = 0
  const stopDoubleTap = (e: TouchEvent) => {
    const now = Date.now()
    if (now - lastTouch <= 320) e.preventDefault()
    lastTouch = now
  }

  document.addEventListener('gesturestart', stopGesture)
  document.addEventListener('gesturechange', stopGesture)
  document.addEventListener('touchstart', stopMultiTouch, { passive: false })
  document.addEventListener('touchend', stopDoubleTap, { passive: false })

  return () => {
    document.removeEventListener('gesturestart', stopGesture)
    document.removeEventListener('gesturechange', stopGesture)
    document.removeEventListener('touchstart', stopMultiTouch)
    document.removeEventListener('touchend', stopDoubleTap)
  }
}
