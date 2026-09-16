import { http } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp, currentPath } from '@/test/render'
import { API, coordinator, fail, makeUser, ok, server } from '@/test/server'
import { addDays, campusToday, startOfWeek } from '@/lib/campusTime'

const RULES = { defaultBufferMinutes: 15, openingTime: '07:00', closingTime: '21:00', maxAdvanceDays: 90, minDurationMinutes: 30, maxDurationMinutes: 720 }

const meta = {
  buildings: [
    { name: 'IT Block', floors: [{ floor: 2, venues: [{ id: 5, name: 'Computer Lab 1', type: 'LABORATORY', capacity: 60 }] }] },
    { name: 'Main Building', floors: [
      { floor: 0, venues: [{ id: 1, name: 'Main Auditorium', type: 'AUDITORIUM', capacity: 500 }] },
      { floor: 1, venues: [{ id: 2, name: 'Seminar Hall A', type: 'SEMINAR_HALL', capacity: 200 }] },
    ] },
  ],
  types: ['AUDITORIUM', 'SEMINAR_HALL', 'LABORATORY'],
  equipment: ['AC', 'PROJECTOR', 'SOUND_SYSTEM'],
  rules: RULES,
}

const venue = (overrides = {}) => ({
  id: 2, name: 'Seminar Hall A', building: 'Main Building', floor: 1, type: 'SEMINAR_HALL', capacity: 200,
  location: 'First Floor, Main Building', equipment: ['PROJECTOR', 'MIC', 'AC', 'SOUND_SYSTEM'], bufferMinutes: 15, bufferOverride: null,
  department: { id: 1, code: 'IT', name: 'Information Technology' }, isActive: true, canManage: false, ...overrides,
})

const clubHead = makeUser({
  role: { key: 'CLUB_HEAD', name: 'Club Head', rank: 3 },
  clubs: [{ id: 1, name: 'IT Tech Club', scope: 'DEPARTMENT', isHead: true, position: 'PRESIDENT' }],
})

describe('venue directory', () => {
  it('lists venues and sends filters to the API, with the floor cascade', async () => {
    const queries = []
    server.use(
      http.get(`${API}/venues/meta`, () => ok(meta)),
      http.get(`${API}/venues`, ({ request }) => {
        const q = Object.fromEntries(new URL(request.url).searchParams)
        queries.push(q)
        return ok(q.building === 'IT Block' ? [venue({ id: 5, name: 'Computer Lab 1', building: 'IT Block', floor: 2, type: 'LABORATORY' })] : [venue(), venue({ id: 1, name: 'Main Auditorium', floor: 0, type: 'AUDITORIUM', capacity: 500 })])
      }),
    )
    const { user } = renderApp('/venues', { user: makeUser() })

    expect(await screen.findByText('Main Auditorium')).toBeInTheDocument()
    expect(screen.getByText('2 venues')).toBeInTheDocument()
    expect(screen.getAllByText('+1 more')).toHaveLength(2)
    expect(screen.getByLabelText('Floor')).toBeDisabled()
    // Students cannot book or add venues.
    expect(screen.queryByRole('link', { name: /Book a venue/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add venue/ })).not.toBeInTheDocument()

    await waitFor(() => expect(within(screen.getByLabelText('Building')).getAllByRole('option')).toHaveLength(3))
    await user.selectOptions(screen.getByLabelText('Building'), 'IT Block')
    await user.selectOptions(screen.getByLabelText('Floor'), '2')
    await user.click(screen.getByRole('button', { name: 'Projector' }))
    await user.selectOptions(screen.getByLabelText('Minimum capacity'), '60')

    await waitFor(() => expect(queries.at(-1)).toMatchObject({ building: 'IT Block', floor: '2', equipment: 'PROJECTOR', minCapacity: '60' }))
    expect(await screen.findByText('1 venue')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Projector' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /Clear filters/ }))
    await waitFor(() => expect(queries.at(-1)).toEqual({ pageSize: '100' }))
  })

  it('shows an empty state when nothing matches', async () => {
    server.use(http.get(`${API}/venues/meta`, () => ok(meta)), http.get(`${API}/venues`, () => ok([])))
    renderApp('/venues?type=AUDITORIUM', { user: makeUser() })
    expect(await screen.findByRole('heading', { name: 'No venue matches' })).toBeInTheDocument()
  })

  it('reports a failed load', async () => {
    server.use(http.get(`${API}/venues/meta`, () => ok(meta)), http.get(`${API}/venues`, () => fail(500, 'INTERNAL_ERROR', 'Boom')))
    renderApp('/venues', { user: makeUser() })
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load venues')
  })

  it('lets faculty add a venue', async () => {
    let created
    let listCalls = 0
    server.use(
      http.get(`${API}/venues/meta`, () => ok(meta)),
      http.get(`${API}/venues`, () => { listCalls += 1; return ok([venue()]) }),
      http.post(`${API}/venues`, async ({ request }) => {
        created = await request.json()
        return ok(venue({ id: 99, name: created.name }), undefined, { status: 201 })
      }),
    )
    const { user } = renderApp('/venues', { user: coordinator })

    await user.click(await screen.findByRole('button', { name: /Add venue/ }))
    const dialog = screen.getByRole('dialog', { name: 'Add a venue' })
    await user.type(within(dialog).getByLabelText('Name'), 'Seminar Hall C')
    await user.type(within(dialog).getByLabelText('Building'), 'Main Building')
    await user.clear(within(dialog).getByLabelText('Floor'))
    await user.type(within(dialog).getByLabelText('Floor'), '2')
    await user.type(within(dialog).getByLabelText('Capacity'), '90')
    await user.type(within(dialog).getByLabelText(/Equipment/), 'projector, AC')
    await user.click(within(dialog).getByRole('button', { name: 'Add venue' }))

    expect(await screen.findByText('Venue added')).toBeInTheDocument()
    expect(created).toEqual({
      name: 'Seminar Hall C', building: 'Main Building', floor: 2, type: 'SEMINAR_HALL', capacity: 90,
      location: null, equipment: ['projector', 'AC'], bufferMinutes: null,
    })
    await waitFor(() => expect(listCalls).toBeGreaterThanOrEqual(2))
  })

  it('shows server field errors in the venue form', async () => {
    server.use(
      http.get(`${API}/venues/meta`, () => ok(meta)),
      http.get(`${API}/venues`, () => ok([])),
      http.post(`${API}/venues`, () => fail(422, 'VALIDATION_ERROR', 'Invalid', [{ field: 'capacity', message: 'Capacity must be at least 1' }])),
    )
    const { user } = renderApp('/venues', { user: coordinator })
    await user.click(await screen.findByRole('button', { name: /Add venue/ }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Hall')
    await user.type(within(dialog).getByLabelText('Building'), 'X')
    await user.type(within(dialog).getByLabelText('Capacity'), '5')
    await user.click(within(dialog).getByRole('button', { name: 'Add venue' }))
    await waitFor(() => expect(within(dialog).getByLabelText('Capacity')).toHaveAccessibleDescription('Capacity must be at least 1'))
  })
})

describe('venue detail and calendar', () => {
  const today = campusToday()
  const week = startOfWeek(today)
  const future = addDays(week, 7)

  function availabilityHandler(calls) {
    return http.get(`${API}/venues/2/availability`, ({ request }) => {
      const q = Object.fromEntries(new URL(request.url).searchParams)
      calls.push(q)
      const date = q.from === week ? addDays(week, 6) : addDays(q.from, 2)
      return ok({
        venue: venue(), from: q.from, to: q.to, rules: RULES,
        blocks: [
          { bookingId: 1, status: 'BOOKED', date, startTime: '09:00', endTime: '11:00', title: 'Open Lecture', club: 'Official event', mine: false },
          { bookingId: 2, status: 'PENDING', date, startTime: '14:00', endTime: '15:00', title: null, club: null, mine: false },
        ],
      })
    })
  }

  it('shows the week with booked and pending slots, and navigates weeks', async () => {
    const calls = []
    server.use(http.get(`${API}/venues/2`, () => ok(venue())), availabilityHandler(calls))
    const { user } = renderApp('/venues/2', { user: makeUser() })

    expect(await screen.findByRole('heading', { name: 'Seminar Hall A' })).toBeInTheDocument()
    expect(await screen.findByRole('note', { name: /Booked: Open Lecture, 9 am – 11 am/ })).toBeInTheDocument()
    expect(screen.getByRole('note', { name: /Pending approval: Approval pending, 2 pm – 3 pm/ })).toBeInTheDocument()
    expect(calls[0]).toEqual({ from: week, to: addDays(week, 6) })
    expect(screen.getByRole('button', { name: 'Previous week' })).toBeDisabled()
    // Students see the calendar but cannot book.
    expect(screen.queryByRole('link', { name: /Book this venue/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next week' }))
    await waitFor(() => expect(calls.at(-1)).toEqual({ from: future, to: addDays(future, 6) }))
    await user.click(screen.getByRole('button', { name: 'This week' }))
    await waitFor(() => expect(calls.at(-1).from).toBe(week))
  })

  it('starts a booking from a clicked calendar time', async () => {
    server.use(
      http.get(`${API}/venues/2`, () => ok(venue())),
      availabilityHandler([]),
      http.get(`${API}/venues/meta`, () => ok(meta)),
    )
    const { user } = renderApp('/venues/2', { user: clubHead })

    expect(await screen.findByRole('link', { name: /Book this venue/ })).toHaveAttribute('href', '/bookings/new?venueId=2')
    const column = await screen.findByTestId(`day-${addDays(week, 6)}`)
    vi.spyOn(column, 'getBoundingClientRect').mockReturnValue({ top: 0, left: 0, width: 100, height: 700, right: 100, bottom: 700 })
    await user.pointer({ keys: '[MouseLeft]', target: column, coords: { clientY: 48 * 3 } })

    await waitFor(() => expect(currentPath()).toBe('/bookings/new'))
  })

  it('lets a manager edit and deactivate', async () => {
    let patch
    server.use(
      http.get(`${API}/venues/2`, () => ok(venue({ canManage: true }))),
      availabilityHandler([]),
      http.patch(`${API}/venues/2`, async ({ request }) => {
        patch = await request.json()
        return ok(venue({ canManage: true, isActive: false }))
      }),
    )
    const { user } = renderApp('/venues/2', { user: coordinator })

    await user.click(await screen.findByRole('button', { name: /Edit/ }))
    const dialog = screen.getByRole('dialog', { name: 'Edit Seminar Hall A' })
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Seminar Hall A')
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate venue' }))

    expect(await screen.findByText('Venue updated')).toBeInTheDocument()
    expect(patch).toMatchObject({ isActive: false, name: 'Seminar Hall A', capacity: 200 })
  })

  it('explains a missing venue', async () => {
    server.use(http.get(`${API}/venues/77`, () => fail(404, 'NOT_FOUND', 'Venue not found')), http.get(`${API}/venues/77/availability`, () => fail(404, 'NOT_FOUND', 'x')))
    renderApp('/venues/77', { user: makeUser() })
    expect(await screen.findByRole('heading', { name: 'Venue not found' })).toBeInTheDocument()
  })
})
