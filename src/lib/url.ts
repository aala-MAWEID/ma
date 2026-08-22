/**
 * URL composition.
 *
 * Phase 1 shipped a hard syntax error because a complete WhatsApp link was
 * written as a literal inside a template string in three components, and a
 * link-processing layer rewrote it on the way through. The fix is not to be
 * more careful — it is to make the mistake impossible to repeat by never
 * writing a complete address anywhere in the source.
 *
 * The host is assembled from parts. It reads oddly. That is deliberate.
 */

const SCHEME = 'https'
const WA_HOST = ['wa', 'me'].join('.')
const MAPS_HOST = ['www', 'google', 'com'].join('.')
const TEL = 'tel'
const MAILTO = 'mailto'

function origin(host: string): string {
  return SCHEME + '://' + host
}

/** Digits only. wa . me rejects +, spaces and dashes. */
export function waDigits(phone: string): string {
  return (phone ?? '').replace(/[^0-9]/g, '')
}

/**
 * A WhatsApp deep link.
 * waLink('+212 612-806932', 'مرحبا') -> https :// wa . me /212612806932?text=...
 */
export function waLink(phone: string, text?: string): string {
  const digits = waDigits(phone)
  const base = origin(WA_HOST) + '/' + digits
  if (!text) return base
  return base + '?text=' + encodeURIComponent(text)
}

export function telLink(phone: string): string {
  return TEL + ':' + (phone ?? '').replace(/[^0-9+]/g, '')
}

export function mailLink(email: string, subject?: string): string {
  const base = MAILTO + ':' + email
  return subject ? base + '?subject=' + encodeURIComponent(subject) : base
}

export function mapsLink(lat: number, lng: number, label?: string): string {
  const q = label ? encodeURIComponent(label) : `${lat},${lng}`
  return origin(MAPS_HOST) + '/maps/search/?api=1&query=' + q
}

/** The message the owner sends a customer from the booking drawer. */
export function waConfirmText(name: string, when: string, shop: string): string {
  return `مرحبا ${name}، موعدك في ${shop} يوم ${when}. ننتظرك!`
}
