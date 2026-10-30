import { api } from '@/lib/api'

export const usersApi = {
  list: (filters, { signal } = {}) => api.get('/users', { query: filters, signal }),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data),
  updateMe: (changes) => api.patch('/users/me', changes).then((r) => r.data),
  changeRole: (id, role, clubId) => api.patch(`/users/${id}/role`, { role, clubId: clubId ?? undefined }).then((r) => r.data),
  setActive: (id, isActive) => api.patch(`/users/${id}/status`, { isActive }).then((r) => r.data),
  appointableClubs: () => api.get('/directory/clubs', { query: { appointable: true } }).then((r) => r.data),
  departments: () => api.get('/directory/departments').then((r) => r.data),
}
