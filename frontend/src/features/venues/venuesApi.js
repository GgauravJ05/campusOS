import { api } from '@/lib/api'

export const venuesApi = {
  list: (filters, { signal } = {}) => api.get('/venues', { query: filters, signal }),
  meta: () => api.get('/venues/meta').then((r) => r.data),
  get: (id) => api.get(`/venues/${id}`).then((r) => r.data),
  availability: (id, from, to, { signal } = {}) => api.get(`/venues/${id}/availability`, { query: { from, to }, signal }).then((r) => r.data),
  check: (slot, { signal } = {}) => api.post('/venues/check-availability', slot, { signal }).then((r) => r.data),
  create: (venue) => api.post('/venues', venue).then((r) => r.data),
  update: (id, changes) => api.patch(`/venues/${id}`, changes).then((r) => r.data),
}

export const VENUE_TYPE_LABELS = {
  CLASSROOM: 'Classroom',
  LABORATORY: 'Laboratory',
  SEMINAR_HALL: 'Seminar hall',
  AUDITORIUM: 'Auditorium',
  CONFERENCE_ROOM: 'Conference room',
  SPORTS_GROUND: 'Sports ground',
  OPEN_AIR: 'Open-air venue',
}

export function floorLabel(floor) {
  if (floor === 0) return 'Ground floor'
  const suffix = floor % 10 === 1 && floor !== 11 ? 'st' : floor % 10 === 2 && floor !== 12 ? 'nd' : floor % 10 === 3 && floor !== 13 ? 'rd' : 'th'
  return `${floor}${suffix} floor`
}

export function equipmentLabel(token) {
  const special = { AC: 'AC', MIC: 'Mic' }
  if (special[token]) return special[token]
  return token.charAt(0) + token.slice(1).toLowerCase().replace(/_/g, ' ')
}
