import { useEffect, useState } from 'react'
import { backend, backendDiagnostics } from '@/data'
import {
  keyProblem,
  maskKey,
  supabase,
  supabaseAnonKey,
  supabaseKeyKind,
  supabaseNotices,
  supabaseProjectRef,
  supabaseUrl,
  urlProblem,
} from '@/data/supabase/client'

type Check = { name: string; ok: boolean; detail: string }

export default function Health() {
  const [checks, setChecks] = useState<Check[]>([])
  const [busy, setBusy] = useState(true)
  const slug = backendDiagnostics.defaultTenant

  async function run() {
    setBusy(true)
    const out: Check[] = []

    out.push({
      name: 'مصدر البيانات',
      ok: backend === 'supabase',
      detail: `المعلن: ${backendDiagnostics.declared} — المستعمل: ${backend}`,
    })
    out.push({
      name: 'رابط المشروع',
      ok: urlProblem === null,
      detail: urlProblem ?? `${supabaseUrl}  (ref: ${supabaseProjectRef})`,
    })
    out.push({
      name: 'المفتاح العام',
      ok: keyProblem === null,
      detail: keyProblem ?? `${supabaseKeyKind} — ${maskKey(supabaseAnonKey)}`,
    })
    out.push({ name: 'الصالون الافتراضي', ok: !!slug, detail: slug })

    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      })
      out.push({
        name: 'اتصال REST',
        ok: res.status < 400,
        detail: `HTTP ${res.status}`,
      })
    } catch (e) {
      out.push({ name: 'اتصال REST', ok: false, detail: `تعذّر الاتصال: ${(e as Error).message}` })
    }

    const h = await supabase.rpc('health_check', { p_slug: slug })
    out.push({
      name: 'health_check()',
      ok: !h.error,
      detail: h.error ? `${h.error.code ?? ''} ${h.error.message}` : JSON.stringify(h.data),
    })

    const b = await supabase.rpc('get_tenant_bundle', { p_slug: slug })
    const tenantName = (b.data as { tenant?: { name?: string } } | null)?.tenant?.name
    out.push({
      name: `get_tenant_bundle('${slug}')`,
      ok: !b.error && !!tenantName,
      detail: b.error
        ? `${b.error.code ?? ''} ${b.error.message}`
        : (tenantName ?? 'أرجعت قيمة فارغة — لا يوجد صالون بهذا المعرّف'),
    })

    const s = await supabase.auth.getSession()
    const email = s.data.session?.user?.email
    out.push({
      name: 'الجلسة',
      ok: true,
      detail: email ? `مسجّل الدخول: ${email}` : 'زائر (غير مسجّل) — طبيعي في الصفحات العامة',
    })

    if (email) {
      const w = await supabase.rpc('whoami')
      const row = Array.isArray(w.data) ? w.data[0] : w.data
      out.push({
        name: 'whoami()',
        ok: !w.error && !!row,
        detail: w.error
          ? `${w.error.code ?? ''} ${w.error.message}`
          : row
            ? `${(row as { role?: string }).role ?? '؟'} @ ${(row as { tenant_slug?: string }).tenant_slug ?? '—'}`
            : 'لا يوجد ربط — نفّذ bind_owner في SQL Editor',
      })
    }

    setChecks(out)
    setBusy(false)
  }

  useEffect(() => {
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      dir="rtl"
      style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto' }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>فحص الاتصال بسوبابيس</h1>
      <p style={{ opacity: 0.7, marginBottom: 16 }}>صفحة تشخيص داخلية — /__health</p>

      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        style={{ marginBottom: 16, padding: '8px 16px', borderRadius: 8 }}
      >
        {busy ? 'جارٍ الفحص…' : 'إعادة الفحص'}
      </button>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'start', padding: 8, borderBottom: '1px solid #ddd' }}>الفحص</th>
            <th style={{ textAlign: 'start', padding: 8, borderBottom: '1px solid #ddd' }}>الحالة</th>
            <th style={{ textAlign: 'start', padding: 8, borderBottom: '1px solid #ddd' }}>التفاصيل</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.name}>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{c.name}</td>
              <td
                style={{
                  padding: 8,
                  borderBottom: '1px solid #f0f0f0',
                  color: c.ok ? 'green' : 'crimson',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.ok ? '✓ سليم' : '✕ خطأ'}
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', wordBreak: 'break-all' }}>
                {c.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {supabaseNotices.length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 12,
            background: 'rgba(255,180,0,.12)',
            fontSize: 14,
            lineHeight: 1.9,
          }}
        >
          <strong>ملاحظات الإعداد:</strong>
          <ul style={{ margin: '8px 0 0', paddingInlineStart: 20 }}>
            {supabaseNotices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
