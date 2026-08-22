import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/* ------------------------------------------------------------------ *
 *  عميل سوبابيس الوحيد في التطبيق.
 *
 *  - يقبل الرابط بأي شكل تلصقه من لوحة سوبابيس (مع /rest/v1 أو بدونها).
 *  - يقبل المفتاح الجديد sb_publishable_… والمفتاح القديم eyJ… (anon).
 *  - يرفض المفتاح السرّي sb_secret_… و service_role ولا يستعملهما أبداً.
 *  - عند غياب متغيّرات البيئة يستعمل قيم المشروع التجريبي المدمجة أدناه.
 * ------------------------------------------------------------------ */

/** قيم المشروع التجريبي — للإنتاج احذفهما واعتمد على .env فقط. */
const DEMO_SUPABASE_URL = 'https://yklhriwhzzjgwnqinrni.supabase.co'
const DEMO_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_eqAaOf31QvpHubb2xHtd8A_tfNTee56'
/** مفتاح anon القديم (JWT) — بديل يعمل مع كل الإصدارات إن عُطّلت المفاتيح الجديدة. */
const DEMO_SUPABASE_ANON_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrbGhyaXdoenpqZ3ducWlucm5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0Mjg0NzgsImV4cCI6MjEwMzAwNDQ3OH0.Zy-cp-JJPfZvAUKxO53ePCzbNjwm36NFUiibeLXdCLE'

const rawUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export type SupabaseKeyKind =
  | 'publishable'
  | 'anon-jwt'
  | 'secret'
  | 'service-role'
  | 'unknown'

/** بادئة البروتوكول — مفصولة حتى لا تختلط بقوالب النصوص. */
const ORIGIN_PREFIX = 'https:' + '//'

/** يحوّل أي رابط ملصوق إلى أصل المشروع فقط: https://<ref>.supabase.co */
export function normalizeSupabaseUrl(input: string): string {
  let v = input.trim().replace(/^[<"'\s]+/, '').replace(/[>"'\s,]+$/, '')
  if (!v) return ''
  if (!/^https?:\/\//i.test(v)) v = ORIGIN_PREFIX + v
  try {
    return ORIGIN_PREFIX + new URL(v).host
  } catch {
    return v.replace(/\/+$/, '')
  }
}

function urlLooksValid(u: string): boolean {
  if (!/^https:\/\/[^\s/]+$/i.test(u)) return false
  const host = u.slice(ORIGIN_PREFIX.length).toLowerCase()
  if (/placeholder|example|localhost|127\.0\.0\.1/.test(host)) return false
  // رابط لوحة التحكم ليس رابط الـ API
  if (host === 'supabase.com' || host.endsWith('.supabase.com')) return false
  return true
}

function jwtRole(token: string): string | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    return (JSON.parse(atob(padded)) as { role?: string }).role ?? null
  } catch {
    return null
  }
}

export function detectKeyKind(key: string): SupabaseKeyKind {
  if (!key) return 'unknown'
  if (key.startsWith('sb_publishable_')) return 'publishable'
  if (key.startsWith('sb_secret_')) return 'secret'
  if (key.startsWith('eyJ')) {
    const role = jwtRole(key)
    if (role === 'service_role') return 'service-role'
    if (role === 'anon' || role === 'authenticated') return 'anon-jwt'
  }
  return 'unknown'
}

export function maskKey(key: string): string {
  if (!key) return '(فارغ)'
  return key.length <= 14 ? '••••' : `${key.slice(0, 10)}…${key.slice(-4)}`
}

const envUrl = normalizeSupabaseUrl(rawUrl)
const envUrlOk = urlLooksValid(envUrl)
const envKeyKind = detectKeyKind(rawKey)
const envKeyOk = envKeyKind === 'publishable' || envKeyKind === 'anon-jwt'

export const supabaseUrl = envUrlOk ? envUrl : DEMO_SUPABASE_URL
/** عند غياب متغيّرات البيئة: المفتاح الجديد أولاً، ثم anon القديم. */
const demoKey =
  detectKeyKind(DEMO_SUPABASE_PUBLISHABLE_KEY) === 'publishable'
    ? DEMO_SUPABASE_PUBLISHABLE_KEY
    : DEMO_SUPABASE_ANON_JWT

export const supabaseAnonKey = envKeyOk ? rawKey : demoKey
export const supabaseKeyKind = detectKeyKind(supabaseAnonKey)
export const supabaseProjectRef = supabaseUrl.slice(ORIGIN_PREFIX.length).split('.')[0]

const notices: string[] = []

if (!rawUrl) {
  notices.push('VITE_SUPABASE_URL فارغ — استُعمل رابط المشروع المدمج.')
} else if (!envUrlOk) {
  notices.push(
    `VITE_SUPABASE_URL غير صالح ("${rawUrl}") — استُعمل الرابط المدمج. القيمة الصحيحة هي أصل المشروع فقط بدون /rest/v1.`,
  )
} else if (envUrl !== rawUrl.replace(/\/+$/, '')) {
  notices.push(`تم تنظيف الرابط تلقائياً: ${rawUrl} ← ${envUrl}`)
}

if (!rawKey) {
  notices.push('VITE_SUPABASE_ANON_KEY فارغ — استُعمل المفتاح العام المدمج.')
} else if (envKeyKind === 'secret' || envKeyKind === 'service-role') {
  notices.push(
    '⚠️ القيمة الموضوعة في VITE_SUPABASE_ANON_KEY مفتاح سرّي — تم تجاهله لأسباب أمنية. استعمل sb_publishable_… فقط.',
  )
} else if (!envKeyOk) {
  notices.push('VITE_SUPABASE_ANON_KEY بصيغة غير معروفة — استُعمل المفتاح العام المدمج.')
}

export const supabaseNotices: string[] = notices

export const urlProblem: string | null = urlLooksValid(supabaseUrl)
  ? null
  : `رابط سوبابيس غير صالح: ${supabaseUrl}`

export const keyProblem: string | null =
  supabaseKeyKind === 'publishable' || supabaseKeyKind === 'anon-jwt'
    ? null
    : `مفتاح سوبابيس غير صالح (${supabaseKeyKind})`

export const supabaseConfigProblem: string | null = urlProblem ?? keyProblem
export const isSupabaseConfigured = supabaseConfigProblem === null

if (notices.length) console.warn('[maweid] ملاحظات إعداد سوبابيس:', notices)
if (!isSupabaseConfigured) {
  console.error('[maweid] Supabase غير مهيّأ →', supabaseConfigProblem)
} else {
  console.info(
    `[maweid] Supabase ✓ ${supabaseProjectRef} — نوع المفتاح: ${supabaseKeyKind} (${maskKey(supabaseAnonKey)})`,
  )
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'maweid.auth',
  },
  realtime: { params: { eventsPerSecond: 4 } },
  global: { headers: { 'x-client-info': 'maweid-web' } },
})

/** يرمي خطأ واضحاً قبل أي نداء شبكة عندما تكون الإعدادات ناقصة. */
export function assertSupabaseReady(): void {
  if (supabaseConfigProblem) {
    throw new Error(`supabase_not_configured: ${supabaseConfigProblem}`)
  }
}
