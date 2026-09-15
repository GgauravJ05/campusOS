import { describe, expect, it } from 'vitest'
import {
  addDays, campusToday, dayOfMonth, durationLabel, formatDayLabel, formatLongDate, formatTime, formatTimeRange,
  fromMinutes, shortMonth, startOfWeek, timeOptions, toMinutes,
} from './campusTime'
import { equipmentLabel, floorLabel } from '@/features/venues/venuesApi'
import { canBook, hasBookings } from '@/features/bookings/bookingsApi'

describe('campus time', () => {
  it('uses the campus date, not the viewer timezone', () => {
    expect(campusToday(new Date('2026-09-14T19:00:00Z'))).toBe('2026-09-15') // 00:30 IST
  })

  it('finds Monday as the start of the week', () => {
    expect(startOfWeek('2026-09-17')).toBe('2026-09-14') // Thursday
    expect(startOfWeek('2026-09-20')).toBe('2026-09-14') // Sunday
    expect(startOfWeek('2026-09-14')).toBe('2026-09-14')
  })

  it('adds days across months', () => {
    expect(addDays('2026-09-29', 3)).toBe('2026-10-02')
  })

  it('formats times the Indian way', () => {
    expect(formatTime('00:00')).toBe('12 am')
    expect(formatTime('12:30')).toBe('12:30 pm')
    expect(formatTime('14:05')).toBe('2:05 pm')
    expect(formatTimeRange('09:00', '10:30')).toBe('9 am – 10:30 am')
  })

  it('formats dates', () => {
    expect(formatDayLabel('2026-09-15')).toMatch(/Tue/)
    expect(formatLongDate('2026-09-15')).toMatch(/Tuesday.*15.*September.*2026/)
    expect(dayOfMonth('2026-09-05')).toBe(5)
    expect(shortMonth('2026-09-05')).toMatch(/Sep/)
  })

  it('builds time options and durations', () => {
    expect(timeOptions('07:00', '08:00')).toEqual(['07:00', '07:15', '07:30', '07:45', '08:00'])
    expect(fromMinutes(toMinutes('13:45'))).toBe('13:45')
    expect(durationLabel('10:00', '12:30')).toBe('2 h 30 min')
    expect(durationLabel('10:00', '10:45')).toBe('45 min')
    expect(durationLabel('10:00', '09:00')).toBe('')
  })
})

describe('venue and booking labels', () => {
  it('labels floors', () => {
    expect(floorLabel(0)).toBe('Ground floor')
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(floorLabel)).toEqual(['1st floor', '2nd floor', '3rd floor', '4th floor', '11th floor', '12th floor', '13th floor', '21st floor'])
  })

  it('labels equipment tokens', () => {
    expect(equipmentLabel('SOUND_SYSTEM')).toBe('Sound system')
    expect(equipmentLabel('AC')).toBe('AC')
  })

  it('knows who can book and who has bookings', () => {
    const as = (key) => ({ role: { key } })
    expect(canBook(as('CLUB_HEAD'))).toBe(true)
    expect(canBook(as('CLUB_MEMBER'))).toBe(false)
    expect(hasBookings(as('CLUB_MEMBER'))).toBe(true)
    expect(hasBookings(as('STUDENT'))).toBe(false)
    expect(canBook(null)).toBe(false)
  })
})
