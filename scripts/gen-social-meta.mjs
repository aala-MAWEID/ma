#!/usr/bin/env node
/**
 * Bakes per-tenant Open Graph / Twitter / manifest metadata into static HTML.
 * Social crawlers do not run JavaScript, so runtime <title> changes are invisible to them.
 * Reads live values from the public RPC get_tenant_bundle at build time.
 * NEVER fails the build: any network/config problem warns and exits 0.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const dist = resolve(process.cwd(), 'dist')
const indexPath = join(dist, 'index.html')

const backend = (process.env.VITE_DATA_BACKEND ?? 'supabase').trim()
const supaUrl = (process.env.VITE_SUPABASE_URL ?? '').trim()
const supaKey = (process.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
const rawBase = (process.env.VITE_BASE_PATH ?? '/').trim()
const base = rawBase.endsWith('/') ? rawBase : rawBase + '/'
const rawSite = (process.env.VITE_SITE_ORIGIN ?? 'https://aala-maweid.github.io').trim()
const site = rawSite.endsWith('/') ? rawSite.slice(0, -1) : rawSite
const slugs = (
  process.env.VITE_SOCIAL_SLUGS ??
  process.env.VITE_DEFAULT_TENANT ??
  'zaytouna'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const skip = (why) => {
  console.warn('[social-meta] skipped: ' + why)
  process.exit(0)
}

if (!existsSync(indexPath)) skip('dist/index.html not found')
if (backend !== 'supabase') skip('backend=' + backend)
if (!supaUrl || !supaKey) skip('Supabase env not set')

const template = readFileSync(indexPath, 'utf8')

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Replace the value that follows a literal marker, up to the next double quote. */
const setAfter = (html, marker, value) => {
  const i = html.indexOf(marker)
  if (i === -1) return html
  const start = i + marker.length
  const end = html.indexOf('"', start)
  if (end === -1) return html
  return html.slice(0, start) + esc(value) + html.slice(end)
}

const setTitle = (html, value) => {
  const a = html.indexOf('<title>')
  const b = html.indexOf('</title>')
  if (a === -1 || b === -1) return html
  return html.slice(0, a) + '<title>' + esc(value) + '</title>' + html.slice(b + 8)
}

async function loadBundle(slug) {
  const res = await fetch(supaUrl + '/rest/v1/rpc/get_tenant_bundle', {
    method: 'POST',
    headers: {
      apikey: supaKey,
      Authorization: 'Bearer ' + supaKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_slug: slug }),
  })
  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200))
  return res.json()
}

/** Primary barber = first active staff member by sort_order who has a photo. */
function primaryPhoto(bundle) {
  const staff = (bundle.staff ?? [])
    .filter((s) => s.is_active !== false)
    .slice()
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
  const withPhoto = staff.find((s) => s.avatar_url)
  return {
    photo: withPhoto?.avatar_url || bundle.tenant?.logo_url || site + base + 'icon-512.png',
    barberAr: withPhoto?.display_name ?? staff[0]?.display_name ?? '',
    barberFr: withPhoto?.display_name ?? staff[0]?.display_name ?? '',
    titleAr: withPhoto?.title ?? '',
    titleFr: withPhoto?.title_fr ?? withPhoto?.title ?? '',
  }
}

const ROUTES = [
  { path: '', ar: '', fr: '' },
  { path: 'book', ar: 'احجز موعدك', fr: 'Prendre rendez-vous' },
  { path: 'queue', ar: 'طابور الانتظار', fr: 'File d attente' },
  { path: 'me', ar: 'حجوزاتي', fr: 'Mes rendez-vous' },
]

let wrote = 0
for (const slug of slugs) {
  let bundle
  try {
    bundle = await loadBundle(slug)
  } catch (e) {
    console.warn('[social-meta] ' + slug + ': RPC failed - ' + e.message)
    continue
  }
  const t = bundle?.tenant
  if (!t) {
    console.warn('[social-meta] ' + slug + ': no tenant in bundle')
    continue
  }

  const p = primaryPhoto(bundle)
  const nameAr = t.name ?? slug
  const nameFr = t.name_fr ?? nameAr
  const tagAr = t.tagline ?? ''
  const tagFr = t.tagline_fr ?? tagAr
  const cityPart = t.city ? ' - ' + t.city : ''
  const barber = p.titleAr ? p.barberAr + ' (' + p.titleAr + ')' : p.barberAr

  const descAr = (tagAr || 'احجز موعدك في ثوانٍ') + cityPart + (barber ? ' · ' + barber : '')
  const descFr = (tagFr || 'Reservez votre rendez-vous en quelques secondes') + cityPart

  for (const route of ROUTES) {
    const dir = join(dist, slug, route.path)
    const titleAr = route.ar ? nameAr + ' · ' + route.ar : nameAr
    const canonical = site + base + slug + (route.path ? '/' + route.path : '')

    const head =
      '\n    <link rel="canonical" href="' + esc(canonical) + '" />' +
      '\n    <meta property="og:url" content="' + esc(canonical) + '" />' +
      '\n    <meta name="maweid:name-ar" content="' + esc(nameAr) + '" />' +
      '\n    <meta name="maweid:name-fr" content="' + esc(nameFr) + '" />' +
      '\n    <meta property="og:image:alt" content="' + esc(nameAr + ' · ' + nameFr) + '" />' +
      '\n    <meta property="og:image:width" content="512" />' +
      '\n    <meta property="og:image:height" content="512" />\n  '

    let html = template
    html = setTitle(html, titleAr)
    html = setAfter(html, 'name="description" content="', descAr)
    html = setAfter(html, 'name="apple-mobile-web-app-title" content="', nameAr)
    html = setAfter(html, 'name="theme-color" content="', t.brand_color ?? '#0E7C86')
    html = setAfter(html, 'property="og:site_name" content="', nameAr + ' · ' + nameFr)
    html = setAfter(html, 'property="og:title" content="', titleAr)
    html = setAfter(html, 'property="og:description" content="', descAr)
    html = setAfter(html, 'property="og:image" content="', p.photo)
    html = setAfter(html, 'name="twitter:title" content="', titleAr)
    html = setAfter(html, 'name="twitter:description" content="', descFr)
    html = setAfter(html, 'name="twitter:image" content="', p.photo)
    html = setAfter(html, 'rel="manifest" href="', base + slug + '/manifest.webmanifest')
    html = setAfter(html, 'rel="apple-touch-icon" href="', p.photo)

    const closing = html.indexOf('</head>')
    if (closing !== -1) html = html.slice(0, closing) + head + html.slice(closing)

    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.html'), html)
    wrote++
  }

  const manifest = {
    name: nameAr + ' · ' + nameFr,
    short_name: nameAr,
    description: descAr,
    lang: 'ar',
    dir: 'auto',
    start_url: base + slug + '/',
    scope: base + slug + '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: t.brand_color ?? '#0E7C86',
    icons: [
      { src: base + 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: base + 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: base + 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
  mkdirSync(join(dist, slug), { recursive: true })
  writeFileSync(join(dist, slug, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2))
  console.log('[social-meta] ' + slug + ': ' + nameAr + ' / ' + nameFr + ' -> ' + p.photo)
}

console.log('[social-meta] wrote ' + wrote + ' html file(s)')
