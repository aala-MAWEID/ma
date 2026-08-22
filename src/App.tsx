import { BrowserRouter } from 'react-router-dom'
import { LocaleProvider } from './contexts/LocaleContext'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { AppRoutes } from './routes'

export default function App() {
  return (
    <LocaleProvider defaultLocale="ar">
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </LocaleProvider>
  )
}
