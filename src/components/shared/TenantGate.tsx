import { Outlet, useParams } from 'react-router-dom'
import { TenantProvider, useTenant } from '@/contexts/TenantContext'
import { Header } from '@/components/shared/Header'
import { Footer } from '@/components/shared/Footer'
import { Spinner, EmptyState } from '@/components/ui'
import { useLocale } from '@/contexts/LocaleContext'
import { backend, backendDiagnostics } from '@/data'

function useSlug(): string {
  const { slug } = useParams<{ slug: string }>()
  return slug || (import.meta.env.VITE_DEFAULT_TENANT as string) || 'zaytouna'
}

function Failure({ slug }: { slug: string }) {
  const { bundle, loading, error, reload } = useTenant()
  const { t } = useLocale()

  if (loading) {
    return (
      <div className="page-center">
        <Spinner size={32} />
      </div>
    )
  }
  if (bundle) return null

  const code = error ?? 'empty_bundle'
  const hint =
    backend !== 'supabase'
      ? 'التطبيق يعمل حالياً على بيانات وهمية: اضبط VITE_DATA_BACKEND=supabase.'
      : backendDiagnostics.supabaseProblem
        ? backendDiagnostics.supabaseProblem
        : code === 'tenant_not_found'
          ? 'لا يوجد صالون بهذا المعرّف: تحقق من عمود slug في جدول tenants.'
          : code === 'forbidden'
            ? 'قاعدة البيانات رفضت الطلب: تأكد من تنفيذ قسم GRANT/RLS.'
            : 'تعذّر الاتصال بقاعدة البيانات: راجع الكونسول.'

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
          <button type="button" className="btn" onClick={reload}>إعادة المحاولة</button>
        </div>
      </div>
    </div>
  )
}

/** الموقع العام: الهيدر والفوتر يُرسمان هنا فقط، ولا تُعيدهما أي صفحة. */
function PublicFrame({ slug }: { slug: string }) {
  const { bundle } = useTenant()
  if (!bundle) return <Failure slug={slug} />
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
  const slug = useSlug()
  return (
    <TenantProvider slug={slug}>
      <PublicFrame slug={slug} />
    </TenantProvider>
  )
}

/** اللوحة وصفحة الدخول: نفس TenantProvider بلا هيدر ولا فوتر. */
function ScopeBody({ slug }: { slug: string }) {
  const { bundle } = useTenant()
  if (!bundle) return <Failure slug={slug} />
  return <Outlet />
}

export function TenantScope() {
  const slug = useSlug()
  return (
    <TenantProvider slug={slug}>
      <ScopeBody slug={slug} />
    </TenantProvider>
  )
}
