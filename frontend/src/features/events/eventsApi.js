import { api } from '@/lib/api'

export const eventsApi = {
  list: (filters, { signal } = {}) => api.get('/events', { query: filters, signal }).then((r) => r.data),
  recommended: (limit, { signal } = {}) => api.get('/events/recommended', { query: { limit }, signal }).then((r) => r.data),
  get: (id, { signal } = {}) => api.get(`/events/${id}`, { signal }).then((r) => r.data),
  publish: (id, details) => api.post(`/events/${id}/publish`, details).then((r) => r.data),
  update: (id, changes) => api.patch(`/events/${id}`, changes).then((r) => r.data),
  register: (id) => api.post(`/events/${id}/registrations`, { seats: 1 }).then((r) => r.data),
  cancelRegistration: (id) => api.del(`/events/${id}/registrations/me`).then((r) => r.data),
  roster: (id, filters, { signal } = {}) => api.get(`/events/${id}/registrations`, { query: filters, signal }).then((r) => r.data),
  feedbackForm: (id, { signal } = {}) => api.get(`/events/${id}/feedback/form`, { signal }).then((r) => r.data),
  submitFeedback: (id, body) => api.post(`/events/${id}/feedback`, body).then((r) => r.data),
  feedbackSummary: (id, { signal } = {}) => api.get(`/events/${id}/feedback`, { signal }).then((r) => r.data),
}

/**
 * Wording for the follow-up questions the API sends by key. The server owns
 * which questions an event gets (backend/src/services/events/feedback.service.js);
 * this only says how to phrase them. An unknown key falls back to its own name,
 * so a question added on the server still shows up, just less politely.
 */
const FEEDBACK_QUESTIONS = {
  difficulty: 'How was the difficulty?',
  would_repeat: 'Would you come to another one like this?',
  materials_helpful: 'Were the materials helpful?',
  speaker_clear: 'Was the speaker clear?',
  well_organised: 'Was it well organised?',
  fair_play: 'Was there fair play?',
  facilities_good: 'Were the facilities good?',
  relevant_to_me: 'Was it relevant to you?',
}

const FEEDBACK_CHOICES = { TOO_EASY: 'Too easy', JUST_RIGHT: 'Just right', TOO_HARD: 'Too hard' }

export function feedbackQuestionLabel(key) {
  return FEEDBACK_QUESTIONS[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

/** "Yes" / "No" for a stored boolean answer, the friendly name for an enum answer. */
export function feedbackAnswerLabel(answer) {
  if (answer === 'true' || answer === true) return 'Yes'
  if (answer === 'false' || answer === false) return 'No'
  return FEEDBACK_CHOICES[answer] ?? answer
}

/**
 * One seat per student, matching the backend. A student reserves a seat for
 * themselves, not for friends.
 */
export const MAX_SEATS_PER_RSVP = 1

/**
 * Event status as an attendee sees it. Only PUBLISHED and COMPLETED are ever
 * visible to students; the rest appear on an organiser's own events.
 */
export const EVENT_STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'zinc' },
  PENDING_APPROVAL: { label: 'Awaiting approval', tone: 'amber' },
  APPROVED: { label: 'Ready to publish', tone: 'blue' },
  PUBLISHED: { label: 'Open', tone: 'emerald' },
  REJECTED: { label: 'Rejected', tone: 'rose' },
  CANCELLED: { label: 'Cancelled', tone: 'rose' },
  COMPLETED: { label: 'Finished', tone: 'zinc' },
}

export const REGISTRATION_STATUS_META = {
  RESERVED: { label: "You're going", tone: 'emerald' },
  WAITLISTED: { label: 'Waitlisted', tone: 'amber' },
}

/** "12 of 40 seats taken", or the uncapped equivalent. */
export function seatSummary({ maxSeats, bookedSeats }) {
  if (maxSeats === null) return `${bookedSeats} registered · no seat limit`
  return `${bookedSeats} of ${maxSeats} seats taken`
}

/** How full the event is, 0-1, for the seat meter. NULL capacity never fills. */
export function seatFraction({ maxSeats, bookedSeats }) {
  if (!maxSeats) return 0
  return Math.min(bookedSeats / maxSeats, 1)
}

/** The one line that answers "can I still get in?". */
export function seatsLeftLabel({ maxSeats, seatsLeft, isFull }) {
  if (maxSeats === null) return 'Open to everyone'
  if (isFull) return 'Fully booked'
  return `${seatsLeft} ${seatsLeft === 1 ? 'seat' : 'seats'} left`
}

/** Who the event is open to, in words, from the eligibility arrays. */
export function audienceLabel({ departments = [], years = [] }, departmentNames = {}) {
  if (departments.length === 0 && years.length === 0) return 'Open to everyone'
  const parts = []
  if (departments.length) parts.push(departments.map((id) => departmentNames[id] || `Dept ${id}`).join(', '))
  if (years.length) parts.push(`${years.map((y) => `Year ${y}`).join(', ')}`)
  return parts.join(' · ')
}
