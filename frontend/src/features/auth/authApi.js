import { api, request } from '@/lib/api'

const pub = (path, body) => request(path, { method: 'POST', body, auth: false }).then((r) => r.data)

export const authApi = {
  login: (email, password) => pub('/auth/login', { email, password }),
  register: (input) => pub('/auth/register', input),
  verifyEmail: (email, code) => pub('/auth/verify-email', { email, code }),
  resendVerification: (email) => pub('/auth/resend-verification', { email }),
  forgotPassword: (email) => pub('/auth/forgot-password', { email }),
  resetPassword: (email, code, newPassword) => pub('/auth/reset-password', { email, code, newPassword }),
  logout: () => request('/auth/logout', { method: 'POST', auth: false }),
  logoutEverywhere: () => api.post('/auth/logout-all'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  departments: () => request('/directory/departments', { auth: false }).then((r) => r.data),
}
