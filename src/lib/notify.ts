/**
 * Sound + vibration + OS notifications.
 * iOS Safari rule: an AudioContext may only start inside a user gesture — so we
 * create ONE context, unlock it on the first tap, and reuse it forever.
 */

export type PingKind = 'approaching' | 'now' | 'info'

type Ctor = typeof AudioContext

let ctx: AudioContext | null = null
let unlocked = false
let installed = false

function ctor(): Ctor | null {
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx
  const C = ctor()
  if (!C) return null
  try {
    ctx = new C()
  } catch {
    ctx = null
  }
  return ctx
}

/** Call from a real user gesture. Safe to call often. */
export function unlockAudio(): void {
  const c = ensureCtx()
  if (!c) return
  try {
    if (c.state === 'suspended') void c.resume()
    const src = c.createBufferSource()
    src.buffer = c.createBuffer(1, 1, 22_050)
    src.connect(c.destination)
    src.start(0)
    unlocked = true
  } catch {
    /* ignore */
  }
}

export function isAudioUnlocked(): boolean {
  return unlocked && ctx?.state === 'running'
}

/** Attach the one-time unlock listeners. Called once by the notification center. */
export function installAudioUnlock(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const handler = () => unlockAudio()
  window.addEventListener('touchend', handler, { passive: true })
  window.addEventListener('click', handler)
  window.addEventListener('keydown', handler)
}

function beep(freq: number, startAt: number, durationMs: number, gainValue = 0.16): void {
  const c = ensureCtx()
  if (!c) return
  try {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const t0 = c.currentTime + startAt
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(gainValue, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(t0)
    osc.stop(t0 + durationMs / 1000 + 0.02)
  } catch {
    /* ignore */
  }
}

function vibrate(pattern: number[]): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    /* iOS has no vibrate — fine */
  }
}

/** Audible alert. Same export name as v16, so existing callers keep working. */
export function pingTurn(kind: PingKind = 'info'): void {
  const c = ensureCtx()
  if (c && c.state === 'suspended') void c.resume()

  if (kind === 'now') {
    beep(880, 0, 260)
    beep(1174.66, 0.3, 260)
    beep(880, 0.6, 320)
    vibrate([200, 100, 200, 100, 300])
    return
  }
  if (kind === 'approaching') {
    beep(587.33, 0, 200)
    beep(783.99, 0.24, 220)
    vibrate([120, 80, 120])
    return
  }
  beep(587.33, 0, 160, 0.1)
  vibrate([80])
}

export function osNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function osPermission(): NotificationPermission | 'unsupported' {
  return osNotificationsSupported() ? Notification.permission : 'unsupported'
}

export async function requestOsNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!osNotificationsSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function osNotify(input: { title: string; body?: string | null; tag?: string; urgent?: boolean }): void {
  if (!osNotificationsSupported() || Notification.permission !== 'granted') return
  try {
    const n = new Notification(input.title, { body: input.body ?? undefined, tag: input.tag })
    if (!input.urgent) window.setTimeout(() => n.close(), 8000)
  } catch {
    /* Safari without a service worker throws — ignore */
  }
}

/** One entry point used by the feed hook for each brand-new notification. */
export function announce(n: {
  kind: string
  title: string
  body?: string | null
  urgent?: boolean
  sound?: boolean
  soundAllowed?: boolean
}): void {
  const isTurn = n.kind === 'your_turn'
  const isSoon = n.kind === 'almost_your_turn' || n.kind === 'approaching'
  if (n.soundAllowed !== false && n.sound !== false) {
    pingTurn(isTurn ? 'now' : isSoon ? 'approaching' : 'info')
  }
  osNotify({
    title: n.title,
    body: n.body ?? null,
    tag: isTurn ? 'maweid-turn' : `maweid-${n.kind}`,
    urgent: n.urgent === true || isTurn,
  })
}
