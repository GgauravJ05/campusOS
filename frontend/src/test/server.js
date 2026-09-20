import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

/**
 * A fake CampusOS API at the network layer. Components and the real api
 * client run unchanged; only the server is simulated, using the exact
 * response envelope the backend sends.
 */

export const API = 'http://localhost:3000/api'

export const ok = (data, meta, init) => HttpResponse.json(meta ? { success: true, data, meta } : { success: true, data }, init)
export const fail = (status, code, message, details) =>
  HttpResponse.json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, { status })

export const departments = [
  { id: 1, code: 'IT', name: 'Information Technology' },
  { id: 2, code: 'CS', name: 'Computer Engineering' },
]

export function makeUser(overrides = {}) {
  return {
    id: 10,
    fullName: 'Asha Kulkarni',
    email: 'asha.kulkarni@mmcoe.edu.in',
    phone: null,
    academicYear: 2,
    avatarUrl: null,
    department: departments[0],
    role: { key: 'STUDENT', name: 'Student / Participant', rank: 5 },
    isVerified: true,
    isActive: true,
    lastLoginAt: '2026-09-15T08:00:00.000Z',
    createdAt: '2026-09-01T08:00:00.000Z',
    clubs: [],
    ...overrides,
  }
}

export const coordinator = makeUser({
  id: 2,
  fullName: 'Nishanti Naidu',
  email: 'gaurav.coordinator.it@mmcoe.edu.in',
  academicYear: null,
  role: { key: 'DEPT_COORDINATOR', name: 'Department Event Coordinator', rank: 2 },
})

export const emptySummary = { awaitingDecision: 0, myChangesRequested: 0, myAwaitingApproval: 0, unreadNotifications: 0 }

export const session = (user) => ({ accessToken: `token-for-${user.id}`, accessTokenExpiresIn: 900, user })

/** Current signed-in user for the refresh endpoint; null = no session cookie. */
export const state = { sessionUser: null }

export const handlers = [
  http.post(`${API}/auth/refresh`, () =>
    state.sessionUser ? ok(session(state.sessionUser)) : fail(401, 'INVALID_SESSION', 'No active session')),
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.get(`${API}/directory/departments`, () => ok(departments)),
  http.get(`${API}/auth/me`, () => (state.sessionUser ? ok(state.sessionUser) : fail(401, 'AUTH_REQUIRED', 'Sign in'))),
  // The app shell asks for badge counts on every page; tests override these when they care.
  http.get(`${API}/bookings/summary`, () => ok(emptySummary)),
  http.get(`${API}/notifications`, () => ok([], { page: 1, pageSize: 8, total: 0, totalPages: 0, unread: 0 })),
]

export const server = setupServer(...handlers)
