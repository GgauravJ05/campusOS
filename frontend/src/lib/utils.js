import { clsx } from 'clsx'

/** Joins class names, dropping falsy values. */
export function cn(...inputs) {
  return clsx(inputs)
}

export const ROLE_META = {
  SUPER_ADMIN: { label: 'Principal & HOD', short: 'Super admin', tone: 'accent', description: 'Full authority across the college.' },
  DEPT_COORDINATOR: { label: 'Department Coordinator', short: 'Coordinator', tone: 'blue', description: 'Faculty. Approves venues and manages users in their department.' },
  CLUB_HEAD: { label: 'Club Head', short: 'Club head', tone: 'amber', description: 'Leads a club: requests venues and publishes events.' },
  CLUB_MEMBER: { label: 'Club Member', short: 'Member', tone: 'emerald', description: 'Part of a club organising team.' },
  STUDENT: { label: 'Student', short: 'Student', tone: 'zinc', description: 'Discovers events and reserves seats.' },
}

export const FACULTY_ROLES = ['SUPER_ADMIN', 'DEPT_COORDINATOR']

export function isFaculty(user) {
  return Boolean(user && FACULTY_ROLES.includes(user.role?.key))
}

export const ACADEMIC_YEARS = [
  { value: 1, label: 'First year (FE)' },
  { value: 2, label: 'Second year (SE)' },
  { value: 3, label: 'Third year (TE)' },
  { value: 4, label: 'Final year (BE)' },
]

export function academicYearLabel(year) {
  return ACADEMIC_YEARS.find((y) => y.value === year)?.label ?? (year ? `Year ${year}` : '—')
}

export function initials(name = '') {
  const parts = name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0]
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}

export function firstName(name = '') {
  return name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').trim().split(/\s+/)[0] || name
}

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
const dateOnly = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })

export function formatDateTime(value) {
  return value ? dateTime.format(new Date(value)) : '—'
}

export function formatDate(value) {
  return value ? dateOnly.format(new Date(value)) : '—'
}

/** "3 minutes ago" style, falling back to a date after a week. */
export function formatRelative(value, now = Date.now()) {
  if (!value) return 'Never'
  const seconds = Math.round((new Date(value).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (abs < 60) return 'Just now'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 604800) return rtf.format(Math.round(seconds / 86400), 'day')
  return formatDate(value)
}

export function greeting(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(date))
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
