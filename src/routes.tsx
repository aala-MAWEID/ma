import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { TenantLayout } from './components/shared/TenantGate'
import { Spinner } from './components/ui'

const Home = lazy(() => import('./pages/public/Home'))
const Book = lazy(() => import('./pages/public/Book'))
const QueueLive = lazy(() => import('./pages/public/QueueLive'))
const Confirm = lazy(() => import('./pages/public/Confirm'))
const Me = lazy(() => import('./pages/public/Me'))
const Health = lazy(() => import('./pages/dev/Health'))

const AdminShell = lazy(() => import('./pages/admin/AdminShell'))
const Calendar = lazy(() => import('./pages/admin/Calendar'))
const QueueBoard = lazy(() => import('./pages/admin/QueueBoard'))
const Requests = lazy(() => import('./pages/admin/Requests'))
const Customers = lazy(() => import('./pages/admin/Customers'))
const Staff = lazy(() => import('./pages/admin/Staff'))
const Services = lazy(() => import('./pages/admin/Services'))
const Identity = lazy(() => import('./pages/admin/Identity'))
const Settings = lazy(() => import('./pages/admin/Settings'))
const Stats = lazy(() => import('./pages/admin/Stats'))
const Profile = lazy(() => import('./pages/admin/Profile'))
const Login = lazy(() => import('./pages/admin/Login'))

export function AppRoutes() {
  const defaultTenant = (import.meta.env.VITE_DEFAULT_TENANT as string) || 'zaytouna'

  return (
    <Suspense
      fallback={
        <div className="page-center">
          <Spinner size={32} />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to={`/${defaultTenant}`} replace />} />
        <Route path="/__health" element={<Health />} />

        {/* Public Routes scoped by :slug */}
        <Route path="/:slug" element={<TenantLayout />}>
          <Route index element={<Home />} />
          <Route path="book" element={<Book />} />
          <Route path="queue" element={<QueueLive />} />
          <Route path="confirm/:code" element={<Confirm />} />
          <Route path="me" element={<Me />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/:slug/admin/login" element={<Login />} />
        <Route path="/:slug/admin" element={<AdminShell />}>
          <Route index element={<Navigate to="agenda" replace />} />
          <Route path="agenda" element={<Calendar />} />
          <Route path="queue" element={<QueueBoard />} />
          <Route path="requests" element={<Requests />} />
          <Route path="customers" element={<Customers />} />
          <Route path="staff" element={<Staff />} />
          <Route path="services" element={<Services />} />
          <Route path="identity" element={<Identity />} />
          <Route path="settings" element={<Settings />} />
          <Route path="stats" element={<Stats />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={`/${defaultTenant}`} replace />} />
      </Routes>
    </Suspense>
  )
}
