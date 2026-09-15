import { api } from '@/lib/api'

export const notificationsApi = {
  list: (filters, { signal } = {}) => api.get('/notifications', { query: filters, signal }),
  markRead: (id) => api.post(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
}

/** Where a notification takes you when clicked. */
export function notificationLink(notification) {
  if (notification.bookingId) return `/bookings?focus=${notification.bookingId}`
  if (notification.category === 'CLUB_MEMBERSHIP') return '/clubs?mine=true'
  return null
}
