/**
 * The one HTTP client for the CampusOS API. Components never call fetch
 * directly - they call the feature modules, which call `api`.
 *
 * Session model (see backend/README.md):
 *   - the access token lives in memory only (never localStorage), so an XSS
 *     bug cannot lift a session out of storage
 *   - the refresh token is an httpOnly cookie the browser sends to
 *     /api/auth/refresh on its own; JavaScript never sees it
 *
 * When a request fails because the access token expired, the client
 * refreshes once and replays the request. Concurrent failures share one
 * refresh, and tabs coordinate through the Web Locks API so two tabs never
 * rotate the same refresh token at the same time.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

/** Refresh this many ms before expiry rather than waiting for a 401. */
const EXPIRY_SKEW_MS = 30_000

/** Codes after which a refresh + replay can succeed. */
const RETRYABLE_AUTH_CODES = new Set(['TOKEN_EXPIRED', 'INVALID_TOKEN'])

export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message || 'Something went wrong')
    this.name = 'ApiError'
    this.status = status
    this.code = code || 'UNKNOWN_ERROR'
    this.details = details
    this.requestId = requestId
  }

  /** Field-level messages keyed by field name, for forms. */
  get fieldErrors() {
    if (!Array.isArray(this.details)) return {}
    return this.details.reduce((acc, { field, message }) => {
      if (field && !acc[field]) acc[field] = message
      return acc
    }, {})
  }
}

// ---------------------------------------------------------------------------
// Access token (memory only)
// ---------------------------------------------------------------------------

let session = { accessToken: null, expiresAt: 0 }
const listeners = new Set()

export const tokenStore = {
  get: () => session.accessToken,
  set(accessToken, expiresInSeconds) {
    session = { accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 }
  },
  clear() {
    session = { accessToken: null, expiresAt: 0 }
  },
  isFresh: () => Boolean(session.accessToken) && Date.now() < session.expiresAt - EXPIRY_SKEW_MS,
}

/** Called with the new session after every refresh, or null when the session ends. */
export function onSessionChange(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(value) {
  listeners.forEach((listener) => listener(value))
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

function buildUrl(path, query) {
  const url = `${BASE_URL}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

async function send(path, { method = 'GET', body, query, token, signal } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Cannot reach CampusOS. Check your connection and try again.' })
  }

  const requestId = response.headers.get('x-request-id') || undefined
  if (response.status === 204) return { data: null, meta: undefined }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    // Non-JSON (a proxy error page, for instance) falls through to the generic error.
  }

  if (!response.ok || !payload?.success) {
    const error = payload?.error || {}
    throw new ApiError({
      status: response.status,
      code: error.code || (response.status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED'),
      message: error.message || `Request failed (${response.status})`,
      details: error.details,
      requestId,
    })
  }

  return { data: payload.data, meta: payload.meta }
}

// ---------------------------------------------------------------------------
// Refresh (single flight, cross-tab)
// ---------------------------------------------------------------------------

let refreshInFlight = null

async function performRefresh() {
  try {
    const { data } = await send('/auth/refresh', { method: 'POST' })
    return data
  } catch (err) {
    // Another tab rotated the cookie a moment ago; the browser now holds the
    // successor, so one retry succeeds.
    if (err.code === 'SESSION_STALE') {
      const { data } = await send('/auth/refresh', { method: 'POST' })
      return data
    }
    throw err
  }
}

function withCrossTabLock(task) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('campusos-session-refresh', task)
  }
  return task()
}

/**
 * Exchanges the refresh cookie for a new access token.
 * @returns {Promise<{ accessToken: string, accessTokenExpiresIn: number, user: object }>}
 */
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = withCrossTabLock(performRefresh)
      .then((data) => {
        tokenStore.set(data.accessToken, data.accessTokenExpiresIn)
        emit(data)
        return data
      })
      .catch((err) => {
        tokenStore.clear()
        emit(null)
        throw err
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

/** Stores a session returned by login / verify / change-password. */
export function acceptSession(data) {
  tokenStore.set(data.accessToken, data.accessTokenExpiresIn)
}

// ---------------------------------------------------------------------------
// Public request API
// ---------------------------------------------------------------------------

/**
 * @param {string} path  e.g. '/users'
 * @param {{ method?: string, body?: unknown, query?: object, auth?: boolean, signal?: AbortSignal }} [options]
 * @returns {Promise<{ data: any, meta?: any }>}
 */
export async function request(path, { auth = true, ...options } = {}) {
  if (!auth) return send(path, options)

  if (!tokenStore.isFresh() && tokenStore.get()) {
    await refreshSession().catch(() => {})
  }

  try {
    return await send(path, { ...options, token: tokenStore.get() })
  } catch (err) {
    if (err.status !== 401 || !RETRYABLE_AUTH_CODES.has(err.code)) {
      if (err.status === 401) {
        tokenStore.clear()
        emit(null)
      }
      throw err
    }
    await refreshSession()
    return send(path, { ...options, token: tokenStore.get() })
  }
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
}

/** Test hook. */
export function __resetApiState() {
  tokenStore.clear()
  refreshInFlight = null
  listeners.clear()
}
