import { useState, useEffect } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { TenantProvider, useTenant } from '@/contexts/TenantContext'
import { Header } from '@/components/shared/Header'
import { Footer } from '@/components/shared/Footer'
import { Spinner, EmptyState } from '@/components/ui'
import { useLocale } from '@/contexts/LocaleContext'
import { copyText } from '@/lib/copyText'
import { data, backend, backendDiagnostics } from '@/data'
import { identifyDevice } from '@/lib/device'
import { applyHead } from '@/lib/head'
import {
  isSupabaseConfigured,
  supabaseNotices,
  supabaseKeyKind,
  supabaseAnonKey,
  supabaseProjectRef,
  maskKey,
} from '@/data/supabase/client'

function useSlug(): string {
  const { slug } = useParams<{ slug: string }>()
  return slug || (import.meta.env.VITE_DEFAULT_TENANT as string) || 'zaytouna'
}

function Failure({ slug }: { slug: string }) {
  const { bundle, loading, error, reload } = useTenant()
  const { t, dir } = useLocale()
  const [copied, setCopied] = useState(false)

  if (loading) {
    return (
      <div className="page-center">
        <Spinner size={32} />
      </div>
    )
  }
  if (bundle) return null

  const code = error ?? 'empty_bundle'

  const copyDiagnostics = async () => {
    const diag = {
      backend,
      declared: backendDiagnostics.declared,
      slug,
      projectRef: supabaseProjectRef,
      keyKind: supabaseKeyKind,
      maskedKey: maskKey(supabaseAnonKey),
      notices: supabaseNotices,
      errorCode: code,
      timestamp: new Date().toISOString(),
    }
    const ok = await copyText(JSON.stringify(diag, null, 2))
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  // 1. Misconfigured build state
  if (!isSupabaseConfigured) {
    return (
      <div className="page-center" style={{ flexDirection: 'column', gap: 16 }}>
        <EmptyState
          icon="⚠️"
          title={t('error.misconfigured_title')}
          body={t('error.misconfigured_body')}
        />
        <div
          dir={dir}
          style={{
            maxWidth: 580,
            width: '100%',
            border: '1px solid var(--mw-line, rgba(0,0,0,.12))',
            borderRadius: 12,
            padding: 16,
            fontSize: 14,
            lineHeight: 1.8,
            background: 'var(--mw-surface-2, rgba(0,0,0,.02))',
          }}
        >
          <strong>{t('error.diagnostic_title')}:</strong>
          <ul style={{ margin: '8px 0', paddingInlineStart: 20 }}>
            {supabaseNotices.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <p style={{ margin: '8px 0', fontWeight: 500, color: 'var(--mw-err, #d32f2f)' }}>
            {t('error.misconfigured_remediation')}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockStart: 12 }}>
            <button type="button" className="btn btn--sm" onClick={copyDiagnostics}>
              {copied ? t('error.diagnostics_copied') : t('error.copy_diagnostics')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 2. Unreachable server state
  if (code === 'network' || code === 'unknown' || code === 'empty_bundle') {
    return (
      <div className="page-center" style={{ flexDirection: 'column', gap: 16 }}>
        <EmptyState
          icon="📡"
          title={t('error.unreachable_title')}
          body={t('error.unreachable_body')}
        />
        <div
          dir={dir}
          style={{
            maxWidth: 580,
            width: '100%',
            border: '1px solid var(--mw-line, rgba(0,0,0,.12))',
            borderRadius: 12,
            padding: 16,
            fontSize: 14,
            lineHeight: 1.8,
            background: 'var(--mw-surface-2, rgba(0,0,0,.02))',
          }}
        >
          <strong>{t('error.diagnostic_title')}:</strong>
          <ul style={{ margin: '8px 0', paddingInlineStart: 20 }}>
            <li>{t('error.diagnostic_code')}: <code>{code}</code></li>
            <li>{t('error.diagnostic_slug')}: <code>{slug}</code></li>
            <li>{t('error.diagnostic_backend')}: <code>{backend}</code></li>
          </ul>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockStart: 12 }}>
            <button type="button" className="btn btn--primary btn--sm" onClick={reload}>
              {t('action.retry')}
            </button>
            <button type="button" className="btn btn--sm" onClick={copyDiagnostics}>
              {copied ? t('error.diagnostics_copied') : t('error.copy_diagnostics')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 3. Not found or not published state
  return (
    <div className="page-center" style={{ flexDirection: 'column', gap: 16 }}>
      <EmptyState
        icon="✕"
        title={t('error.tenant_not_published_title')}
        body={t('error.tenant_not_published_body')}
      />
      <div
        dir={dir}
        style={{
          maxWidth: 580,
          width: '100%',
          border: '1px solid var(--mw-line, rgba(0,0,0,.12))',
          borderRadius: 12,
          padding: 16,
          fontSize: 14,
          lineHeight: 1.8,
          background: 'var(--mw-surface-2, rgba(0,0,0,.02))',
        }}
      >
        <strong>{t('error.diagnostic_title')}:</strong>
        <ul style={{ margin: '8px 0', paddingInlineStart: 20 }}>
          <li>{t('error.diagnostic_code')}: <code>{code}</code></li>
          <li>{t('error.diagnostic_slug')}: <code>{slug}</code></li>
          <li>{t('error.diagnostic_backend')}: <code>{backend}</code></li>
        </ul>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockStart: 12 }}>
          <button type="button" className="btn btn--primary btn--sm" onClick={reload}>
            {t('action.retry')}
          </button>
          <button type="button" className="btn btn--sm" onClick={copyDiagnostics}>
            {copied ? t('error.diagnostics_copied') : t('error.copy_diagnostics')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** الموقع العام: الهيدر والفوتر يُرسمان هنا فقط، ولا تُعيدهما أي صفحة. */
function PublicFrame({ slug }: { slug: string }) {
  const { bundle } = useTenant()
  const { locale } = useLocale()

  useEffect(() => {
    if (slug) {
      void identifyDevice(data, slug).catch((e) => console.warn('[device] identify failed', e))
    }
  }, [slug])

  useEffect(() => {
    if (!bundle) return
    const primary = (bundle.staff ?? [])
      .filter((s) => s.isActive)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .find((s) => s.avatarUrl)
    applyHead({ tenant: bundle.tenant, locale, photoUrl: primary?.avatarUrl ?? null })
  }, [bundle, locale])

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
