import { useCallback, useEffect, useState } from 'react'
import { data } from '@/data'
import { deviceProfile, getDeviceToken, setDeviceToken } from '@/lib/device'
import type { GuestHello } from '@/data/guest'

type Entry = {
  token: string
  hello: GuestHello | null
  error: string | null
  inflight: Promise<GuestHello | null> | null
}

const entries = new Map<string, Entry>()
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function entryFor(slug: string): Entry {
  let e = entries.get(slug)
  if (!e) {
    e = { token: getDeviceToken(slug), hello: null, error: null, inflight: null }
    entries.set(slug, e)
  }
  return e
}

/** Token without any network call — safe to use inside other data calls. */
export function deviceTokenOf(slug: string): string {
  return entryFor(slug).token
}

/** Register/refresh this device. Deduplicated: concurrent callers share one request. */
export async function ensureHello(slug: string, force = false): Promise<GuestHello | null> {
  if (!slug) return null
  const e = entryFor(slug)
  if (e.hello && !force) return e.hello
  if (e.inflight && !force) return e.inflight

  const p = (async () => {
    const profile = deviceProfile()
    try {
      const hello = await data.guestHello(slug, e.token, profile)
      if (hello?.deviceToken && hello.deviceToken !== e.token) {
        e.token = hello.deviceToken
        setDeviceToken(slug, hello.deviceToken)
      }
      e.hello = hello ?? null
      e.error = null
      return e.hello
    } catch (err: unknown) {
      e.error = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      e.inflight = null
      emit()
    }
  })()

  e.inflight = p
  return p
}

/** Attach an existing booking code to this device (queue join, booking confirmation). */
export async function claimCode(slug: string, code: string) {
  if (!slug || !code) return null
  const e = entryFor(slug)
  try {
    const claim = await data.guestClaim(slug, e.token, code.trim().toUpperCase())
    await ensureHello(slug, true)
    return claim
  } catch {
    return null
  }
}

export function useDevice(slug: string) {
  const [, bump] = useState(0)

  useEffect(() => {
    const fn = () => bump((n) => n + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  useEffect(() => {
    if (slug) void ensureHello(slug)
  }, [slug])

  const refresh = useCallback(async () => {
    if (slug) await ensureHello(slug, true)
  }, [slug])

  const e = slug ? entryFor(slug) : null
  const hello = e?.hello ?? null

  return {
    token: e?.token ?? null,
    hello,
    known: hello?.known === true,
    visits: hello?.visits ?? 0,
    unread: hello?.unread ?? 0,
    soundEnabled: hello?.soundEnabled !== false,
    pushEnabled: hello?.pushEnabled === true,
    customer: hello?.customer ?? null,
    error: e?.error ?? null,
    refresh,
  }
}
