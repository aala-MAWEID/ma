import { useNavigate, useLocation, Link } from 'react-router-dom'
import { ChevronIcon, CloseIcon, RefreshIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

export function PageHeader({ 
  title, 
  description, 
  onClosePath,
  onRefresh,
  refreshing,
  onBack,
  hideBack,
  actions,
}: { 
  title: string
  description?: string
  onClosePath?: string
  onRefresh?: () => void
  refreshing?: boolean
  onBack?: () => void
  hideBack?: boolean
  actions?: React.ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()
  
  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    // If there's history within this app
    if (window.history.length > 2) {
      navigate(-1)
    } else {
      // Go up one level based on current path
      const parts = location.pathname.split('/').filter(Boolean)
      if (parts.length > 1) {
        parts.pop()
        navigate('/' + parts.join('/'))
      } else {
        navigate('/')
      }
    }
  }

  const handleClose = () => {
    if (onClosePath) {
      navigate(onClosePath)
    } else {
      // Find the tenant base if possible
      const parts = location.pathname.split('/').filter(Boolean)
      if (parts.length >= 1) {
        navigate('/' + parts[0])
      } else {
        navigate('/')
      }
    }
  }

  return (
    <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--mw-surface)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--mw-line)' }}>
      {!hideBack ? (
        <button className="btn-icon" onClick={handleBack} aria-label="رجوع">
          <ChevronIcon />
        </button>
      ) : (
        <div style={{ width: 44, height: 44 }} />
      )}
      
      <div style={{ flex: 1, textAlign: 'center', margin: '0 8px', overflow: 'hidden' }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        {description && <p style={{ margin: 0, fontSize: 13, color: 'var(--mw-ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{description}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {actions}
        {onRefresh && (
          <button className="btn-icon" onClick={onRefresh} aria-label="تحديث" disabled={refreshing}>
            <RefreshIcon className={refreshing ? 'spinner' : ''} />
          </button>
        )}
        <button className="btn-icon" onClick={handleClose} aria-label="إغلاق">
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
