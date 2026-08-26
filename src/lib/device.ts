import { safeStorage } from '@/lib/safeStorage'

/**
 * Anonymous device identity: a random UUID v4, NOT a browser fingerprint.
 * Nothing about the hardware is measured, so it cannot track the visitor anywhere else.
 *
 * Persistence: localStorage → cookie (2 years, for Safari private mode / webviews)
 * → module memory (last resort).
 */

const STORAGE_PREFIX = 'maweid.device.'
const COOKIE_PREFIX = 'mw_dev_'
const COOKIE_DAYS = 730
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const memory = new Map<string, string>()

function randomUuid(): string {
  try {
    const c = globalThis.crypto as Crypto | undefined
    if (c && typeof c.randomUUID === 'function') return c.randomUUID()
    if (c && typeof c.getRandomValues === 'function') {
      const b = c.getRandomValues(new Uint8Array(16))
      b[6] = (b[6]! & 0x0f) | 0x40
      b[8] = (b[8]! & 0x3f) | 0x80
      const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  } catch {
    /* fall through */
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function readCookie(name: string): string | null {
  try {
    if (typeof document === 'undefined') return null
    const target = `${name}=`
    for (const part of document.cookie.split(';')) {
      const item = part.trim()
      if (item.startsWith(target)) return decodeURIComponent(item.slice(target.length))
    }
  } catch {
    /* cookies disabled */
  }
  return null
}

function writeCookie(name: string, value: string): void {
  try {
    if (typeof document === 'undefined') return
    const expires = new Date(Date.now() + COOKIE_DAYS * 86_400_000).toUTCString()
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${name}=${encodeURIComponent(value)}; Expires=${expires}; Path=/; SameSite=Lax${secure}`
  } catch {
    /* ignore */
  }
}

const keyFor = (slug: string) => STORAGE_PREFIX + (slug || 'default')
const cookieFor = (slug: string) =>
  COOKIE_PREFIX + (slug || 'default').replace(/[^a-zA-Z0-9_-]/g, '')

/** The token for this shop, creating and persisting one if needed. Never throws. */
export function getDeviceToken(slug: string): string {
  const k = keyFor(slug)

  const fromMemory = memory.get(k)
  if (fromMemory && UUID_RE.test(fromMemory)) return fromMemory

  const stored = safeStorage.get(k)
  if (stored && UUID_RE.test(stored)) {
    memory.set(k, stored)
    writeCookie(cookieFor(slug), stored)
    return stored
  }

  const cookie = readCookie(cookieFor(slug))
  if (cookie && UUID_RE.test(cookie)) {
    memory.set(k, cookie)
    safeStorage.set(k, cookie)
    return cookie
  }

  const fresh = randomUuid()
  memory.set(k, fresh)
  safeStorage.set(k, fresh)
  writeCookie(cookieFor(slug), fresh)
  return fresh
}

/** Accept the token the server echoed back (it is authoritative). */
export function setDeviceToken(slug: string, token: string): void {
  if (!token || !UUID_RE.test(token)) return
  const k = keyFor(slug)
  memory.set(k, token)
  safeStorage.set(k, token)
  writeCookie(cookieFor(slug), token)
}

/** "Forget this device" in the notification panel. */
export function clearDeviceToken(slug: string): void {
  const k = keyFor(slug)
  memory.delete(k)
  safeStorage.remove(k)
  try {
    document.cookie = `${cookieFor(slug)}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`
  } catch {
    /* ignore */
  }
}

export type DeviceProfile = {
  userAgent: string | null
  platform: string | null
  locale: string | null
  timeZone: string | null
}

/** Harmless context so the owner can tell "iPhone · Safari" from "Android · Chrome". */
export function deviceProfile(): DeviceProfile {
  let userAgent: string | null = null
  let platform: string | null = null
  let locale: string | null = null
  let timeZone: string | null = null
  try {
    userAgent = navigator.userAgent?.slice(0, 300) ?? null
    const ua = userAgent ?? ''
    platform = /iPhone|iPad|iPod/i.test(ua)
      ? 'iOS'
      : /Android/i.test(ua)
        ? 'Android'
        : /Macintosh/i.test(ua)
          ? 'macOS'
          : /Windows/i.test(ua)
            ? 'Windows'
            : /Linux/i.test(ua)
              ? 'Linux'
              : null
    locale = navigator.language ?? null
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    /* ignore */
  }
  return { userAgent, platform, locale, timeZone }
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
