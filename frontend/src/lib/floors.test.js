import { describe, expect, it } from 'vitest'
import { anchorId, groupClubsByFloor, groupVenuesByFloor } from './floors'

const venue = (name, floor, type, extra = {}) => ({ id: name, name, building: 'Academic Building', floor, type, department: null, ...extra })
const IT = { id: 4, code: 'IT', name: 'Information Technology', floor: 4 }

describe('groupVenuesByFloor', () => {
  const venues = [
    venue('MB 414', 4, 'LABORATORY', { department: IT }),
    venue('AC 402', 4, 'CLASSROOM', { department: IT }),
    venue('MB 405', 4, 'SEMINAR_HALL', { department: IT }),
    venue('AC 401', 4, 'CLASSROOM', { department: IT }),
    venue('MB 407', 4, 'LABORATORY', { department: IT }),
    venue('AC 101', 1, 'CLASSROOM'),
    venue('FMCII Hall', 0, 'AUDITORIUM', { building: 'Campus' }),
    venue('Sports Ground', 0, 'SPORTS_GROUND', { building: 'Campus' }),
    venue('Syndicate Room', 1, 'CONFERENCE_ROOM', { building: 'Admin Block' }),
  ]

  it('orders the academic building floor by floor, then the other buildings', () => {
    expect(groupVenuesByFloor(venues).map((g) => `${g.building}/${g.floor}`)).toEqual([
      'Academic Building/1', 'Academic Building/4', 'Admin Block/1', 'Campus/0',
    ])
  })

  it('labels the jump chips by floor for the academic building and by building for the rest', () => {
    expect(groupVenuesByFloor(venues).map((g) => g.chip)).toEqual(['1st floor', '4th floor', 'Admin Block', 'Campus'])
    const twoFloors = [venue('X', 1, 'CLASSROOM', { building: 'Annexe' }), venue('Y', 2, 'CLASSROOM', { building: 'Annexe' })]
    expect(groupVenuesByFloor(twoFloors).map((g) => g.chip)).toEqual(['Annexe, 1st floor', 'Annexe, 2nd floor'])
  })

  it('splits a floor into classrooms, labs and halls, each in natural order', () => {
    const floor4 = groupVenuesByFloor(venues).find((g) => g.floor === 4 && g.building === 'Academic Building')
    expect(floor4.sections.map((s) => [s.label, s.venues.map((v) => v.name)])).toEqual([
      ['Classrooms', ['AC 401', 'AC 402']],
      ['Labs', ['MB 407', 'MB 414']],
      ['Seminar halls', ['MB 405']],
    ])
    expect(floor4.count).toBe(5)
    expect(floor4.title).toBe('4th floor')
    expect(floor4.subtitle).toBe('Academic Building · Information Technology')
  })

  it('sorts numbers as numbers, not text', () => {
    const rooms = ['AC 1010', 'AC 402', 'AC 99'].map((n) => venue(n, 1, 'CLASSROOM'))
    expect(groupVenuesByFloor(rooms)[0].sections[0].venues.map((v) => v.name)).toEqual(['AC 99', 'AC 402', 'AC 1010'])
  })

  it('leaves the department out when a floor mixes several, and copes with nothing', () => {
    const mixed = [venue('A', 2, 'CLASSROOM', { department: IT }), venue('B', 2, 'CLASSROOM', { department: { name: 'Other' } })]
    expect(groupVenuesByFloor(mixed)[0].subtitle).toBe('Academic Building')
    expect(groupVenuesByFloor([])).toEqual([])
  })

  it('puts an unknown kind of room last, under its own name', () => {
    const rooms = [venue('X', 1, 'ATRIUM'), venue('AC 101', 1, 'CLASSROOM')]
    expect(groupVenuesByFloor(rooms)[0].sections.map((s) => s.label)).toEqual(['Classrooms', 'ATRIUM'])
  })
})

describe('groupClubsByFloor', () => {
  const club = (name, department) => ({ id: name, name, department })
  const dept = (floor, name) => ({ id: floor, code: name, name, floor })

  it('groups by department floor, then college-level, then unplaced', () => {
    const groups = groupClubsByFloor([
      club('Team Rudra', null),
      club('IT Tech Club', dept(4, 'Information Technology')),
      club('EESA', dept(1, 'Electrical Engineering')),
      club('Envision Club', dept(4, 'Information Technology')),
      club('Orphan', { id: 9, code: 'X', name: 'No floor', floor: null }),
    ])
    expect(groups.map((g) => [g.key, g.title, g.subtitle, g.clubs.map((c) => c.name)])).toEqual([
      ['floor-1', '1st floor', 'Electrical Engineering', ['EESA']],
      ['floor-4', '4th floor', 'Information Technology', ['IT Tech Club', 'Envision Club']],
      ['college', 'College-level', 'Run by the Principal, open to every department', ['Team Rudra']],
      ['other', 'Other', 'Departments without a floor', ['Orphan']],
    ])
    expect(groups.map((g) => g.count)).toEqual([1, 2, 1, 1])
  })

  it('treats a missing floor field like an unplaced department, and an empty list as no groups', () => {
    expect(groupClubsByFloor([club('Old API', { id: 1, code: 'IT', name: 'IT' })])[0].key).toBe('other')
    expect(groupClubsByFloor([])).toEqual([])
  })
})

describe('anchorId', () => {
  it('makes a safe fragment from a group key', () => {
    expect(anchorId('Academic Building|4')).toBe('floor-academic-building-4')
    expect(anchorId('floor-4')).toBe('floor-floor-4')
    expect(anchorId('college')).toBe('floor-college')
  })
})
