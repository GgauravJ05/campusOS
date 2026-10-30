import { useCallback, useEffect, useMemo, useState } from 'react'
import { acceptSession, onSessionChange, refreshSession, tokenStore } from '@/lib/api'
import { authApi } from './authApi'
import { AuthContext } from './authContext'

/**
 * Owns the signed-in user. On first load it asks the API for a session using
 * the httpOnly refresh cookie - that is how a page reload stays signed in
 * without ever storing a token in the browser.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null })

  useEffect(() => {
    let active = true
    refreshSession()
      .then((data) => active && setState({ status: 'authenticated', user: data.user }))
      .catch(() => active && setState({ status: 'guest', user: null }))

    const unsubscribe = onSessionChange((data) => {
      if (!active) return
      setState(data ? { status: 'authenticated', user: data.user } : { status: 'guest', user: null })
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const startSession = useCallback((data) => {
    acceptSession(data)
    setState({ status: 'authenticated', user: data.user })
    return data.user
  }, [])

  const login = useCallback(async (email, password) => startSession(await authApi.login(email, password)), [startSession])

  const verifyEmail = useCallback(async (email, code) => startSession(await authApi.verifyEmail(email, code)), [startSession])

  const changePassword = useCallback(
    async (currentPassword, newPassword) => startSession(await authApi.changePassword(currentPassword, newPassword)),
    [startSession],
  )

  const endLocalSession = useCallback(() => {
    tokenStore.clear()
    setState({ status: 'guest', user: null })
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      endLocalSession()
    }
  }, [endLocalSession])

  const logoutEverywhere = useCallback(async () => {
    try {
      await authApi.logoutEverywhere()
    } finally {
      endLocalSession()
    }
  }, [endLocalSession])

  const setUser = useCallback((user) => setState((s) => ({ ...s, user })), [])

  const reloadUser = useCallback(async () => {
    const user = await authApi.me()
    setUser(user)
    return user
  }, [setUser])

  const value = useMemo(
    () => ({ ...state, login, verifyEmail, changePassword, logout, logoutEverywhere, setUser, reloadUser }),
    [state, login, verifyEmail, changePassword, logout, logoutEverywhere, setUser, reloadUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
