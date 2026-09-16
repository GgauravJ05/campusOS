import { http, HttpResponse } from 'msw'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderApp, currentPath } from '@/test/render'
import { API, coordinator, fail, makeUser, ok, server } from '@/test/server'

const student = makeUser()
const principal = makeUser({ id: 1, fullName: 'Dr. Principal', role: { key: 'SUPER_ADMIN', name: 'Principal & HOD', rank: 1 } })
const head = makeUser({ id: 4, fullName: 'Gaurav Jadhav', role: { key: 'CLUB_HEAD', name: 'Club Head', rank: 3 } })

// ---------------------------------------------------------------------------
// FR18 - role-tailored dashboards
// ---------------------------------------------------------------------------

const dashboard = (overrides = {}) => ({
  role: 'STUDENT',
  scope: 'DEPARTMENT',
  metrics: [
    { key: 'reserved', label: 'Seats reserved', value: 2, href: '/events?view=going' },
    { key: 'waitlisted', label: 'On a waitlist', value: 0, href: '/events?view=going' },
    { key: 'attended', label: 'Events attended', value: 5 },
    { key: 'open', label: 'Open to you', value: 9, href: '/events' },
  ],
  schedule: {
    title: 'Your next events',
    items: [{
      eventId: 1, title: 'Hack Night', date: '2026-10-12', startTime: '10:00', endTime: '12:00',
      venue: 'Seminar Hall A', club: 'Developer Student Club', status: 'PUBLISHED', seatsLeft: 28,
    }],
  },
  ...overrides,
})

describe('role-tailored dashboard (FR18)', () => {
  it('shows a student their metrics and their next events', async () => {
    server.use(http.get(`${API}/dashboard`, () => ok(dashboard())))
    renderApp('/dashboard', { user: student })

    expect(await screen.findByText('Seats reserved')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your next events' })).toBeInTheDocument()

    const event = screen.getByRole('link', { name: /Hack Night/ })
    expect(event).toHaveAttribute('href', '/events/1')
    expect(within(event).getByText(/Seminar Hall A/)).toBeInTheDocument()
    expect(within(event).getByText('28 left')).toBeInTheDocument()
  })

  it('links a metric to the screen that acts on it', async () => {
    server.use(http.get(`${API}/dashboard`, () => ok(dashboard())), http.get(`${API}/events`, () => ok({ items: [], meta: { page: 1, pageSize: 12, total: 0, totalPages: 0 } })), http.get(`${API}/events/recommended`, () => ok({ items: [], basedOnHistory: false })))
    const { user } = renderApp('/dashboard', { user: student })

    await user.click(await screen.findByRole('link', { name: /Seats reserved/ }))
    await waitFor(() => expect(currentPath()).toBe('/events'))
  })

  it('shows a coordinator their own metrics, and the Reports shortcut', async () => {
    server.use(http.get(`${API}/dashboard`, () => ok(dashboard({
      role: 'DEPT_COORDINATOR',
      metrics: [
        { key: 'awaitingDecision', label: 'Needs your decision', value: 3, href: '/bookings' },
        { key: 'waitingOnClub', label: 'Waiting on a club', value: 1, href: '/bookings?tab=waiting' },
        { key: 'published', label: 'Upcoming events', value: 7, href: '/events' },
        { key: 'departmentUsers', label: 'People in your department', value: 120, href: '/users' },
      ],
      schedule: { title: "Your department's next events", items: [] },
    }))))
    renderApp('/dashboard', { user: coordinator })

    expect(await screen.findByText('Needs your decision')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "Your department's next events" })).toBeInTheDocument()
    // One in the sidebar, one in the hero - both go to the same place.
    const reportLinks = screen.getAllByRole('link', { name: /Reports/ })
    expect(reportLinks).toHaveLength(2)
    expect(reportLinks.every((link) => link.getAttribute('href') === '/reports')).toBe(true)
  })

  it('never offers Reports to a student', async () => {
    server.use(http.get(`${API}/dashboard`, () => ok(dashboard())))
    renderApp('/dashboard', { user: student })

    await screen.findByText('Seats reserved')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).queryByRole('link', { name: 'Reports' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Audit trail' })).not.toBeInTheDocument()
  })

  it('says so when the dashboard cannot be loaded, without breaking the page', async () => {
    server.use(http.get(`${API}/dashboard`, () => fail(500, 'SERVER_ERROR', 'Something went wrong')))
    renderApp('/dashboard', { user: student })

    expect(await screen.findByText('Could not load your dashboard')).toBeInTheDocument()
    // The rest of the page still renders.
    expect(screen.getByRole('heading', { name: /Asha/ })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// FR21 - analytics and exports
// ---------------------------------------------------------------------------

const catalogue = {
  reports: [
    { key: 'venue-utilisation', title: 'Venue utilisation', description: 'How heavily each venue was booked.' },
    { key: 'club-activity', title: 'Club activity', description: 'What each club ran.' },
    { key: 'attendance', title: 'Student attendance', description: 'Turnout per event.' },
  ],
  formats: ['json', 'csv', 'pdf'],
}

const venueReport = {
  report: 'venue-utilisation',
  title: 'Venue utilisation',
  columns: [
    { key: 'venue', label: 'Venue' },
    { key: 'bookings', label: 'Bookings', align: 'right' },
    { key: 'utilisationPercent', label: 'Utilisation %', align: 'right' },
  ],
  rows: [
    { venue: 'Main Auditorium', bookings: 4, utilisationPercent: 12.5 },
    { venue: 'Seminar Hall A', bookings: 2, utilisationPercent: 6 },
  ],
  totals: { venues: 2, bookings: 6 },
  period: { from: '2026-08-18', to: '2026-09-16', days: 30 },
}

describe('reports (FR21)', () => {
  it('renders a report with its totals and rows', async () => {
    server.use(
      http.get(`${API}/reports`, () => ok(catalogue)),
      http.get(`${API}/reports/venue-utilisation`, () => ok(venueReport)),
    )
    renderApp('/reports', { user: coordinator })

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Utilisation %' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Main Auditorium' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '12.5' })).toBeInTheDocument()
    expect(screen.getByText('Venues')).toBeInTheDocument()
  })

  it('switches report and narrows the dates', async () => {
    const queries = []
    server.use(
      http.get(`${API}/reports`, () => ok(catalogue)),
      http.get(`${API}/reports/:report`, ({ request, params }) => {
        queries.push({ report: params.report, ...Object.fromEntries(new URL(request.url).searchParams) })
        return ok({ ...venueReport, report: params.report, rows: [], totals: {} })
      }),
    )
    const { user } = renderApp('/reports', { user: coordinator })

    await screen.findByRole('tab', { name: 'Club activity' })
    await user.click(screen.getByRole('tab', { name: 'Club activity' }))
    await waitFor(() => expect(queries.at(-1).report).toBe('club-activity'))

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } })
    await waitFor(() => expect(queries.at(-1).from).toBe('2026-09-01'))
  })

  it('says plainly when a period has nothing in it', async () => {
    server.use(
      http.get(`${API}/reports`, () => ok(catalogue)),
      http.get(`${API}/reports/venue-utilisation`, () => ok({ ...venueReport, rows: [], totals: {} })),
    )
    renderApp('/reports', { user: coordinator })
    expect(await screen.findByRole('heading', { name: 'Nothing in this period' })).toBeInTheDocument()
  })

  it('downloads a CSV export with the name the server chose', async () => {
    const clicks = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function record() { clicks.push(this.download) })
    URL.createObjectURL = vi.fn(() => 'blob:report')
    URL.revokeObjectURL = vi.fn()

    server.use(
      http.get(`${API}/reports`, () => ok(catalogue)),
      http.get(`${API}/reports/venue-utilisation`, ({ request }) => {
        if (new URL(request.url).searchParams.get('format') !== 'csv') return ok(venueReport)
        return new HttpResponse('Venue,Bookings\r\nMain Auditorium,4', {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="campusos-venue-utilisation-2026-09-16.csv"',
          },
        })
      }),
    )
    const { user } = renderApp('/reports', { user: coordinator })

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: /CSV/ }))

    await waitFor(() => expect(clicks).toEqual(['campusos-venue-utilisation-2026-09-16.csv']))
    expect(await screen.findByText('Export ready')).toBeInTheDocument()
  })

  it('reports a failed export instead of downloading nothing', async () => {
    server.use(
      http.get(`${API}/reports`, () => ok(catalogue)),
      http.get(`${API}/reports/venue-utilisation`, ({ request }) => (
        new URL(request.url).searchParams.get('format')
          ? fail(500, 'SERVER_ERROR', 'Nope')
          : ok(venueReport)
      )),
    )
    const { user } = renderApp('/reports', { user: coordinator })

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: /PDF/ }))
    expect(await screen.findByText('Export failed')).toBeInTheDocument()
  })

  it('keeps students and club heads out', async () => {
    renderApp('/reports', { user: student })
    await waitFor(() => expect(currentPath()).toBe('/forbidden'))
  })
})

// ---------------------------------------------------------------------------
// FR20 - the audit trail
// ---------------------------------------------------------------------------

const entry = (overrides = {}) => ({
  id: '42',
  action: 'ROLE_CHANGED',
  label: 'Changed a role',
  group: 'ROLES',
  subjectType: 'USER',
  subjectId: 9,
  bookingId: null,
  details: { from: 'STUDENT', to: 'CLUB_HEAD' },
  ip: '10.0.0.1',
  at: '2026-09-16T05:00:00.000Z',
  actor: { id: 2, fullName: 'Nishanti Naidu', email: 'coordinator.it@mmcoe.edu.in', role: 'DEPT_COORDINATOR' },
  ...overrides,
})

const trail = (items, meta) => ok(items, { page: 1, pageSize: 25, total: items.length, totalPages: 1, ...meta })

describe('audit trail (FR20)', () => {
  it('shows who did what, when, and from where', async () => {
    server.use(http.get(`${API}/admin/audit`, () => trail([
      entry(),
      entry({
        id: '41', action: 'USER_LOGIN', label: 'Signed in', group: 'ACCESS', details: { userAgent: 'Firefox' },
        actor: { id: 1, fullName: 'Dr. Principal', email: 'principal@mmcoe.edu.in', role: 'SUPER_ADMIN' },
      }),
    ])))
    renderApp('/admin/audit', { user: principal })

    const list = await screen.findByRole('list', { name: 'Recorded actions' })
    const roleChange = within(list).getByText('Nishanti Naidu').closest('li')
    expect(within(roleChange).getByText(/changed a role/)).toBeInTheDocument()
    expect(within(roleChange).getByText(/from: STUDENT · to: CLUB_HEAD/)).toBeInTheDocument()
    expect(within(roleChange).getByText(/10\.0\.0\.1/)).toBeInTheDocument()
    expect(within(roleChange).getByText('Roles & accounts')).toBeInTheDocument()

    const login = within(list).getByText('Dr. Principal').closest('li')
    expect(within(login).getByText(/signed in/)).toBeInTheDocument()
    expect(within(login).getByText('Sign-ins')).toBeInTheDocument()
    expect(screen.getByText('2 recorded actions')).toBeInTheDocument()
  })

  it('offers no way to change anything - the trail is append-only', async () => {
    server.use(http.get(`${API}/admin/audit`, () => trail([entry()])))
    renderApp('/admin/audit', { user: principal })

    await screen.findByText('Nishanti Naidu')
    expect(screen.queryByRole('button', { name: /delete|edit|remove/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Append-only/)).toBeInTheDocument()
  })

  it('filters by area and searches by person', async () => {
    const queries = []
    server.use(http.get(`${API}/admin/audit`, ({ request }) => {
      queries.push(Object.fromEntries(new URL(request.url).searchParams))
      return trail([entry()])
    }))
    const { user } = renderApp('/admin/audit', { user: principal })

    await screen.findByText('Nishanti Naidu')
    await user.selectOptions(screen.getByLabelText('Filter by area'), 'ACCESS')
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ group: 'ACCESS' }))

    await user.type(screen.getByLabelText('Search the trail'), 'nishanti')
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ q: 'nishanti', group: 'ACCESS' }))
  })

  it('pages through a long trail', async () => {
    const queries = []
    server.use(http.get(`${API}/admin/audit`, ({ request }) => {
      const query = Object.fromEntries(new URL(request.url).searchParams)
      queries.push(query)
      const page = Number(query.page) || 1
      return trail([entry({ id: String(page), actor: { ...entry().actor, fullName: `Actor page ${page}` } })], { page, total: 60, totalPages: 3 })
    }))
    const { user } = renderApp('/admin/audit', { user: principal })

    await screen.findByText('Actor page 1')
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(await screen.findByText('Actor page 2')).toBeInTheDocument()
    expect(queries.at(-1)).toMatchObject({ page: '2' })
  })

  it('is closed to a coordinator, let alone a student', async () => {
    const { unmount } = renderApp('/admin/audit', { user: coordinator })
    await waitFor(() => expect(currentPath()).toBe('/forbidden'))
    unmount()

    renderApp('/admin/audit', { user: head })
    await waitFor(() => expect(currentPath()).toBe('/forbidden'))
  })
})
