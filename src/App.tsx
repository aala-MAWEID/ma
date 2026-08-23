import { BrowserRouter } from 'react-router-dom'
import { LocaleProvider } from './contexts/LocaleContext'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { AppRoutes } from './routes'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <ErrorBoundary>
      <LocaleProvider defaultLocale="ar">
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter basename={basename || undefined}>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </ErrorBoundary>
  )
}
