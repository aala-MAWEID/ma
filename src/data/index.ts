/**
 * الوحدة الوحيدة التي يستورد منها باقي التطبيق البيانات.
 * اختيار الواجهة الخلفية: VITE_DATA_BACKEND، وعند غيابه نكتشف تلقائياً —
 * وجود رابط ومفتاح سوبابيس صالحين يعني supabase، ولا نسقط أبداً إلى mock بصمت.
 */

import type { DataAdapter } from '@/data/adapter'
import { mockAdapter } from '@/data/mock/adapter'
import { supabaseAdapter } from '@/data/supabase/adapter'
import {
  isSupabaseConfigured,
  supabaseConfigProblem,
  supabaseUrl,
} from '@/data/supabase/client'

export type BackendName = 'supabase' | 'mock'

const declared = String(import.meta.env.VITE_DATA_BACKEND ?? '').trim().toLowerCase()

export const backend: BackendName =
  declared === 'supabase'
    ? 'supabase'
    : declared === 'mock'
      ? 'mock'
      : isSupabaseConfigured
        ? 'supabase'
        : 'mock'

/** يُعرض في صفحة /__health وفي شاشة الخطأ. */
export const backendDiagnostics = {
  declared: declared || '(غير محدد)',
  resolved: backend,
  supabaseUrl: supabaseUrl || '(فارغ)',
  supabaseConfigured: isSupabaseConfigured,
  supabaseProblem: supabaseConfigProblem,
  defaultTenant:
    String(import.meta.env.VITE_DEFAULT_TENANT ?? '').trim() || 'zaytouna',
}

if (declared === 'supabase' && !isSupabaseConfigured) {
  console.error(
    '[maweid] VITE_DATA_BACKEND=supabase لكن المفاتيح ناقصة →',
    supabaseConfigProblem,
  )
}
console.info('[maweid] backend =', backend, backendDiagnostics)

export const data: DataAdapter = backend === 'supabase' ? supabaseAdapter : mockAdapter

export { store } from '@/data/mock/store'
export * from '@/data/adapter'
export * from '@/data/domain'
export * from '@/data/errors'
