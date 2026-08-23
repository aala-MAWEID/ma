import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[maweid] انهارت الواجهة:', error, info.componentStack)
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="page-center" dir="rtl">
        <div className="auth-card">
          <h1 className="auth-card__title">حدث خلل غير متوقّع</h1>
          <p className="auth-card__subtitle">
            الصفحة لم تكتمل. التفاصيل التقنية أدناه.
          </p>
          <pre
            dir="ltr"
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: 12,
              background: 'rgba(0,0,0,.04)',
              padding: 12,
              borderRadius: 8,
              maxWidth: 520,
              overflowX: 'auto',
            }}
          >
            {error.message}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => window.location.reload()}
            >
              إعادة التحميل
            </button>
            <a href={import.meta.env.BASE_URL} className="btn btn--outline">
              الصفحة الرئيسية
            </a>
          </div>
        </div>
      </div>
    )
  }
}
