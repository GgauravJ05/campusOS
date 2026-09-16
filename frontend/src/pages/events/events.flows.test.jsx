import { http } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp, currentPath } from '@/test/render'
import { API, coordinator, departments, fail, makeUser, ok, server } from '@/test/server'

const student = makeUser()
const head = makeUser({ id: 4, fullName: 'Gaurav Jadhav', role: { key: 'CLUB_HEAD', name: 'Club Head', rank: 3 } })

const permissions = (overrides = {}) => ({
  canRegister: false, canCancelRegistration: false, canPublish: false, canEdit: false, canViewRoster: false, ...overrides,
})

function event(overrides = {}) {
  return {
    id: 1,
    title: 'Hack Night',
    description: 'Bring a laptop.',
    category: 'TECHNICAL',
    scope: 'CLUB',
    status: 'PUBLISHED',
    date: '2026-10-12',
    startTime: '10:00',
    endTime: '12:00',
    startAt: '2026-10-12T04:30:00.000Z',
    endAt: '2026-10-12T06:30:00.000Z',
    bannerUrl: null,
    maxSeats: 40,
    bookedSeats: 12,
    seatsLeft: 28,
    isFull: false,
    waitlistCount: 0,
    eligibility: { departments: [], years: [], ineligibleReason: null },
    club: { id: 1, name: 'Developer Student Club' },
    department: departments[0],
    venue: { id: 3, name: 'Seminar Hall A', building: 'Main Building', floor: 1, capacity: 200 },
    bookingId: 9,
    createdBy: { id: 2, fullName: 'Nishanti Naidu' },
    createdAt: '2026-09-16T05:00:00.000Z',
    updatedAt: '2026-09-16T05:00:00.000Z',
    myRegistration: null,
    permissions: permissions({ canRegister: true }),
    ...overrides,
  }
}

const feed = (items, meta) => ok({ items, meta: { page: 1, pageSize: 12, total: items.length, totalPages: 1, ...meta } })

/** The feed and the recommendation rail are both requested by the page. */
function listHandlers({ items = [event()], recommended = [], onQuery } = {}) {
  return [
    http.get(`${API}/events`, ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams)
      onQuery?.(query)
      const filtered = typeof items === 'function' ? items(query) : items
      return feed(filtered)
    }),
    http.get(`${API}/events/recommended`, () => ok({ items: recommended, basedOnHistory: recommended.length > 0 })),
  ]
}

describe('event discovery feed (FR14)', () => {
  it('lists upcoming events with their venue, time and how full they are', async () => {
    const queries = []
    server.use(...listHandlers({
      items: [event(), event({ id: 2, title: 'Dance Night', category: 'CULTURAL', club: { id: 2, name: 'Cultural Committee' }, bookedSeats: 40, seatsLeft: 0, isFull: true })],
      onQuery: (q) => queries.push(q),
    }))
    renderApp('/events', { user: student })

    const card = await screen.findByRole('link', { name: /Hack Night/ })
    expect(card).toHaveAttribute('href', '/events/1')
    expect(within(card).getByText('Developer Student Club')).toBeInTheDocument()
    expect(within(card).getByText('Seminar Hall A')).toBeInTheDocument()
    expect(within(card).getByText('10 am – 12 pm')).toBeInTheDocument()
    expect(within(card).getByText('28 seats left')).toBeInTheDocument()

    const full = screen.getByRole('link', { name: /Dance Night/ })
    expect(within(full).getByText('Fully booked')).toBeInTheDocument()
    expect(within(full).getByText('Full')).toBeInTheDocument()

    // "Upcoming" is the default view, so past events never lead the feed.
    expect(queries[0]).toMatchObject({ upcoming: 'true' })
  })

  it('filters by search and category, and resets to the first page', async () => {
    const queries = []
    server.use(...listHandlers({
      items: (q) => (q.category === 'CULTURAL' ? [event({ id: 2, title: 'Dance Night', category: 'CULTURAL' })] : [event()]),
      onQuery: (q) => queries.push(q),
    }))
    const { user } = renderApp('/events?page=2', { user: student })

    await screen.findByRole('link', { name: /Hack Night/ })
    await user.selectOptions(screen.getByLabelText('Filter by category'), 'CULTURAL')
    expect(await screen.findByRole('link', { name: /Dance Night/ })).toBeInTheDocument()
    expect(queries.at(-1)).toMatchObject({ category: 'CULTURAL' })
    expect(queries.at(-1).page).toBeUndefined()

    await user.type(screen.getByLabelText('Search events'), 'dance')
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ q: 'dance', category: 'CULTURAL' }))
  })

  it('shows only the events the student is going to under "I\'m going"', async () => {
    const queries = []
    server.use(...listHandlers({
      items: (q) => (q.mine ? [event({ myRegistration: { id: 5, status: 'RESERVED', seats: 1, registeredAt: '2026-09-16T05:00:00.000Z' } })] : [event(), event({ id: 2, title: 'Dance Night' })]),
      onQuery: (q) => queries.push(q),
    }))
    const { user } = renderApp('/events', { user: student })

    await screen.findByRole('link', { name: /Dance Night/ })
    await user.click(screen.getByRole('button', { name: "I'm going" }))

    await waitFor(() => expect(queries.at(-1)).toMatchObject({ mine: 'true' }))
    const card = await screen.findByRole('link', { name: /Hack Night/ })
    expect(within(card).getByText("You're going")).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Dance Night/ })).not.toBeInTheDocument()
  })

  it('offers "Ready to publish" to organisers only', async () => {
    server.use(...listHandlers())
    const { unmount } = renderApp('/events', { user: student })
    await screen.findByRole('link', { name: /Hack Night/ })
    expect(screen.queryByRole('button', { name: 'Ready to publish' })).not.toBeInTheDocument()
    unmount()

    const queries = []
    server.use(...listHandlers({
      items: (q) => (q.status === 'APPROVED' ? [event({ status: 'APPROVED', permissions: permissions({ canPublish: true }) })] : [event()]),
      onQuery: (q) => queries.push(q),
    }))
    const { user } = renderApp('/events', { user: coordinator })
    await screen.findByRole('link', { name: /Hack Night/ })
    await user.click(screen.getByRole('button', { name: 'Ready to publish' }))

    await waitFor(() => expect(queries.at(-1)).toMatchObject({ status: 'APPROVED' }))
    const card = await screen.findByRole('link', { name: /Hack Night/ })
    expect(within(card).getByText('Ready to publish')).toBeInTheDocument()
  })

  it('pages through a long feed', async () => {
    const queries = []
    server.use(
      http.get(`${API}/events`, ({ request }) => {
        const query = Object.fromEntries(new URL(request.url).searchParams)
        queries.push(query)
        const page = Number(query.page) || 1
        return feed([event({ id: page, title: `Event on page ${page}` })], { page, total: 30, totalPages: 3 })
      }),
      http.get(`${API}/events/recommended`, () => ok({ items: [], basedOnHistory: false })),
    )
    const { user } = renderApp('/events', { user: student })

    await screen.findByRole('link', { name: /Event on page 1/ })
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Next/ }))

    expect(await screen.findByRole('link', { name: /Event on page 2/ })).toBeInTheDocument()
    expect(queries.at(-1)).toMatchObject({ page: '2' })
    expect(screen.getByText('Page 2 of 3 · 30 events')).toBeInTheDocument()
  })

  it('says so plainly when there is nothing to show', async () => {
    server.use(...listHandlers({ items: [] }))
    renderApp('/events', { user: student })
    expect(await screen.findByRole('heading', { name: 'No events coming up' })).toBeInTheDocument()
  })

  it('surfaces a failure instead of an empty feed', async () => {
    server.use(
      http.get(`${API}/events`, () => fail(500, 'SERVER_ERROR', 'Something went wrong')),
      http.get(`${API}/events/recommended`, () => ok({ items: [], basedOnHistory: false })),
    )
    renderApp('/events', { user: student })
    expect(await screen.findByText('Could not load events')).toBeInTheDocument()
  })
})

describe('recommendations (FR17)', () => {
  it('explains why each event is recommended, and only on the unfiltered feed', async () => {
    server.use(...listHandlers({
      recommended: [event({ id: 7, title: 'Robotics Showcase', reason: 'You have registered for 2 technical events', score: 9 })],
    }))
    const { user } = renderApp('/events', { user: student })

    const rail = await screen.findByRole('region', { name: 'Recommended for you' })
    expect(within(rail).getByText('You have registered for 2 technical events')).toBeInTheDocument()
    expect(within(rail).getByText('Based on what you have registered for')).toBeInTheDocument()

    // Filtering is an explicit search - suggestions would only be in the way.
    await user.selectOptions(screen.getByLabelText('Filter by category'), 'CULTURAL')
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Recommended for you' })).not.toBeInTheDocument())
  })

  it('calls the rail "Happening soon" for a student with no history', async () => {
    server.use(
      http.get(`${API}/events`, () => feed([event()])),
      http.get(`${API}/events/recommended`, () => ok({
        items: [event({ id: 7, title: 'Robotics Showcase', reason: 'Open to you and coming up soon', score: 0 })],
        basedOnHistory: false,
      })),
    )
    renderApp('/events', { user: student })
    expect(await screen.findByRole('region', { name: 'Happening soon' })).toBeInTheDocument()
  })

  it('hides the rail entirely when there is nothing to suggest', async () => {
    server.use(...listHandlers())
    renderApp('/events', { user: student })
    await screen.findByRole('link', { name: /Hack Night/ })
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})

describe('event detail and RSVP (FR15, FR16)', () => {
  const detailHandler = (data) => http.get(`${API}/events/1`, () => ok(data))

  it('shows the event and reserves a seat', async () => {
    let sent
    server.use(
      detailHandler(event()),
      http.post(`${API}/events/1/registrations`, async ({ request }) => {
        sent = await request.json()
        return ok({
          registrationId: 5,
          event: event({ bookedSeats: 13, seatsLeft: 27, myRegistration: { id: 5, status: 'RESERVED', seats: 1, registeredAt: '2026-09-16T05:00:00.000Z' }, permissions: permissions({ canCancelRegistration: true }) }),
        })
      }),
    )
    const { user } = renderApp('/events/1', { user: student })

    expect(await screen.findByRole('heading', { name: 'Hack Night' })).toBeInTheDocument()
    expect(screen.getByText('Monday, 12 October 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Seminar Hall A' })).toHaveAttribute('href', '/venues/3')
    expect(screen.getByText('12 of 40 seats taken')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Reserve my seat/ }))

    expect(await screen.findByText(/One seat reserved/)).toBeInTheDocument()
    expect(sent).toEqual({ seats: 1 })
    expect(screen.getByText('13 of 40 seats taken')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel my registration' })).toBeInTheDocument()
  })

  it('reserves several seats at once', async () => {
    let sent
    server.use(
      detailHandler(event()),
      http.post(`${API}/events/1/registrations`, async ({ request }) => {
        sent = await request.json()
        return ok({ registrationId: 5, event: event({ bookedSeats: 15, seatsLeft: 25, myRegistration: { id: 5, status: 'RESERVED', seats: 3, registeredAt: '2026-09-16T05:00:00.000Z' } }) })
      }),
    )
    const { user } = renderApp('/events/1', { user: student })

    await screen.findByRole('heading', { name: 'Hack Night' })
    await user.selectOptions(screen.getByLabelText('Number of seats'), '3')
    await user.click(screen.getByRole('button', { name: /Reserve 3 seats/ }))

    await waitFor(() => expect(sent).toEqual({ seats: 3 }))
    expect(await screen.findByText(/3 seats reserved/)).toBeInTheDocument()
  })

  it('confirms before releasing a seat, then returns it (FR16)', async () => {
    let cancelled = false
    server.use(
      detailHandler(event({
        bookedSeats: 13,
        seatsLeft: 27,
        myRegistration: { id: 5, status: 'RESERVED', seats: 2, registeredAt: '2026-09-16T05:00:00.000Z' },
        permissions: permissions({ canCancelRegistration: true }),
      })),
      http.delete(`${API}/events/1/registrations/me`, () => {
        cancelled = true
        return ok({ seatsReleased: 2, promoted: 0, event: event({ bookedSeats: 11, seatsLeft: 29 }) })
      }),
    )
    const { user } = renderApp('/events/1', { user: student })

    await user.click(await screen.findByRole('button', { name: 'Cancel my registration' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/register again while seats last/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Cancel registration' }))
    await waitFor(() => expect(cancelled).toBe(true))
    expect(await screen.findByText('11 of 40 seats taken')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reserve my seat/ })).toBeInTheDocument()
  })

  it('keeps the seat when the confirmation is declined', async () => {
    let cancelled = false
    server.use(
      detailHandler(event({
        myRegistration: { id: 5, status: 'RESERVED', seats: 1, registeredAt: '2026-09-16T05:00:00.000Z' },
        permissions: permissions({ canCancelRegistration: true }),
      })),
      http.delete(`${API}/events/1/registrations/me`, () => { cancelled = true; return ok({}) }),
    )
    const { user } = renderApp('/events/1', { user: student })

    await user.click(await screen.findByRole('button', { name: 'Cancel my registration' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Keep my seat' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cancelled).toBe(false)
  })

  it('names the departments and years an event is limited to', async () => {
    server.use(detailHandler(event({ eligibility: { departments: [1], years: [2, 3], ineligibleReason: null } })))
    renderApp('/events/1', { user: student })

    expect(await screen.findByText('IT · Year 2, Year 3')).toBeInTheDocument()
  })

  it('says an unrestricted event is open to everyone', async () => {
    server.use(detailHandler(event()))
    renderApp('/events/1', { user: student })

    expect(await screen.findByText('Open to everyone')).toBeInTheDocument()
  })

  it('explains an eligibility refusal rather than offering a button that fails', async () => {
    server.use(detailHandler(event({
      eligibility: { departments: [2], years: [], ineligibleReason: 'This event is open to other departments only' },
      permissions: permissions(),
    })))
    renderApp('/events/1', { user: student })

    expect(await screen.findByText('Not open to you')).toBeInTheDocument()
    expect(screen.getByText('This event is open to other departments only')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reserve/ })).not.toBeInTheDocument()
  })

  it('reports a full event when the last seat goes to someone else first', async () => {
    server.use(
      detailHandler(event({ seatsLeft: 1 })),
      http.post(`${API}/events/1/registrations`, () => fail(409, 'EVENT_FULL', 'This event is fully booked')),
    )
    const { user } = renderApp('/events/1', { user: student })

    await user.click(await screen.findByRole('button', { name: /Reserve my seat/ }))
    expect(await screen.findByText('This event is fully booked')).toBeInTheDocument()
  })

  it('shows a waitlist place as a waitlist place, not a seat', async () => {
    server.use(
      detailHandler(event({ bookedSeats: 40, seatsLeft: 0, isFull: true, waitlistCount: 2 })),
      http.post(`${API}/events/1/registrations`, () => ok({
        registrationId: 6,
        event: event({ bookedSeats: 40, seatsLeft: 0, isFull: true, waitlistCount: 3, myRegistration: { id: 6, status: 'WAITLISTED', seats: 1, registeredAt: '2026-09-16T05:00:00.000Z' }, permissions: permissions({ canCancelRegistration: true }) }),
      })),
    )
    const { user } = renderApp('/events/1', { user: student })

    await screen.findByRole('heading', { name: 'Hack Night' })
    expect(screen.getByText('2 waiting')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Reserve my seat/ }))

    expect(await screen.findByText('Waitlisted')).toBeInTheDocument()
    expect(screen.getByText(/moved up automatically/)).toBeInTheDocument()
  })

  it('shows a missing event as missing', async () => {
    server.use(http.get(`${API}/events/1`, () => fail(404, 'NOT_FOUND', 'Event not found')))
    renderApp('/events/1', { user: student })
    expect(await screen.findByRole('heading', { name: 'Event not found' })).toBeInTheDocument()
  })
})

describe('organising an event', () => {
  it('publishes an approved event with a seat limit and an audience', async () => {
    let published
    const approved = event({
      status: 'APPROVED',
      maxSeats: 60,
      bookedSeats: 0,
      seatsLeft: 60,
      permissions: permissions({ canPublish: true, canEdit: true, canViewRoster: true }),
    })
    server.use(
      http.get(`${API}/events/1`, () => ok(approved)),
      http.get(`${API}/events/1/registrations`, () => ok({ items: [], meta: { total: 0, reserved: 0, waitlisted: 0, maxSeats: 60 } })),
      http.post(`${API}/events/1/publish`, async ({ request }) => {
        published = await request.json()
        return ok(event({ maxSeats: 50, seatsLeft: 50, eligibility: { departments: [1], years: [3], ineligibleReason: null }, permissions: permissions({ canEdit: true, canViewRoster: true }) }))
      }),
    )
    const { user } = renderApp('/events/1', { user: coordinator })

    expect(await screen.findByText('Ready to publish')).toBeInTheDocument()
    expect(screen.getByText(/Publish the event to let students reserve seats/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Publish event/ }))
    const dialog = await screen.findByRole('dialog')

    const seats = within(dialog).getByLabelText(/Seats/)
    await user.clear(seats)
    await user.type(seats, '50')
    await user.click(within(dialog).getByRole('checkbox', { name: 'IT' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Third year' }))
    await user.click(within(dialog).getByRole('button', { name: 'Publish event' }))

    await waitFor(() => expect(published).toMatchObject({ maxSeats: 50, eligibleDepartments: [1], eligibleYears: [3] }))
    expect(await screen.findByText('Event published')).toBeInTheDocument()
    expect(await screen.findByText('Open')).toBeInTheDocument()
  })

  it('refuses a seat limit larger than the venue before sending it', async () => {
    server.use(
      http.get(`${API}/events/1`, () => ok(event({ status: 'APPROVED', permissions: permissions({ canPublish: true }) }))),
      http.get(`${API}/events/1/registrations`, () => ok({ items: [], meta: { total: 0, reserved: 0, waitlisted: 0, maxSeats: null } })),
    )
    const { user } = renderApp('/events/1', { user: coordinator })

    await user.click(await screen.findByRole('button', { name: /Publish event/ }))
    const dialog = await screen.findByRole('dialog')
    const seats = within(dialog).getByLabelText(/Seats/)
    await user.clear(seats)
    await user.type(seats, '900')

    expect(await within(dialog).findByText('Seminar Hall A holds 200')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Publish event' })).toBeDisabled()
  })

  it('shows the organiser who is coming, including the waitlist', async () => {
    server.use(
      http.get(`${API}/events/1`, () => ok(event({ permissions: permissions({ canEdit: true, canViewRoster: true }) }))),
      http.get(`${API}/events/1/registrations`, () => ok({
        items: [
          { id: 1, status: 'RESERVED', seats: 2, registeredAt: '2026-09-16T05:00:00.000Z', cancelledAt: null, student: { id: 10, fullName: 'Asha Kulkarni', email: 'asha@mmcoe.edu.in', academicYear: 2, department: 'IT' } },
          { id: 2, status: 'WAITLISTED', seats: 1, registeredAt: '2026-09-16T06:00:00.000Z', cancelledAt: null, student: { id: 11, fullName: 'Omkar Shinde', email: 'omkar@mmcoe.edu.in', academicYear: 1, department: 'ENTC' } },
        ],
        meta: { total: 2, reserved: 2, waitlisted: 1, maxSeats: 40 },
      })),
    )
    renderApp('/events/1', { user: head })

    expect(await screen.findByText('2 seats reserved · 1 waitlisted')).toBeInTheDocument()
    const asha = screen.getByText('Asha Kulkarni').closest('li')
    expect(within(asha).getByText('Going')).toBeInTheDocument()
    expect(within(asha).getByText('2 seats')).toBeInTheDocument()
    expect(within(screen.getByText('Omkar Shinde').closest('li')).getByText('Waitlisted')).toBeInTheDocument()
  })

  it('never shows the roster or the publish button to a student', async () => {
    server.use(http.get(`${API}/events/1`, () => ok(event())))
    renderApp('/events/1', { user: student })

    await screen.findByRole('heading', { name: 'Hack Night' })
    expect(screen.queryByText("Who's coming")).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Publish event/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit details/ })).not.toBeInTheDocument()
  })

  it('edits a published event', async () => {
    let changes
    server.use(
      http.get(`${API}/events/1`, () => ok(event({ permissions: permissions({ canEdit: true, canViewRoster: true }) }))),
      http.get(`${API}/events/1/registrations`, () => ok({ items: [], meta: { total: 0, reserved: 0, waitlisted: 0, maxSeats: 40 } })),
      http.patch(`${API}/events/1`, async ({ request }) => {
        changes = await request.json()
        return ok(event({ description: 'Now with free pizza', permissions: permissions({ canEdit: true, canViewRoster: true }) }))
      }),
    )
    const { user } = renderApp('/events/1', { user: coordinator })

    await user.click(await screen.findByRole('button', { name: /Edit details/ }))
    const dialog = await screen.findByRole('dialog')
    const description = within(dialog).getByLabelText(/Description/)
    await user.clear(description)
    await user.type(description, 'Now with free pizza')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(changes).toMatchObject({ description: 'Now with free pizza' }))
    expect(await screen.findByText('Now with free pizza')).toBeInTheDocument()
  })
})

describe('event notifications (FR19)', () => {
  const notification = (overrides = {}) => ({
    id: 1, category: 'EVENT_REMINDER', title: 'Starting in 2 days: Hack Night',
    message: 'Hack Night starts in 2 days at Seminar Hall A.',
    eventId: 1, bookingId: 9, isRead: false, createdAt: new Date().toISOString(), readAt: null,
    ...overrides,
  })

  const bellHandlers = (items) => [
    http.get(`${API}/notifications`, () => ok(items, { page: 1, pageSize: 8, total: items.length, totalPages: 1, unread: items.filter((n) => !n.isRead).length })),
    http.get(`${API}/bookings/summary`, () => ok({ awaitingDecision: 0, myChangesRequested: 0, myAwaitingApproval: 0, unreadNotifications: items.filter((n) => !n.isRead).length })),
    http.post(`${API}/notifications/1/read`, () => ok({ id: 1, isRead: true })),
  ]

  it('opens the event from a reminder, not the booking behind it', async () => {
    server.use(...bellHandlers([notification()]), ...listHandlers(), http.get(`${API}/events/1`, () => ok(event())))
    const { user } = renderApp('/events', { user: student })

    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    const panel = await screen.findByRole('region', { name: 'Notifications' })
    await user.click(within(panel).getByRole('button', { name: /Starting in 2 days/ }))

    // An event notification carries a bookingId too; a student sent to
    // /bookings would land on a page they cannot use.
    await waitFor(() => expect(currentPath()).toBe('/events/1'))
  })

  it('routes every event notification category to the event', async () => {
    for (const category of ['EVENT_PUBLISHED', 'REGISTRATION_CONFIRMED', 'EVENT_CANCELLED']) {
      server.use(...bellHandlers([notification({ category, title: `Test ${category}` })]), ...listHandlers(), http.get(`${API}/events/1`, () => ok(event())))
      const { user, unmount } = renderApp('/dashboard', { user: student })

      await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
      const panel = await screen.findByRole('region', { name: 'Notifications' })
      // eslint-disable-next-line no-await-in-loop
      await user.click(within(panel).getByRole('button', { name: new RegExp(`Test ${category}`) }))
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => expect(currentPath()).toBe('/events/1'))
      unmount()
    }
  })

  it('still sends a booking notification to the bookings page', async () => {
    server.use(...bellHandlers([notification({ category: 'BOOKING_APPROVED', title: 'Approved: Hack Night', eventId: 1, bookingId: 9 })]))
    const { user } = renderApp('/dashboard', { user: coordinator })

    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    const panel = await screen.findByRole('region', { name: 'Notifications' })
    await user.click(within(panel).getByRole('button', { name: /Approved: Hack Night/ }))

    await waitFor(() => expect(currentPath()).toBe('/bookings'))
  })
})

describe('navigation', () => {
  it('reaches an event from the feed', async () => {
    server.use(...listHandlers(), http.get(`${API}/events/1`, () => ok(event())))
    const { user } = renderApp('/events', { user: student })

    await user.click(await screen.findByRole('link', { name: /Hack Night/ }))
    await waitFor(() => expect(currentPath()).toBe('/events/1'))
    expect(await screen.findByRole('heading', { name: 'Hack Night' })).toBeInTheDocument()
  })

  it('offers Events to every signed-in role', async () => {
    server.use(...listHandlers())
    renderApp('/events', { user: student })
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/events')
    expect(within(nav).queryByText('Soon')).not.toBeInTheDocument()
  })
})
