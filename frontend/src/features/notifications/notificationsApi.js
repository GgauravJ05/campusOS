import { api } from '@/lib/api'

export const notificationsApi = {
  list: (filters, { signal } = {}) => api.get('/notifications', { query: filters, signal }),
  markRead: (id) => api.post(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post('/notifications/read-all').then((r) => r.data),
}

/**
 * Notifications about an event, as opposed to about its venue booking.
 * These carry a bookingId as well, so they have to be matched first - a
 * student sent to /bookings would land on a page they cannot use.
 */
const EVENT_CATEGORIES = new Set([
  'EVENT_PUBLISHED',
  'EVENT_REMINDER',
  'EVENT_CANCELLED',
  'REGISTRATION_CONFIRMED',
])

/** Where a notification takes you when clicked. */
export function notificationLink(notification) {
  if (EVENT_CATEGORIES.has(notification.category) && notification.eventId) {
    return `/events/${notification.eventId}`
  }
  if (notification.bookingId) return `/bookings?focus=${notification.bookingId}`
  if (notification.category === 'CLUB_MEMBERSHIP') return '/clubs?mine=true'
  return null
}
