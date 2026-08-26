import type { DataAdapter, DeviceIdentity } from '@/data/adapter'
import { safeStorage } from '@/lib/safeStorage'

const TOKEN_KEY = 'maweid.device.token'
const IDENT_KEY = 'maweid.device.identity'
const EMAIL_KEY = 'maweid.device.email'
const PRINT_KEY = 'maweid.device.print'

function read(key: string): string | null {
  return safeStorage.get(key)
}

function write(key: string, value: string): void {
  safeStorage.set(key, value)
}

/** RFC4122 uuid with a fallback for browsers without crypto.randomUUID. */
function newUuid(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(b)
  } else {
    for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256)
  }
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * STEP 1 — the local code. Created once, on the very first contact, and then
 * reused forever from the cache. This alone already identifies the device.
 */
export function localDeviceToken(): string {
  const existing = read(TOKEN_KEY)
  if (existing && existing.length >= 32) return existing
  const fresh = newUuid()
  write(TOKEN_KEY, fresh)
  return fresh
}

/**
 * STEP 2 — a coarse, stable fingerprint used only to recover the token if the
 * cache is wiped. Deliberately low-entropy: it must stay identical across
 * sessions, so no timestamps, no window size, no battery, no canvas.
 */
export async function deviceFingerprint(): Promise<string> {
  const cached = read(PRINT_KEY)
  if (cached) return cached
  const nav = navigator as Navigator & { deviceMemory?: number }
  const parts = [
    navigator.userAgent || '',
    navigator.language || '',
    (navigator.languages || []).join(','),
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(window.devicePixelRatio || 1),
    String(navigator.hardwareConcurrency || 0),
    String(nav.deviceMemory || 0),
    String(navigator.maxTouchPoints || 0),
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
  ]
  const raw = parts.join('|')
  let hex = ''
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
    hex = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // http:// or very old WebView: crypto.subtle is missing. Use a cheap hash.
    let h1 = 0x811c9dc5
    for (let i = 0; i < raw.length; i += 1) {
      h1 ^= raw.charCodeAt(i)
      h1 = Math.imul(h1, 0x01000193) >>> 0
    }
    hex = `fnv${h1.toString(16).padStart(8, '0')}${raw.length.toString(16)}`
  }
  write(PRINT_KEY, hex)
  return hex
}

/**
 * STEP 3 — tell Supabase. The server is the authority: if it hands back a
 * different token (because it recognised the fingerprint of a device whose
 * cache was cleared), we adopt the server token and overwrite the cache.
 */
export async function identifyDevice(data: DataAdapter, slug: string): Promise<DeviceIdentity> {
  const token = localDeviceToken()
  const fingerprint = await deviceFingerprint()
  const identity = await data.guestIdentify({
    slug,
    deviceToken: token,
    fingerprint,
    userAgent: navigator.userAgent || null,
    platform: (navigator as Navigator & { platform?: string }).platform ?? null,
    locale: navigator.language || null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  })
  if (identity.deviceToken && identity.deviceToken !== token) write(TOKEN_KEY, identity.deviceToken)
  if (identity.identityKey) write(IDENT_KEY, identity.identityKey)
  if (identity.email) write(EMAIL_KEY, identity.email)
  return identity
}

/**
 * STEP 4 — optional e-mail. Once given, the same person is recognised on any
 * other device that uses the same address: the server merges every device
 * under one identity key. No password, no account, nothing to remember.
 */
export async function linkDeviceEmail(
  data: DataAdapter,
  slug: string,
  email: string,
): Promise<string> {
  const token = localDeviceToken()
  const res = await data.guestLinkEmail(slug, token, email.trim().toLowerCase())
  write(EMAIL_KEY, email.trim().toLowerCase())
  if (res.identityKey) write(IDENT_KEY, res.identityKey)
  return res.identityKey
}

export function cachedDeviceEmail(): string | null {
  return read(EMAIL_KEY)
}

export function cachedIdentityKey(): string | null {
  return read(IDENT_KEY)
}

// Aliases for compatibility
export const getDeviceToken = (_slug?: string) => localDeviceToken()
export const setDeviceToken = (_slug: string, token: string) => write(TOKEN_KEY, token)
export const clearDeviceToken = (_slug?: string) => {
  safeStorage.remove(TOKEN_KEY)
  safeStorage.remove(IDENT_KEY)
  safeStorage.remove(EMAIL_KEY)
  safeStorage.remove(PRINT_KEY)
}
export function deviceProfile() {
  return {
    userAgent: navigator.userAgent || null,
    platform: (navigator as Navigator & { platform?: string }).platform ?? null,
    locale: navigator.language || null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  }
}

/** True when running as an installed PWA (required for iOS notifications). */
export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

export function isIos(): boolean {
  try {
    const ua = navigator.userAgent
    return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  } catch {
    return false
  }
}

