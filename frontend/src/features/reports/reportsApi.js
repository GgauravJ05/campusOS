import { api } from '@/lib/api'

export const reportsApi = {
  catalogue: ({ signal } = {}) => api.get('/reports', { signal }).then((r) => r.data),
  get: (report, filters, { signal } = {}) => api.get(`/reports/${report}`, { query: filters, signal }).then((r) => r.data),
  auditTrail: (filters, { signal } = {}) => api.get('/admin/audit', { query: filters, signal }),
  auditVocabulary: ({ signal } = {}) => api.get('/admin/audit/vocabulary', { signal }).then((r) => r.data),
}

export const dashboardApi = {
  get: ({ signal } = {}) => api.get('/dashboard', { signal }).then((r) => r.data),
}

/**
 * Downloads an export (FR21).
 *
 * The API requires a bearer token, so the browser cannot simply follow a
 * link - the file is fetched with the session's own headers and handed to
 * the user as a blob. The filename comes from Content-Disposition, so the
 * server stays the single source of truth for what a report is called.
 */
export async function downloadReport(report, format, filters, { token, baseUrl }) {
  const params = new URLSearchParams({ ...filters, format })
  const response = await fetch(`${baseUrl}/reports/${report}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  })
  if (!response.ok) throw new Error('That export could not be generated. Try again in a moment.')

  const disposition = response.headers.get('content-disposition') || ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = match ? match[1] : `campusos-${report}.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return link.download
}

export const AUDIT_GROUP_LABELS = {
  ACCESS: 'Sign-ins',
  ROLES: 'Roles & accounts',
  VENUES: 'Venues',
  BOOKINGS: 'Bookings',
  CLUBS: 'Clubs',
  EVENTS: 'Events',
  OTHER: 'Other',
}

export const ATTENDANCE_STATUS_META = {
  PRESENT: { label: 'Present', tone: 'emerald' },
  ABSENT: { label: 'Absent', tone: 'rose' },
  EXCUSED: { label: 'Excused', tone: 'amber' },
}
