import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server, state } from './server'
import { __resetApiState } from '@/lib/api'

// jsdom has no matchMedia; the theme provider reads it.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
  state.sessionUser = null
  __resetApiState()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterAll(() => server.close())
