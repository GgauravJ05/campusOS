import { http } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp, currentPath } from '@/test/render'
import { API, coordinator, fail, makeUser, ok, server } from '@/test/server'
import { addDays, campusToday } from '@/lib/campusTime'

const RULES = { defaultBufferMinutes: 15, openingTime: '07:00', closingTime: '21:00', maxAdvanceDays: 90, minDurationMinutes: 30, maxDurationMinutes: 720 }
const meta = {
  buildings: [
    { name: 'Main Building', floors: [
      { floor: 0, venues: [{ id: 1, name: 'Main Auditorium', type: 'AUDITORIUM', capacity: 500 }] },
      { floor: 1, venues: [{ id: 2, name: 'Seminar Hall A', type: 'SEMINAR_HALL', capacity: 200 }] },
    ] },
    { name: 'IT Block', floors: [{ floor: 2, venues: [{ id: 5, name: 'Computer Lab 1', type: 'LABORATORY', capacity: 60 }] }] },
  ],
  types: [], equipment: [], rules: RULES,
}

const clubHead = makeUser({
  id: 4,
  role: { key: 'CLUB_HEAD', name: 'Club Head', rank: 3 },
  clubs: [
    { id: 1, name: 'IT Tech Club', scope: 'DEPARTMENT', isHead: true, position: 'PRESIDENT' },
    { id: 3, name: 'Robotics Club', scope: 'DEPARTMENT', isHead: false, position: 'MEMBER' },
  ],
})

const date = addDays(campusToday(), 10)

function booking(overrides = {}) {
  return {
    id: 50, status: 'PENDING', date, startTime: '10:00', endTime: '12:00', bufferMinutes: 15, isDirect: false,
    rejectionReason: null, decidedAt: null, createdAt: new Date().toISOString(),
    venue: { id: 2, name: 'Seminar Hall A', building: 'Main Building', floor: 1, capacity: 200 },
    event: { id: 9, title: 'Hack Night', category: 'TECHNICAL', scope: 'CLUB', expectedAttendance: 80, status: 'PENDING_APPROVAL', club: { id: 1, name: 'IT Tech Club' }, department: { id: 1, code: 'IT' } },
    requestedBy: { id: 4, fullName: 'Gaurav Jadhav', email: 'g@mmcoe.edu.in' },
    decidedBy: null,
    permissions: { canDecide: false, canCancel: true },
    ...overrides,
  }
}

describe('booking wizard', () => {
  it('walks Building → Floor → Venue → time → details and sends a request', async () => {
    const checks = []
    let created
    server.use(
      http.get(`${API}/venues/meta`, () => ok(meta)),
      http.post(`${API}/venues/check-availability`, async ({ request }) => {
        const body = await request.json()
        checks.push(body)
        if (body.startTime === '10:00') {
          return ok({
            available: false, bufferMinutes: 15, competingRequests: 0,
            conflicts: [{ title: 'Faculty Review', club: 'Official event', startTime: '09:00', endTime: '11:00' }],
            suggestions: [{ startTime: '11:15', endTime: '13:15' }, { startTime: '13:00', endTime: '15:00' }],
          })
        }
        return ok({ available: true, bufferMinutes: 15, competingRequests: 1, conflicts: [], suggestions: [] })
      }),
      http.post(`${API}/bookings`, async ({ request }) => {
        created = await request.json()
        return ok(booking({ startTime: created.startTime, endTime: created.endTime }), undefined, { status: 201 })
      }),
      http.get(`${API}/bookings`, () => ok([booking()], { page: 1, pageSize: 50, total: 1, totalPages: 1 })),
    )
    const { user } = renderApp('/bookings/new', { user: clubHead })

    const next = () => screen.getByRole('button', { name: /Continue/ })

    // Step 1
    await user.click(await screen.findByRole('button', { name: /Main Building/ }))
    expect(next()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /1st floor/ }))
    await user.click(screen.getByRole('button', { name: /Seminar Hall A/ }))
    await user.click(next())

    // Step 2: a clash, then a suggestion
    expect(await screen.findByLabelText('Date')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Date'), date)
    await user.selectOptions(screen.getByLabelText('Starts'), '10:00')
    expect(screen.getByLabelText('Ends')).toHaveValue('11:00')
    await user.selectOptions(screen.getByLabelText('Ends'), '12:00')

    expect(await screen.findByText('Already booked')).toBeInTheDocument()
    expect(screen.getByText(/Faculty Review · Official event/)).toBeInTheDocument()
    expect(next()).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '11:15 am – 1:15 pm' }))
    expect(await screen.findByText('This slot is free')).toBeInTheDocument()
    expect(screen.getByText('1 other request pending for this time')).toBeInTheDocument()
    expect(checks.at(-1)).toEqual({ venueId: 2, date, startTime: '11:15', endTime: '13:15' })
    await user.click(next())

    // Step 3: validation, then submit
    await user.click(screen.getByRole('button', { name: 'Send request' }))
    expect(screen.getByLabelText('Event title')).toHaveAccessibleDescription(/title/)
    expect(within(screen.getByLabelText('Your club')).queryByRole('option', { name: 'Robotics Club' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Event title'), 'Hack Night')
    await user.selectOptions(screen.getByLabelText('Category'), 'TECHNICAL')
    await user.type(screen.getByLabelText('Expected attendance'), '250')
    await user.selectOptions(screen.getByLabelText('Your club'), '1')
    await user.click(screen.getByRole('button', { name: 'Send request' }))
    expect(screen.getByLabelText('Expected attendance')).toHaveAccessibleDescription('Seminar Hall A holds 200')

    await user.clear(screen.getByLabelText('Expected attendance'))
    await user.type(screen.getByLabelText('Expected attendance'), '80')
    await user.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByText('Request sent for approval')).toBeInTheDocument()
    await waitFor(() => expect(currentPath()).toBe('/bookings'))
    expect(created).toEqual({
      venueId: 2, date, startTime: '11:15', endTime: '13:15', title: 'Hack Night', category: 'TECHNICAL',
      expectedAttendance: 80, description: null, clubId: 1,
    })
  })

  it('prefills the venue and time from the calendar and books directly as faculty', async () => {
    let created
    server.use(
      http.get(`${API}/venues/meta`, () => ok(meta)),
      http.get(`${API}/directory/clubs`, () => ok([{ id: 1, name: 'IT Tech Club', scope: 'DEPARTMENT' }])),
      http.post(`${API}/venues/check-availability`, () => ok({ available: true, bufferMinutes: 15, competingRequests: 0, conflicts: [], suggestions: [] })),
      http.post(`${API}/bookings`, async ({ request }) => {
        created = await request.json()
        return ok(booking({ status: 'APPROVED', isDirect: true, startTime: '14:00', endTime: '16:00' }), undefined, { status: 201 })
      }),
      http.get(`${API}/bookings`, () => ok([], { page: 1, pageSize: 50, total: 0, totalPages: 0 })),
    )
    const { user } = renderApp(`/bookings/new?venueId=2&date=${date}&start=14:00`, { user: coordinator })

    expect(await screen.findByRole('button', { name: /Seminar Hall A/ })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    expect(screen.getByLabelText('Starts')).toHaveValue('14:00')
    expect(screen.getByLabelText('Ends')).toHaveValue('16:00')
    await waitFor(() => expect(screen.getByRole('button', { name: /Continue/ })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /Continue/ }))

    expect(screen.getByText(/booked immediately/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Event title'), 'Board of Studies')
    await user.selectOptions(screen.getByLabelText('Category'), 'SEMINAR')
    await user.type(screen.getByLabelText('Expected attendance'), '40')
    await user.click(screen.getByRole('button', { name: 'Book venue' }))

    expect(await screen.findByText('Venue booked')).toBeInTheDocument()
    expect(created).toMatchObject({ clubId: null, title: 'Board of Studies', startTime: '14:00', endTime: '16:00' })
  })

  it('sends the user back to pick a time when the slot is taken at the last moment', async () => {
    server.use(
      http.get(`${API}/venues/meta`, () => ok(meta)),
      http.post(`${API}/venues/check-availability`, () => ok({ available: true, bufferMinutes: 15, competingRequests: 0, conflicts: [], suggestions: [] })),
      http.post(`${API}/bookings`, () => fail(409, 'SLOT_UNAVAILABLE', 'That slot is already booked', {
        conflicts: [{ title: 'Just Booked', club: 'Cultural Committee', startTime: '14:00', endTime: '16:00' }],
        suggestions: [{ startTime: '16:15', endTime: '18:15' }],
      })),
    )
    const { user } = renderApp(`/bookings/new?venueId=2&date=${date}&start=14:00`, { user: clubHead })

    await user.click(await screen.findByRole('button', { name: /Continue/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Continue/ })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.type(screen.getByLabelText('Event title'), 'Late Night')
    await user.selectOptions(screen.getByLabelText('Category'), 'SOCIAL')
    await user.type(screen.getByLabelText('Expected attendance'), '30')
    await user.selectOptions(screen.getByLabelText('Your club'), '1')
    await user.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByText('That slot was just booked')).toBeInTheDocument()
    expect(screen.getByText(/Just Booked · Cultural Committee/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4:15 pm – 6:15 pm' })).toBeInTheDocument()
  })

  it('shows invalid-time guidance from the server', async () => {
    server.use(
      http.get(`${API}/venues/meta`, () => ok(meta)),
      http.post(`${API}/venues/check-availability`, () => fail(422, 'VALIDATION_ERROR', 'Choose a valid time slot', [{ field: 'startTime', message: 'That time has already passed' }])),
    )
    const { user } = renderApp(`/bookings/new?venueId=2&date=${date}&start=09:00`, { user: clubHead })
    await user.click(await screen.findByRole('button', { name: /Continue/ }))
    expect(await screen.findByText('That time has already passed')).toBeInTheDocument()
  })

  it('is closed to students', async () => {
    renderApp('/bookings/new', { user: makeUser() })
    expect(await screen.findByRole('heading', { name: "You don't have access here" })).toBeInTheDocument()
  })
})

describe('bookings list and decisions', () => {
  it('shows a club head their requests, with rejection reasons, and lets them cancel', async () => {
    let cancelled = false
    server.use(
      http.get(`${API}/bookings`, ({ request }) => {
        const q = Object.fromEntries(new URL(request.url).searchParams)
        if (q.status === 'REJECTED') {
          return ok([booking({ id: 51, status: 'REJECTED', rejectionReason: 'Exam invigilation', permissions: { canDecide: false, canCancel: false } })], { page: 1, pageSize: 50, total: 1, totalPages: 1 })
        }
        return ok([booking({ status: cancelled ? 'CANCELLED' : 'PENDING', permissions: { canDecide: false, canCancel: !cancelled } })], { page: 1, pageSize: 50, total: 1, totalPages: 1 })
      }),
      http.post(`${API}/bookings/50/cancel`, () => { cancelled = true; return ok(booking({ status: 'CANCELLED' })) }),
    )
    const { user } = renderApp('/bookings', { user: clubHead })

    expect(await screen.findByText('Hack Night')).toBeInTheDocument()
    expect(within(screen.getByRole('listitem')).getByText('Pending approval')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Needs decision/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Cancel this booking?' })).getByRole('button', { name: 'Cancel booking' }))
    expect(await screen.findByText('Booking cancelled')).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByRole('listitem')).getByText('Cancelled')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'REJECTED')
    expect(await screen.findByText(/Exam invigilation/)).toBeInTheDocument()
  })

  it('opens faculty on their decisions, approves, and requires a reason to reject', async () => {
    let decided = []
    let rejectBody
    server.use(
      http.get(`${API}/bookings`, ({ request }) => {
        const view = new URL(request.url).searchParams.get('view')
        const pending = [booking({ id: 60, permissions: { canDecide: true, canCancel: true } }), booking({ id: 61, event: { ...booking().event, title: 'Music Jam', club: { id: 2, name: 'Cultural Committee' } }, permissions: { canDecide: true, canCancel: true } })]
          .filter((b) => !decided.includes(b.id))
        if (view === 'decisions') return ok(pending, { page: 1, pageSize: 50, total: pending.length, totalPages: 1 })
        return ok([], { page: 1, pageSize: 50, total: 0, totalPages: 0 })
      }),
      http.post(`${API}/bookings/60/approve`, () => { decided = [60, 61]; return ok(booking({ id: 60, status: 'APPROVED' })) }),
      http.post(`${API}/bookings/61/reject`, async ({ request }) => { rejectBody = await request.json(); return ok(booking({ id: 61, status: 'REJECTED' })) }),
    )
    const { user } = renderApp('/bookings', { user: coordinator })

    expect(await screen.findByRole('tab', { name: /Needs decision/ })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Music Jam')).toBeInTheDocument()
    expect(screen.getAllByText(/requested by Gaurav Jadhav/)).toHaveLength(2)

    // Reject needs a reason.
    const rows = screen.getAllByRole('listitem')
    await user.click(within(rows[1]).getByRole('button', { name: /Reject/ }))
    const rejectDialog = screen.getByRole('dialog', { name: 'Reject this request' })
    const confirm = within(rejectDialog).getByRole('button', { name: 'Reject request' })
    expect(confirm).toBeDisabled()
    await user.type(within(rejectDialog).getByLabelText('Reason'), 'Clashes with exams')
    await user.click(confirm)
    expect(await screen.findByText('Request rejected')).toBeInTheDocument()
    expect(rejectBody).toEqual({ reason: 'Clashes with exams' })

    await user.click(within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: /Approve/ }))
    const approveDialog = screen.getByRole('dialog', { name: 'Approve this request?' })
    expect(approveDialog).toHaveTextContent(/declined automatically/)
    await user.click(within(approveDialog).getByRole('button', { name: 'Approve and book' }))

    expect(await screen.findByText('Request approved')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Nothing waiting for you' })).toBeInTheDocument()
  })

  it('shows an approval conflict inside the dialog', async () => {
    server.use(
      http.get(`${API}/bookings`, () => ok([booking({ permissions: { canDecide: true, canCancel: true } })], { page: 1, pageSize: 50, total: 1, totalPages: 1 })),
      http.post(`${API}/bookings/50/approve`, () => fail(409, 'BOOKING_NOT_PENDING', 'This request is already rejected')),
    )
    const { user } = renderApp('/bookings', { user: coordinator })
    await user.click(await screen.findByRole('button', { name: /Approve/ }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Approve and book' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already rejected')
  })

  it('switches to the department view and shows direct bookings', async () => {
    const views = []
    server.use(http.get(`${API}/bookings`, ({ request }) => {
      views.push(new URL(request.url).searchParams.get('view'))
      return ok([booking({ status: 'APPROVED', isDirect: true, event: { ...booking().event, club: null, scope: 'DEPARTMENT' }, permissions: { canDecide: false, canCancel: false } })], { page: 1, pageSize: 50, total: 1, totalPages: 1 })
    }))
    const { user } = renderApp('/bookings', { user: coordinator })
    await user.click(await screen.findByRole('tab', { name: 'Department' }))
    await waitFor(() => expect(views.at(-1)).toBe('all'))
    expect(await screen.findByText('Direct')).toBeInTheDocument()
    expect(screen.getByText(/IT department event/)).toBeInTheDocument()
  })

  it('shows a helpful empty state and load errors', async () => {
    server.use(http.get(`${API}/bookings`, () => ok([], { page: 1, pageSize: 50, total: 0, totalPages: 0 })))
    const { unmount } = renderApp('/bookings', { user: clubHead })
    expect(await screen.findByRole('heading', { name: 'No bookings yet' })).toBeInTheDocument()
    unmount()

    server.use(http.get(`${API}/bookings`, () => fail(500, 'INTERNAL_ERROR', 'Boom')))
    renderApp('/bookings', { user: clubHead })
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load bookings')
  })
})
