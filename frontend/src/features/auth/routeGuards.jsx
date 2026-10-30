import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './authContext'
import { FullPageLoader } from '@/components/ui/Spinner'

/** Signed-in users only; remembers where they were going. */
export function RequireAuth({ roles }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (roles && !roles.includes(user.role.key)) return <Navigate to="/forbidden" replace />
  return <Outlet />
}

/**
 * Sign-in pages: a signed-in user goes straight to the app - to the page
 * they were originally sent away from, if any. This guard re-renders the
 * moment sign-in succeeds, so it (not the login page) decides where to land.
 */
export function GuestOnly() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageLoader />
  if (status === 'authenticated') {
    const from = location.state?.from
    const safe = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
    return <Navigate to={safe ? from : '/dashboard'} replace />
  }
  return <Outlet />
}
