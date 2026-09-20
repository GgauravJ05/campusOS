import { floorLabel, VENUE_TYPE_LABELS } from '@/features/venues/venuesApi'

/**
 * Grouping by floor, for the Clubs and Venues pages. The campus is easiest to
 * find your way around by floor: the Academic Building has one department per
 * floor (1 Electrical ... 6 AI & DS), and each floor mixes classrooms, labs and
 * a seminar hall. These are pure functions so they can be tested without a page.
 */

/** Which kind of room comes first on a floor. Anything not listed goes last. */
const TYPE_ORDER = ['CLASSROOM', 'LABORATORY', 'SEMINAR_HALL', 'AUDITORIUM', 'CONFERENCE_ROOM', 'SPORTS_GROUND', 'OPEN_AIR']

/** Plural headings for the sub-groups on a floor. */
const TYPE_PLURALS = {
  CLASSROOM: 'Classrooms',
  LABORATORY: 'Labs',
  SEMINAR_HALL: 'Seminar halls',
  AUDITORIUM: 'Auditoriums',
  CONFERENCE_ROOM: 'Conference rooms',
  SPORTS_GROUND: 'Sports grounds',
  OPEN_AIR: 'Open-air venues',
}

/** "AC 402" sorts before "AC 1010"; plain string order would not. */
const byNaturalName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

const typeRank = (type) => {
  const i = TYPE_ORDER.indexOf(type)
  return i === -1 ? TYPE_ORDER.length : i
}

/** A DOM id that is safe to use in a selector and a fragment. */
export const anchorId = (key) => `floor-${String(key).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

/**
 * Venues by building and floor. The Academic Building comes first, then the
 * other buildings alphabetically; floors run upward within a building. Inside a
 * floor, rooms are split by kind (classrooms, labs, seminar halls...) and each
 * kind is in natural order, so AC 401 to AC 404 read in sequence.
 *
 * `chip` is the short label for the jump bar: the floor for the primary building
 * ("4th floor"), and the building for any other ("Admin Block", "Campus"), so two
 * buildings' first floors are never both labelled "1st floor".
 *
 * @returns {{ key: string, building: string, floor: number, title: string, chip: string, subtitle: string,
 *   count: number, sections: { type: string, label: string, venues: object[] }[] }[]}
 */
export function groupVenuesByFloor(venues, primaryBuilding = 'Academic Building') {
  const groups = new Map()
  for (const venue of venues) {
    const key = `${venue.building}|${venue.floor}`
    if (!groups.has(key)) groups.set(key, { key, building: venue.building, floor: venue.floor, venues: [] })
    groups.get(key).venues.push(venue)
  }

  const buildingRank = (name) => (name === primaryBuilding ? 0 : 1)
  const floorsIn = new Map()
  for (const group of groups.values()) floorsIn.set(group.building, (floorsIn.get(group.building) ?? 0) + 1)
  return [...groups.values()]
    .sort((a, b) => buildingRank(a.building) - buildingRank(b.building)
      || a.building.localeCompare(b.building)
      || a.floor - b.floor)
    .map((group) => {
      const byType = new Map()
      for (const venue of [...group.venues].sort(byNaturalName)) {
        if (!byType.has(venue.type)) byType.set(venue.type, [])
        byType.get(venue.type).push(venue)
      }
      const departments = [...new Set(group.venues.map((v) => v.department?.name).filter(Boolean))]
      return {
        key: group.key,
        building: group.building,
        floor: group.floor,
        title: floorLabel(group.floor),
        chip: group.building === primaryBuilding ? floorLabel(group.floor)
          : floorsIn.get(group.building) > 1 ? `${group.building}, ${floorLabel(group.floor)}` : group.building,
        subtitle: [group.building, departments.length === 1 ? departments[0] : null].filter(Boolean).join(' · '),
        count: group.venues.length,
        sections: [...byType.entries()]
          .sort(([a], [b]) => typeRank(a) - typeRank(b))
          .map(([type, list]) => ({ type, label: TYPE_PLURALS[type] ?? VENUE_TYPE_LABELS[type] ?? type, venues: list })),
      }
    })
}

/**
 * Clubs by the floor their department is on, ascending, then the college-level
 * clubs (which belong to no department), then any club whose department has no
 * floor. Within a group clubs keep the order they arrived in (the API sorts by name).
 *
 * @returns {{ key: string, title: string, subtitle: string, count: number, clubs: object[] }[]}
 */
export function groupClubsByFloor(clubs) {
  const floors = new Map()
  const college = []
  const unplaced = []
  for (const club of clubs) {
    if (!club.department) college.push(club)
    else if (club.department.floor === null || club.department.floor === undefined) unplaced.push(club)
    else {
      if (!floors.has(club.department.floor)) floors.set(club.department.floor, { department: club.department.name, clubs: [] })
      floors.get(club.department.floor).clubs.push(club)
    }
  }

  const groups = [...floors.entries()]
    .sort(([a], [b]) => a - b)
    .map(([floor, { department, clubs: list }]) => ({
      key: `floor-${floor}`, title: floorLabel(floor), subtitle: department, count: list.length, clubs: list,
    }))
  if (college.length) {
    groups.push({ key: 'college', title: 'College-level', subtitle: 'Run by the Principal, open to every department', count: college.length, clubs: college })
  }
  if (unplaced.length) {
    groups.push({ key: 'other', title: 'Other', subtitle: 'Departments without a floor', count: unplaced.length, clubs: unplaced })
  }
  return groups
}
