import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null; dismissed: boolean }

export class AdminErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, dismissed: false }

  static getDerivedStateFromError(error: Error): State {
    return { error, dismissed: false }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[maweid] انهارت الواجهة داخل لوحة التحكم:', error, info.componentStack)
  }

  override render() {
    const { error, dismissed } = this.state

    if (error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 'var(--space-4)' }}>
          {!dismissed && (
            <div className="alert alert--err" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>حدث خلل غير متوقّع في هذه الشاشة</strong>
                <button 
                  type="button" 
                  className="btn btn--quiet btn--sm" 
                  onClick={() => this.setState({ dismissed: true })}
                >
                  إخفاء
                </button>
              </div>
              <pre dir="ltr" style={{ fontSize: 12, opacity: 0.8, overflowX: 'auto', margin: 0 }}>
                {error.message}
              </pre>
            </div>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
