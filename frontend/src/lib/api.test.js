import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API, fail, makeUser, ok, server, session, state } from '@/test/server'
import { acceptSession, api, ApiError, onSessionChange, refreshSession, request, tokenStore } from './api'

describe('api client', () => {
  it('unwraps the success envelope into data and meta', async () => {
    server.use(http.get(`${API}/things`, () => ok([{ id: 1 }], { total: 1 })))
    await expect(request('/things', { auth: false })).resolves.toEqual({ data: [{ id: 1 }], meta: { total: 1 } })
  })

  it('serialises query parameters and skips empty ones', async () => {
    let seen
    server.use(http.get(`${API}/things`, ({ request: req }) => {
      seen = new URL(req.url).search
      return ok([])
    }))
    await request('/things', { auth: false, query: { q: 'asha', role: '', page: 2, missing: undefined } })
    expect(seen).toBe('?q=asha&page=2')
  })

  it('turns the error envelope into an ApiError with field errors', async () => {
    server.use(http.post(`${API}/things`, () =>
      fail(422, 'VALIDATION_ERROR', 'Invalid', [{ field: 'email', message: 'Bad email' }, { field: 'email', message: 'second' }])))

    const err = await request('/things', { method: 'POST', body: {}, auth: false }).catch((e) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 422, code: 'VALIDATION_ERROR', message: 'Invalid' })
    expect(err.fieldErrors).toEqual({ email: 'Bad email' })
  })

  it('reports a non-JSON server failure clearly', async () => {
    server.use(http.get(`${API}/things`, () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })))
    const err = await request('/things', { auth: false }).catch((e) => e)
    expect(err).toMatchObject({ status: 502, code: 'SERVER_ERROR' })
    expect(err.fieldErrors).toEqual({})
  })

  it('reports a network failure as NETWORK_ERROR', async () => {
    server.use(http.get(`${API}/things`, () => HttpResponse.error()))
    const err = await request('/things', { auth: false }).catch((e) => e)
    expect(err.code).toBe('NETWORK_ERROR')
  })

  it('returns null data for 204 responses', async () => {
    server.use(http.delete(`${API}/things/1`, () => new HttpResponse(null, { status: 204 })))
    acceptSession({ accessToken: 't', accessTokenExpiresIn: 900 })
    await expect(api.del('/things/1')).resolves.toEqual({ data: null, meta: undefined })
  })

  it('sends the in-memory access token as a bearer header', async () => {
    let auth
    server.use(http.get(`${API}/private`, ({ request: req }) => {
      auth = req.headers.get('authorization')
      return ok('secret')
    }))
    acceptSession({ accessToken: 'abc', accessTokenExpiresIn: 900 })

    await api.get('/private')

    expect(auth).toBe('Bearer abc')
  })

  it('never stores the token in web storage', () => {
    acceptSession({ accessToken: 'abc', accessTokenExpiresIn: 900 })
    expect(JSON.stringify({ ...localStorage })).not.toContain('abc')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('abc')
  })

  it('refreshes once and replays the request when the token has expired', async () => {
    state.sessionUser = makeUser()
    let calls = 0
    server.use(http.get(`${API}/private`, ({ request: req }) => {
      calls += 1
      return req.headers.get('authorization') === 'Bearer token-for-10' ? ok('ok') : fail(401, 'TOKEN_EXPIRED', 'Expired')
    }))
    acceptSession({ accessToken: 'old', accessTokenExpiresIn: 900 })

    await expect(api.get('/private')).resolves.toMatchObject({ data: 'ok' })
    expect(calls).toBe(2)
  })

  it('shares one refresh between concurrent expired requests', async () => {
    state.sessionUser = makeUser()
    let refreshes = 0
    server.use(
      http.post(`${API}/auth/refresh`, async () => {
        refreshes += 1
        await new Promise((r) => setTimeout(r, 20))
        return ok(session(state.sessionUser))
      }),
      http.get(`${API}/private`, ({ request: req }) =>
        req.headers.get('authorization') === 'Bearer token-for-10' ? ok('ok') : fail(401, 'TOKEN_EXPIRED', 'Expired')),
    )
    acceptSession({ accessToken: 'old', accessTokenExpiresIn: 900 })

    await Promise.all([api.get('/private'), api.get('/private'), api.get('/private')])

    expect(refreshes).toBe(1)
  })

  it('refreshes proactively when the token is about to expire', async () => {
    state.sessionUser = makeUser()
    let auth
    server.use(http.get(`${API}/private`, ({ request: req }) => {
      auth = req.headers.get('authorization')
      return ok('ok')
    }))
    acceptSession({ accessToken: 'nearly-expired', accessTokenExpiresIn: 10 })

    await api.get('/private')

    expect(auth).toBe('Bearer token-for-10')
  })

  it('retries a stale refresh once, as happens when another tab rotated first', async () => {
    let attempts = 0
    server.use(http.post(`${API}/auth/refresh`, () => {
      attempts += 1
      return attempts === 1 ? fail(401, 'SESSION_STALE', 'Stale') : ok(session(makeUser()))
    }))

    await expect(refreshSession()).resolves.toMatchObject({ accessToken: 'token-for-10' })
    expect(attempts).toBe(2)
  })

  it('ends the session and notifies listeners when refresh fails', async () => {
    const listener = vi.fn()
    onSessionChange(listener)
    acceptSession({ accessToken: 'old', accessTokenExpiresIn: 900 })

    await expect(refreshSession()).rejects.toMatchObject({ code: 'INVALID_SESSION' })

    expect(tokenStore.get()).toBeNull()
    expect(listener).toHaveBeenCalledWith(null)
  })

  it('signs out locally on a revoked session without trying to refresh', async () => {
    const listener = vi.fn()
    onSessionChange(listener)
    let refreshes = 0
    server.use(
      http.post(`${API}/auth/refresh`, () => { refreshes += 1; return fail(401, 'INVALID_SESSION', 'x') }),
      http.get(`${API}/private`, () => fail(401, 'SESSION_REVOKED', 'Signed out elsewhere')),
    )
    acceptSession({ accessToken: 'abc', accessTokenExpiresIn: 900 })

    await expect(api.get('/private')).rejects.toMatchObject({ code: 'SESSION_REVOKED' })
    expect(refreshes).toBe(0)
    expect(listener).toHaveBeenCalledWith(null)
  })

  it('passes non-auth errors straight through', async () => {
    server.use(http.patch(`${API}/private`, () => fail(403, 'FORBIDDEN', 'No')))
    acceptSession({ accessToken: 'abc', accessTokenExpiresIn: 900 })
    await expect(api.patch('/private', {})).rejects.toMatchObject({ status: 403 })
    expect(tokenStore.get()).toBe('abc')
  })
})
