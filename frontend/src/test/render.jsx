import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { AppRoutes } from '@/App'
import { state } from './server'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location" hidden>{location.pathname}</output>
}

/**
 * Renders the real application routes at `route`.
 *
 * @param {string} route
 * @param {{ user?: object, state?: object }} [options] `user` starts signed in
 */
export function renderApp(route, { user = null, state: routeState } = {}) {
  state.sessionUser = user
  const entry = routeState ? { pathname: route.split('?')[0], search: route.includes('?') ? `?${route.split('?')[1]}` : '', state: routeState } : route
  const utils = render(
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[entry]}>
          <AuthProvider>
            <AppRoutes />
            <LocationProbe />
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  )
  return { user: userEvent.setup(), ...utils }
}

export const currentPath = () => screen.getByTestId('location').textContent
