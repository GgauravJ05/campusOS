import { api } from '@/lib/api'

export const clubsApi = {
  list: (filters, { signal } = {}) => api.get('/clubs', { query: filters, signal }).then((r) => r.data),
  get: (id, { signal } = {}) => api.get(`/clubs/${id}`, { signal }).then((r) => r.data),
  create: (club) => api.post('/clubs', club).then((r) => r.data),
  update: (id, changes) => api.patch(`/clubs/${id}`, changes).then((r) => r.data),
  addMember: (id, member) => api.post(`/clubs/${id}/members`, member).then((r) => r.data),
  updateMember: (id, userId, position) => api.patch(`/clubs/${id}/members/${userId}`, { position }).then((r) => r.data),
  removeMember: (id, userId) => api.del(`/clubs/${id}/members/${userId}`).then((r) => r.data),
}

/** Team positions a club head can hand out, in display order. PRESIDENT is always the head. */
export const POSITION_LABELS = {
  VICE_PRESIDENT: 'Vice president',
  SECRETARY: 'Secretary',
  TREASURER: 'Treasurer',
  TECHNICAL_LEAD: 'Technical lead',
  EVENT_LEAD: 'Event lead',
  DESIGN_LEAD: 'Design lead',
  MARKETING_LEAD: 'Marketing lead',
  VOLUNTEER: 'Volunteer',
  MEMBER: 'Member',
}

export function positionLabel(position) {
  return position === 'PRESIDENT' ? 'President' : (POSITION_LABELS[position] ?? 'Member')
}
