import { http } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp, currentPath } from '@/test/render'
import { API, coordinator, emptySummary, fail, makeUser, ok, server } from '@/test/server'
import { addDays, campusToday } from '@/lib/campusTime'

const RULES = { defaultBufferMinutes: 15, openingTime: '07:00', closingTime: '21:00', maxAdvanceDays: 90, minDurationMinutes: 30, maxDurationMinutes: 720 }
const meta = {
  buildings: [
    { name: 'Main Building', floors: [
      { floor: 1, venues: [{ id: 2, name: 'Seminar Hall A', type: 'SEMINAR_HALL', capacity: 200 }] },
      { floor: 2, venues: [{ id: 3, name: 'Seminar Hall B', type: 'SEMINAR_HALL', capacity: 150 }] },
    ] },
  ],
  types: [], equipment: [], rules: RULES,
}

const clubHead = makeUser({
  id: 4,
  fullName: 'Gaurav Jadhav',
  role: { key: 'CLUB_HEAD', name: 'Club Head', rank: 3 },
  clubs: [{ id: 1, name: 'IT Tech Club', scope: 'DEPARTMENT', isHead: true, position: 'PRESIDENT' }],
})

const date = addDays(campusToday(), 12)
const page = (items) => ok(items, { page: 1, pageSize: 50, total: items.length, totalPages: 1 })

function booking(overrides = {}) {
  return {
    id: 70, status: 'PENDING', date, startTime: '10:00', endTime: '12:00', bufferMinutes: 15, isDirect: false,
    rejectionReason: null, modificationNote: null, revision: 0, competingRequests: 0, decidedAt: null, createdAt: new Date().toISOString(),
    venue: { id: 2, name: 'Seminar Hall A', building: 'Main Building', floor: 1, capacity: 200 },
    event: { id: 9, title: 'Hack Night', description: 'Bring laptops', category: 'TECHNICAL', scope: 'CLUB', expectedAttendance: 80, status: 'PENDING_APPROVAL', club: { id: 1, name: 'IT Tech Club' }, department: { id: 1, code: 'IT' } },
    requestedBy: { id: 4, fullName: 'Gaurav Jadhav', email: 'g@mmcoe.edu.in' },
    decidedBy: null,
    permissions: { canDecide: false, canReject: false, canEdit: false, canCancel: true },
    ...overrides,
  }
}

const sentBack = (overrides = {}) => booking({
  status: 'MODIFICATION_REQUESTED',
  modificationNote: 'Too many people for a Friday evening.',
  decidedBy: { id: 2, fullName: 'Nishanti Naidu' },
  permissions: { canDecide: false, canReject: false, canEdit: true, canCancel: true },
  ...overrides,
})

describe('approver: request changes (FR13)', () => {
  it('sends a request back with a required note and shows competing and resubmitted requests', async () => {
    let body
    let decided = false
    server.use(
      http.get(`${API}/bookings`, () => page(decided ? [] : [
        booking({ competingRequests: 2, revision: 1, modificationNote: 'Move it later', permissions: { canDecide: true, canReject: true, canEdit: false, canCancel: true } }),
      ])),
      http.post(`${API}/bookings/70/request-changes`, async ({ request }) => {
        body = await request.json()
        decided = true
        return ok(sentBack())
      }),
    )
    const { user } = renderApp('/bookings', { user: coordinator })

    const card = await screen.findByRole('listitem')
    expect(within(card).getByText('2 competing')).toBeInTheDocument()
    expect(within(card).getByText('Resubmitted')).toBeInTheDocument()
    expect(within(card).getByText(/Earlier you asked for:/).closest('p')).toHaveTextContent('Move it later')

    await user.click(within(card).getByRole('button', { name: /Request changes/ }))
    const dialog = screen.getByRole('dialog', { name: 'Request changes' })
    expect(dialog).toHaveTextContent(/slot is not held/)
    const send = within(dialog).getByRole('button', { name: 'Send back to club' })
    expect(send).toBeDisabled()

    await user.type(within(dialog).getByLabelText('What should change?'), 'Lower the attendance')
    await user.click(send)

    expect(await screen.findByText('Sent back for changes')).toBeInTheDocument()
    expect(body).toEqual({ note: 'Lower the attendance' })
    expect(await screen.findByRole('heading', { name: 'Nothing waiting for you' })).toBeInTheDocument()
  })

  it('lists requests waiting on the club and can still reject them', async () => {
    const queries = []
    let rejected
    server.use(
      http.get(`${API}/bookings`, ({ request }) => {
        const q = Object.fromEntries(new URL(request.url).searchParams)
        queries.push(q)
        if (q.status === 'MODIFICATION_REQUESTED') {
          return page(rejected ? [] : [sentBack({ permissions: { canDecide: false, canReject: true, canEdit: false, canCancel: true } })])
        }
        return page([])
      }),
      http.post(`${API}/bookings/70/reject`, async ({ request }) => {
        rejected = await request.json()
        return ok(booking({ status: 'REJECTED' }))
      }),
    )
    const { user } = renderApp('/bookings', { user: coordinator })

    await user.click(await screen.findByRole('tab', { name: 'Waiting on club' }))
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ view: 'decisions', status: 'MODIFICATION_REQUESTED' }))

    const card = await screen.findByRole('listitem')
    expect(within(card).getByText(/You asked for:/).closest('p')).toHaveTextContent('Too many people for a Friday evening.')
    expect(within(card).queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Request changes/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Filter by status')).not.toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: /Reject/ }))
    const dialog = screen.getByRole('dialog', { name: 'Reject this request' })
    await user.type(within(dialog).getByLabelText('Reason'), 'No reply from the club')
    await user.click(within(dialog).getByRole('button', { name: 'Reject request' }))

    expect(await screen.findByText('Request rejected')).toBeInTheDocument()
    expect(rejected).toEqual({ reason: 'No reply from the club' })
    expect(await screen.findByRole('heading', { name: 'No requests sent back' })).toBeInTheDocument()
  })

  it('shows a note validation error from the server inside the dialog', async () => {
    server.use(
      http.get(`${API}/bookings`, () => page([booking({ permissions: { canDecide: true, canReject: true, canEdit: false, canCancel: true } })])),
      http.post(`${API}/bookings/70/request-changes`, () => fail(422, 'VALIDATION_ERROR', 'Invalid', [{ field: 'note', message: 'Say what should change' }])),
    )
    const { user } = renderApp('/bookings', { user: coordinator })
    await user.click(await screen.findByRole('button', { name: /Request changes/ }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('What should change?'), '     x     ')
    await user.type(within(dialog).getByLabelText('What should change?'), 'abcde')
    await user.click(within(dialog).getByRole('button', { name: 'Send back to club' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Say what should change')
  })
})

describe('requester: edit and resubmit', () => {
  function useEditServer({ onPatch, patchResponse } = {}) {
    let current = sentBack()
    server.use(
      http.get(`${API}/bookings`, () => page([current])),
      http.get(`${API}/bookings/70`, () => ok(current)),
      http.get(`${API}/venues/meta`, () => ok(meta)),
      http.post(`${API}/venues/check-availability`, () => ok({ available: true, bufferMinutes: 15, competingRequests: 1, conflicts: [], suggestions: [] })),
      http.patch(`${API}/bookings/70`, async ({ request }) => {
        const body = await request.json()
        onPatch?.(body)
        if (patchResponse) return patchResponse
        current = booking({ ...current, status: 'PENDING', revision: 1, startTime: body.startTime, endTime: body.endTime, permissions: { canDecide: false, canReject: false, canEdit: true, canCancel: true } })
        return ok(current)
      }),
    )
  }

  it('shows the approver\'s note, edits the time and details, and resubmits', async () => {
    let patched
    useEditServer({ onPatch: (body) => { patched = body } })
    const { user } = renderApp('/bookings', { user: clubHead })

    const card = await screen.findByRole('listitem')
    expect(within(card).getByText('Changes requested')).toBeInTheDocument()
    expect(within(card).getByText(/Nishanti Naidu asked for changes:/).closest('p')).toHaveTextContent('Too many people for a Friday evening.')
    await user.click(within(card).getByRole('link', { name: /Edit & resubmit/ }))

    expect(await screen.findByRole('heading', { name: 'Edit request' })).toBeInTheDocument()
    await waitFor(() => expect(currentPath()).toBe('/bookings/70/edit'))
    expect(screen.getByText('Nishanti Naidu asked for changes')).toBeInTheDocument()

    // Starts on the time step, prefilled. The request itself is not counted as a competitor.
    expect(await screen.findByLabelText('Starts')).toHaveValue('10:00')
    expect(screen.getByLabelText('Ends')).toHaveValue('12:00')
    expect(await screen.findByText('This slot is free')).toBeInTheDocument()
    expect(screen.queryByText(/other request pending/)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Starts'), '14:00')
    await user.selectOptions(screen.getByLabelText('Ends'), '16:00')
    // A different window: the other pending request is a real competitor.
    expect(await screen.findByText('1 other request pending for this time')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Continue/ }))

    expect(screen.getByLabelText('Event title')).toHaveValue('Hack Night')
    expect(screen.getByText('IT Tech Club')).toBeInTheDocument()
    expect(screen.getByText(/Can.t be changed/)).toBeInTheDocument()
    expect(screen.getByText(/back to the approver as a new version/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Expected attendance'))
    await user.type(screen.getByLabelText('Expected attendance'), '40')
    await user.clear(screen.getByLabelText(/Description/))
    await user.click(screen.getByRole('button', { name: 'Resubmit request' }))

    expect(await screen.findByText('Request resubmitted')).toBeInTheDocument()
    expect(patched).toEqual({
      venueId: 2, date, startTime: '14:00', endTime: '16:00', title: 'Hack Night', category: 'TECHNICAL', expectedAttendance: 40, description: '',
    })
    await waitFor(() => expect(currentPath()).toBe('/bookings'))
    const focused = await screen.findByRole('listitem')
    expect(focused).toHaveAttribute('data-focused', 'true')
    expect(within(focused).getByText('Resubmitted')).toBeInTheDocument()
    expect(within(focused).getByRole('link', { name: /^Edit$/ })).toHaveAttribute('href', '/bookings/70/edit')
  })

  it('can move the request to another venue from the venue step', async () => {
    let patched
    useEditServer({ onPatch: (body) => { patched = body } })
    const { user } = renderApp('/bookings/70/edit', { user: clubHead })

    await user.click(await screen.findByRole('button', { name: /Back/ }))
    await user.click(screen.getByRole('button', { name: /2nd floor/ }))
    await user.click(screen.getByRole('button', { name: /Seminar Hall B/ }))
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Continue/ })).toBeEnabled())
    // A different venue: its pending requests all count.
    expect(screen.getByText('1 other request pending for this time')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(screen.getByRole('button', { name: 'Resubmit request' }))

    await waitFor(() => expect(patched).toMatchObject({ venueId: 3, startTime: '10:00', endTime: '12:00' }))
  })

  it('returns to the time step when the slot was taken before resubmitting', async () => {
    useEditServer({
      patchResponse: fail(409, 'SLOT_UNAVAILABLE', 'That slot is already booked', {
        conflicts: [{ title: 'Board Meeting', club: 'Official event', startTime: '10:00', endTime: '11:00' }],
        suggestions: [{ startTime: '11:15', endTime: '13:15' }],
      }),
    })
    const { user } = renderApp('/bookings/70/edit', { user: clubHead })

    await waitFor(() => expect(screen.getByRole('button', { name: /Continue/ })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /Continue/ }))
    await user.click(screen.getByRole('button', { name: 'Resubmit request' }))

    expect(await screen.findByText('That slot was just booked')).toBeInTheDocument()
    expect(screen.getByText(/Board Meeting · Official event/)).toBeInTheDocument()
  })

  it('explains when a request can no longer be edited, or cannot be loaded', async () => {
    server.use(http.get(`${API}/bookings/70`, () => ok(booking({ status: 'APPROVED', permissions: { canDecide: false, canReject: false, canEdit: false, canCancel: true } }))))
    const { unmount } = renderApp('/bookings/70/edit', { user: clubHead })
    expect(await screen.findByText('This request can no longer be edited')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See its status' })).toHaveAttribute('href', '/bookings?focus=70')
    unmount()

    server.use(http.get(`${API}/bookings/71`, () => fail(404, 'NOT_FOUND', 'Booking not found')))
    renderApp('/bookings/71/edit', { user: clubHead })
    expect(await screen.findByRole('alert')).toHaveTextContent('Booking not found')
  })
})

describe('badges and the notification bell', () => {
  it('shows faculty how many requests wait for them, and club heads how many need changes', async () => {
    server.use(http.get(`${API}/bookings/summary`, () => ok({ ...emptySummary, awaitingDecision: 3 })), http.get(`${API}/bookings`, () => page([])))
    const { unmount } = renderApp('/bookings', { user: coordinator })
    expect(await screen.findByRole('link', { name: 'Bookings, 3 requests waiting for your decision' })).toBeInTheDocument()
    unmount()

    server.use(http.get(`${API}/bookings/summary`, () => ok({ ...emptySummary, myChangesRequested: 1 })))
    renderApp('/dashboard', { user: clubHead })
    expect(await screen.findByRole('link', { name: 'Bookings, 1 request needs changes' })).toBeInTheDocument()
  })

  it('lists notifications, opens the related booking and marks it read', async () => {
    const read = []
    let unread = 2
    server.use(
      http.get(`${API}/bookings/summary`, () => ok({ ...emptySummary, unreadNotifications: unread })),
      http.get(`${API}/bookings`, () => page([booking()])),
      http.get(`${API}/notifications`, () => ok([
        { id: 5, category: 'BOOKING_CHANGES_REQUESTED', title: 'Changes requested: Hack Night', message: 'Your request needs changes.', bookingId: 70, isRead: false, createdAt: new Date().toISOString() },
        { id: 4, category: 'CLUB_MEMBERSHIP', title: 'You joined DSC', message: 'Welcome aboard.', bookingId: null, isRead: true, createdAt: new Date().toISOString() },
      ], { page: 1, pageSize: 8, total: 2, totalPages: 1, unread: 1 })),
      http.post(`${API}/notifications/5/read`, () => { read.push(5); unread = 1; return ok({ id: 5, isRead: true }) }),
    )
    const { user } = renderApp('/dashboard', { user: clubHead })

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }))
    const panel = screen.getByRole('region', { name: 'Notifications' })
    expect(await within(panel).findByText('Changes requested: Hack Night')).toBeInTheDocument()
    expect(within(panel).getByText('You joined DSC')).toBeInTheDocument()
    expect(within(panel).getAllByText('Unread')).toHaveLength(1)

    await user.click(within(panel).getByRole('button', { name: /Changes requested: Hack Night/ }))
    await waitFor(() => expect(currentPath()).toBe('/bookings'))
    expect(read).toEqual([5])
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument()
  })

  it('marks everything read, shows an empty state, and survives a failed load', async () => {
    let cleared = false
    server.use(
      http.get(`${API}/bookings/summary`, () => ok({ ...emptySummary, unreadNotifications: cleared ? 0 : 1 })),
      http.get(`${API}/notifications`, () => ok([
        { id: 8, category: 'GENERAL', title: 'Welcome', message: 'Hello', bookingId: null, isRead: cleared, createdAt: new Date().toISOString() },
      ], { page: 1, pageSize: 8, total: 1, totalPages: 1, unread: cleared ? 0 : 1 })),
      http.post(`${API}/notifications/read-all`, () => { cleared = true; return ok({ updated: 1 }) }),
    )
    const { user, unmount } = renderApp('/dashboard', { user: clubHead })

    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    await user.click(await screen.findByRole('button', { name: /Mark all read/ }))
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.queryByText('Unread')).not.toBeInTheDocument()

    // Clicking a read notification with nowhere to go just closes the panel.
    await user.click(screen.getByRole('button', { name: /Welcome/ }))
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument()
    unmount()

    server.use(http.get(`${API}/notifications`, () => ok([], { page: 1, pageSize: 8, total: 0, totalPages: 0, unread: 0 })))
    const second = renderApp('/dashboard', { user: clubHead })
    await second.user.click(await screen.findByRole('button', { name: 'Notifications' }))
    expect(await screen.findByText(/all caught up/)).toBeInTheDocument()
    await second.user.keyboard('{Escape}')
    expect(screen.queryByText(/all caught up/)).not.toBeInTheDocument()
    second.unmount()

    server.use(http.get(`${API}/notifications`, () => fail(500, 'INTERNAL_ERROR', 'Boom')))
    const third = renderApp('/dashboard', { user: clubHead })
    await third.user.click(await screen.findByRole('button', { name: 'Notifications' }))
    expect(await screen.findByText(/Could not load notifications/)).toBeInTheDocument()
  })
})
