import { api } from '@/lib/api'

export const attendanceApi = {
  get: (eventId, { signal } = {}) => api.get(`/events/${eventId}/attendance`, { signal }).then((r) => r.data),
  mark: (eventId, marks) => api.post(`/events/${eventId}/attendance`, { marks }).then((r) => r.data),
}
