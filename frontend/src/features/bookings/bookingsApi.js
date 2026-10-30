import { api } from '@/lib/api'
import { FACULTY_ROLES } from '@/lib/utils'

export const bookingsApi = {
  list: (filters, { signal } = {}) => api.get('/bookings', { query: filters, signal }),
  get: (id) => api.get(`/bookings/${id}`).then((r) => r.data),
  create: (booking) => api.post('/bookings', booking).then((r) => r.data),
  approve: (id) => api.post(`/bookings/${id}/approve`).then((r) => r.data),
  reject: (id, reason) => api.post(`/bookings/${id}/reject`, { reason }).then((r) => r.data),
  cancel: (id) => api.post(`/bookings/${id}/cancel`).then((r) => r.data),
  requestChanges: (id, note) => api.post(`/bookings/${id}/request-changes`, { note }).then((r) => r.data),
  update: (id, changes) => api.patch(`/bookings/${id}`, changes).then((r) => r.data),
  summary: ({ signal } = {}) => api.get('/bookings/summary', { signal }).then((r) => r.data),
  appointableClubs: () => api.get('/directory/clubs', { query: { appointable: true } }).then((r) => r.data),
}

export const CATEGORY_LABELS = {
  TECHNICAL: 'Technical',
  CULTURAL: 'Cultural',
  SPORTS: 'Sports',
  WORKSHOP: 'Workshop',
  SEMINAR: 'Seminar',
  PLACEMENT: 'Placement',
  SOCIAL: 'Social',
  OTHER: 'Other',
}

/** Status as people see it on the calendar (FR12 colours). */
export const STATUS_META = {
  PENDING: { label: 'Pending approval', tone: 'amber' },
  APPROVED: { label: 'Booked', tone: 'emerald' },
  REJECTED: { label: 'Rejected', tone: 'rose' },
  CANCELLED: { label: 'Cancelled', tone: 'zinc' },
  MODIFICATION_REQUESTED: { label: 'Changes requested', tone: 'blue' },
}

export const BOOKING_ROLES = ['CLUB_HEAD', ...FACULTY_ROLES]

export function canBook(user) {
  return Boolean(user && BOOKING_ROLES.includes(user.role.key))
}

/** Club heads, club members and faculty have bookings to look at. */
export function hasBookings(user) {
  return Boolean(user && (canBook(user) || user.role.key === 'CLUB_MEMBER'))
}
