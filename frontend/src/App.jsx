import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { GuestOnly, RequireAuth } from '@/features/auth/routeGuards'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { FullPageLoader } from '@/components/ui/Spinner'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { AppShell } from '@/components/layout/AppShell'
import { FACULTY_ROLES } from '@/lib/utils'
import { BOOKING_ROLES } from '@/features/bookings/bookingsApi'

// Route-level code splitting: a student never downloads the admin screens.
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const UsersPage = lazy(() => import('@/pages/users/UsersPage'))
const UserDetailPage = lazy(() => import('@/pages/users/UserDetailPage'))
const ModulePreviewPage = lazy(() => import('@/pages/ModulePreviewPage'))
const VenuesPage = lazy(() => import('@/pages/venues/VenuesPage'))
const VenueDetailPage = lazy(() => import('@/pages/venues/VenueDetailPage'))
const NewBookingPage = lazy(() => import('@/pages/bookings/NewBookingPage'))
const BookingsPage = lazy(() => import('@/pages/bookings/BookingsPage'))
const StatusPage = lazy(() => import('@/pages/StatusPage'))

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route index element={<Navigate to="/dashboard" replace />} />

        <Route element={<GuestOnly />}>
          <Route element={<AuthLayout />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
          </Route>
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="venues" element={<VenuesPage />} />
            <Route path="venues/:id" element={<VenueDetailPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route element={<RequireAuth roles={BOOKING_ROLES} />}>
              <Route path="bookings/new" element={<NewBookingPage />} />
            </Route>
            <Route path="events" element={<ModulePreviewPage module="events" />} />
            <Route element={<RequireAuth roles={FACULTY_ROLES} />}>
              <Route path="users" element={<UsersPage />} />
              <Route path="users/:id" element={<UserDetailPage />} />
            </Route>
            <Route path="forbidden" element={<StatusPage variant="forbidden" />} />
          </Route>
        </Route>

        <Route path="*" element={<StatusPage variant="notFound" />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
