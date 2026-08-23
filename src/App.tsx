import { BrowserRouter } from 'react-router-dom'
import { LocaleProvider } from './contexts/LocaleContext'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { AppRoutes } from './routes'

// import.meta.env.BASE_URL = '/' محلياً و '/ma/' على GitHub Pages
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <LocaleProvider defaultLocale="ar">
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter basename={basename || undefined}>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </LocaleProvider>
  )
}
