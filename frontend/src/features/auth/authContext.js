import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

/** @returns {{ status: 'loading'|'authenticated'|'guest', user: object|null, login: Function, verifyEmail: Function, changePassword: Function, logout: Function, logoutEverywhere: Function, setUser: Function, reloadUser: Function }} */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
