import { Outlet, useParams } from 'react-router-dom'
import { TenantProvider, useTenant } from '@/contexts/TenantContext'
import { Header } from '@/components/shared/Header'
import { Footer } from '@/components/shared/Footer'
import { Spinner, EmptyState } from '@/components/ui'
import { useLocale } from '@/contexts/LocaleContext'
import { backend, backendDiagnostics } from '@/data'

function Gate({ slug }: { slug: string }) {
  const { bundle, loading, error, reload } = useTenant()
  const { t } = useLocale()

  if (loading) {
    return (
      <div className="page-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (error || !bundle) {
    const code = error ?? 'empty_bundle'
    const hint =
      backend !== 'supabase'
        ? 'التطبيق يعمل حالياً على بيانات وهمية: اضبط VITE_DATA_BACKEND=supabase.'
        : backendDiagnostics.supabaseProblem
          ? backendDiagnostics.supabaseProblem
          : code === 'tenant_not_found'
            ? 'لا يوجد صالون بهذا المعرّف في قاعدة البيانات: تحقق من عمود slug في جدول tenants.'
            : code === 'forbidden'
              ? 'قاعدة البيانات رفضت الطلب: تأكد من تنفيذ قسم GRANT/RLS في ملف SQL.'
              : 'تعذّر الاتصال بقاعدة البيانات: راجع الكونسول لمزيد من التفاصيل.'

    return (
      <div className="page-center" style={{ flexDirection: 'column', gap: 16 }}>
        <EmptyState
          icon="✕"
          title={t('error.tenant_not_found')}
          body={t('error.tenant_not_found_body')}
        />

        <div
          dir="rtl"
          style={{
            maxWidth: 560,
            width: '100%',
            border: '1px solid rgba(0,0,0,.12)',
            borderRadius: 12,
            padding: 16,
            fontSize: 14,
            lineHeight: 1.8,
            background: 'rgba(0,0,0,.02)',
          }}
        >
          <strong>تشخيص:</strong>
          <ul style={{ margin: '8px 0', paddingInlineStart: 20 }}>
            <li>رمز الخطأ: <code>{code}</code></li>
            <li>المعرّف المطلوب: <code>{slug}</code></li>
            <li>مصدر البيانات: <code>{backend}</code> (المعلن: <code>{backendDiagnostics.declared}</code>)</li>
            <li>رابط سوبابيس: <code>{backendDiagnostics.supabaseUrl}</code></li>
          </ul>
          <p style={{ margin: '8px 0' }}>{hint}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={reload}>
              إعادة المحاولة
            </button>
            <a className="btn" href="/__health">
              فحص الاتصال
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="site-layout">
      <Header />
      <main className="site-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export function TenantLayout() {
  const { slug } = useParams<{ slug: string }>()
  const resolvedSlug =
    slug || (import.meta.env.VITE_DEFAULT_TENANT as string) || 'zaytouna'

  return (
    <TenantProvider slug={resolvedSlug}>
      <Gate slug={resolvedSlug} />
    </TenantProvider>
  )
}
