import { describe, expect, it } from 'vitest'
import { passwordChecks, passwordScore } from './password'
import { academicYearLabel, firstName, formatRelative, greeting, initials, isFaculty } from './utils'

describe('password feedback', () => {
  const passes = (pw, ctx) => passwordChecks(pw, ctx).every((c) => c.ok)

  it('accepts a password the backend policy accepts', () => {
    expect(passes('Violet-Lantern-42')).toBe(true)
  })

  it.each([
    ['Ab1!', 'length'],
    ['alllowercase', 'variety'],
  ])('flags %s on %s', (pw, id) => {
    expect(passwordChecks(pw).find((c) => c.id === id).ok).toBe(false)
  })

  it('flags a password over 72 bytes', () => {
    expect(passwordChecks(`Aa1${'é'.repeat(35)}`).find((c) => c.id === 'length').ok).toBe(false)
  })

  it('flags a password containing part of the name or the email', () => {
    const personal = (pw, ctx) => passwordChecks(pw, ctx).find((c) => c.id === 'personal').ok
    expect(personal('Kulkarni#Secure99', { fullName: 'Asha Kulkarni' })).toBe(false)
    expect(personal('gaurav.student.a#26', { email: 'gaurav.student.a@mmcoe.edu.in' })).toBe(false)
    expect(passes('Violet-Lantern-42', { fullName: 'Asha Kulkarni', email: 'asha.k@mmcoe.edu.in' })).toBe(true)
  })

  it('scores from weak to strong', () => {
    expect(passwordScore('')).toBe(0)
    expect(passwordScore('abc')).toBe(1)
    expect(passwordScore('Violet-42')).toBe(3)
    expect(passwordScore('Violet-Lantern-42')).toBe(4)
  })
})

describe('formatting helpers', () => {
  it('builds initials, ignoring titles', () => {
    expect(initials('Dr. Principal MMCOE')).toBe('PM')
    expect(initials('Asha')).toBe('A')
    expect(initials('')).toBe('?')
  })

  it('extracts a first name, ignoring titles', () => {
    expect(firstName('Dr. Principal MMCOE')).toBe('Principal')
  })

  it('labels academic years', () => {
    expect(academicYearLabel(4)).toBe('Final year (BE)')
    expect(academicYearLabel(null)).toBe('—')
    expect(academicYearLabel(5)).toBe('Year 5')
  })

  it('formats relative times', () => {
    const now = Date.parse('2026-09-15T12:00:00Z')
    expect(formatRelative(null)).toBe('Never')
    expect(formatRelative('2026-09-15T11:59:30Z', now)).toBe('Just now')
    expect(formatRelative('2026-09-15T11:45:00Z', now)).toBe('15 minutes ago')
    expect(formatRelative('2026-09-15T09:00:00Z', now)).toBe('3 hours ago')
    expect(formatRelative('2026-09-13T12:00:00Z', now)).toBe('2 days ago')
    expect(formatRelative('2026-08-01T12:00:00Z', now)).toMatch(/2026/)
  })

  it('greets by the time of day in India', () => {
    expect(greeting(new Date('2026-09-15T03:00:00Z'))).toBe('Good morning') // 08:30 IST
    expect(greeting(new Date('2026-09-15T08:00:00Z'))).toBe('Good afternoon') // 13:30 IST
    expect(greeting(new Date('2026-09-15T14:00:00Z'))).toBe('Good evening') // 19:30 IST
  })

  it('recognises faculty roles', () => {
    expect(isFaculty({ role: { key: 'DEPT_COORDINATOR' } })).toBe(true)
    expect(isFaculty({ role: { key: 'CLUB_HEAD' } })).toBe(false)
    expect(isFaculty(null)).toBe(false)
  })
})
