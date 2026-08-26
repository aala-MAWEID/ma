import type { Locale, Tenant } from '@/data/domain'

/**
 * Runtime <head> sync. Crawlers never see this (they do not run JS) - that is what
 * scripts/gen-social-meta.mjs is for. This only improves the live browser tab.
 * It deliberately does NOT touch <html lang> or dir: the i18n layer owns those.
 */

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  if (!content) return
  const sel = `meta[${attr}="${key}"]`
  let el = document.head.querySelector<HTMLMetaElement>(sel)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string): void {
  if (!href) return
  const sel = `link[rel="${rel}"]`
  let el = document.head.querySelector<HTMLLinkElement>(sel)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export function applyHead(opts: {
  tenant: Tenant
  locale: Locale
  photoUrl?: string | null
}): void {
  const { tenant, locale } = opts
  const fr = locale === 'fr'
  const name = (fr ? tenant.nameFr : tenant.name) || tenant.name
  const tagline = (fr ? tenant.taglineFr : tenant.tagline) || tenant.tagline || ''

  document.title = tagline ? `${name} · ${tagline}` : name
  upsertMeta('name', 'description', tagline || name)
  upsertMeta('name', 'apple-mobile-web-app-title', name)
  upsertMeta('name', 'theme-color', tenant.brandColor)
  upsertMeta('property', 'og:site_name', name)
  upsertMeta('property', 'og:title', name)
  upsertMeta('property', 'og:description', tagline || name)

  const img = opts.photoUrl || tenant.logoUrl || ''
  if (img) {
    upsertMeta('property', 'og:image', img)
    upsertMeta('name', 'twitter:image', img)
    upsertLink('icon', img)
    upsertLink('apple-touch-icon', img)
  }
}
