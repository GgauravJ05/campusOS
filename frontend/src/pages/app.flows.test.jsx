import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp, currentPath } from '@/test/render'
import { API, coordinator, departments, fail, makeUser, ok, server, session, state } from '@/test/server'

const principal = makeUser({ id: 1, fullName: 'Dr. Principal MMCOE', email: 'principal@mmcoe.edu.in', role: { key: 'SUPER_ADMIN', name: 'Principal & HOD', rank: 1 } })

const clubHead = makeUser({
  role: { key: 'CLUB_HEAD', name: 'Club Head / President', rank: 3 },
  clubs: [
    { id: 1, name: 'Developer Student Club', scope: 'DEPARTMENT', departmentCode: 'IT', isHead: true, position: 'PRESIDENT' },
    { id: 3, name: 'Robotics Club', scope: 'COLLEGE', departmentCode: null, isHead: false, position: 'TECHNICAL_LEAD' },
  ],
})

describe('dashboard and shell', () => {
  it('greets the user and lists their clubs with scope', async () => {
    renderApp('/dashboard', { user: clubHead })

    expect(await screen.findByRole('heading', { name: /Asha/ })).toBeInTheDocument()
    expect(screen.getByText('Developer Student Club')).toBeInTheDocument()
    expect(screen.getByText('You lead 1 club.')).toBeInTheDocument()
    expect(screen.getByText('College-wide')).toBeInTheDocument()
    expect(screen.getByText('technical lead')).toBeInTheDocument()
  })

  it('shows People in the navigation for faculty only', async () => {
    const { unmount } = renderApp('/dashboard', { user: makeUser() })
    const nav = await screen.findAllByRole('navigation', { name: 'Main' })
    expect(within(nav[0]).queryByRole('link', { name: /People/ })).not.toBeInTheDocument()
    unmount()

    renderApp('/dashboard', { user: coordinator })
    const facultyNav = await screen.findAllByRole('navigation', { name: 'Main' })
    expect(within(facultyNav[0]).getByRole('link', { name: /People/ })).toBeInTheDocument()
  })

  it('opens the mobile drawer', async () => {
    const { user } = renderApp('/dashboard', { user: makeUser() })
    await user.click(await screen.findByRole('button', { name: 'Open navigation' }))
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close navigation' }))
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
  })

  it('signs out from the user menu', async () => {
    const { user } = renderApp('/dashboard', { user: makeUser() })
    const menus = await screen.findAllByRole('button', { name: /Asha Kulkarni/ })
    await user.click(menus[0])
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    await waitFor(() => expect(currentPath()).toBe('/login'))
    expect(screen.getByText('Signed out')).toBeInTheDocument()
  })

  it('cycles the theme and remembers it', async () => {
    const { user } = renderApp('/dashboard', { user: makeUser() })
    await user.click(await screen.findByRole('button', { name: /System theme/ }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('campusos-theme')).toBe('light')
    await user.click(screen.getByRole('button', { name: /Light theme/ }))
    expect(document.documentElement).toHaveClass('dark')
  })

  it('describes upcoming modules honestly instead of showing fake data', async () => {
    renderApp('/venues', { user: makeUser() })
    expect(await screen.findByRole('heading', { name: 'Venues is on its way' })).toBeInTheDocument()
    expect(screen.getByText(/Phase 2/)).toBeInTheDocument()
  })
})

describe('profile and security', () => {
  it('saves profile changes', async () => {
    let sent
    server.use(http.patch(`${API}/users/me`, async ({ request }) => {
      sent = await request.json()
      return ok({ ...makeUser(), ...sent })
    }))
    const { user } = renderApp('/profile', { user: makeUser() })

    const save = await screen.findByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    await user.clear(screen.getByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), 'Asha K')
    await user.type(screen.getByLabelText(/Phone/), '+91 98765 43210')
    await user.click(save)

    expect(await screen.findByText('Profile saved')).toBeInTheDocument()
    expect(sent).toEqual({ fullName: 'Asha K', phone: '+91 98765 43210', academicYear: 2 })
  })

  it('reports a wrong current password on the field', async () => {
    server.use(http.post(`${API}/auth/change-password`, () =>
      fail(422, 'VALIDATION_ERROR', 'Your current password is incorrect', [{ field: 'currentPassword', message: 'Incorrect password' }])))
    const { user } = renderApp('/profile', { user: makeUser() })

    await user.type(await screen.findByLabelText('Current password'), 'nope')
    await user.type(screen.getByLabelText('New password'), 'Copper-Kettle-58')
    await user.type(screen.getByLabelText('Confirm new password'), 'Copper-Kettle-58')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    await waitFor(() => expect(screen.getByLabelText('Current password')).toHaveAccessibleDescription('Incorrect password'))
  })

  it('changes the password and keeps the user signed in', async () => {
    server.use(http.post(`${API}/auth/change-password`, () => ok(session(makeUser()))))
    const { user } = renderApp('/profile', { user: makeUser() })

    await user.type(await screen.findByLabelText('Current password'), 'Violet-Lantern-42')
    await user.type(screen.getByLabelText('New password'), 'Copper-Kettle-58')
    await user.type(screen.getByLabelText('Confirm new password'), 'Copper-Kettle-58')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('Password changed')).toBeInTheDocument()
    expect(currentPath()).toBe('/profile')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
  })

  it('signs out of every device after confirmation', async () => {
    let called = false
    server.use(http.post(`${API}/auth/logout-all`, () => { called = true; return new HttpResponse(null, { status: 204 }) }))
    const { user } = renderApp('/profile', { user: makeUser() })

    await user.click(await screen.findByRole('button', { name: /Sign out of all devices/ }))
    const dialog = screen.getByRole('dialog', { name: 'Sign out of all devices?' })
    await user.click(within(dialog).getByRole('button', { name: 'Sign out everywhere' }))

    await waitFor(() => expect(currentPath()).toBe('/login'))
    expect(called).toBe(true)
  })
})

describe('people management', () => {
  const people = [
    makeUser({ id: 21, fullName: 'Srushti Mane', email: 'srushti.mane@mmcoe.edu.in' }),
    makeUser({ id: 22, fullName: 'Omkar Shinde', email: 'omkar.shinde@mmcoe.edu.in', isVerified: false, lastLoginAt: null }),
  ]

  it('lists people with filters that reach the API', async () => {
    const queries = []
    server.use(http.get(`${API}/users`, ({ request }) => {
      const params = new URL(request.url).searchParams
      queries.push(Object.fromEntries(params))
      const items = params.get('status') === 'unverified' ? [people[1]] : people
      return ok(items, { page: 1, pageSize: 20, total: items.length, totalPages: 1 })
    }))
    const { user } = renderApp('/users', { user: coordinator })

    expect((await screen.findAllByText('Srushti Mane')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unverified').length).toBeGreaterThan(0)
    expect(screen.getByText('1–2 of 2')).toBeInTheDocument()
    // Coordinators get no department filter; the API scopes them.
    expect(screen.queryByLabelText('Filter by department')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'unverified')
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ status: 'unverified', pageSize: '20' }))
    await waitFor(() => expect(screen.queryAllByText('Srushti Mane')).toHaveLength(0))

    await user.type(screen.getByLabelText('Search people'), 'omkar')
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ q: 'omkar', status: 'unverified' }))
  })

  it('offers the department filter to the principal', async () => {
    server.use(http.get(`${API}/users`, () => ok([], { page: 1, pageSize: 20, total: 0, totalPages: 0 })))
    renderApp('/users', { user: principal })
    const select = await screen.findByLabelText('Filter by department')
    await waitFor(() => expect(within(select).getByRole('option', { name: departments[1].code })).toBeInTheDocument())
    expect(await screen.findByRole('heading', { name: 'No people yet' })).toBeInTheDocument()
  })

  it('shows an empty state with a way out when filters match nobody', async () => {
    server.use(http.get(`${API}/users`, () => ok([], { page: 1, pageSize: 20, total: 0, totalPages: 0 })))
    const { user } = renderApp('/users?role=CLUB_HEAD', { user: coordinator })
    expect(await screen.findByRole('heading', { name: 'Nobody matches those filters' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByRole('heading', { name: 'No people yet' })).toBeInTheDocument()
  })

  it('paginates', async () => {
    server.use(http.get(`${API}/users`, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page') || 1)
      return ok([makeUser({ id: 30 + page, fullName: `Person ${page}` })], { page, pageSize: 20, total: 25, totalPages: 2 })
    }))
    const { user } = renderApp('/users', { user: coordinator })

    expect((await screen.findAllByText('Person 1')).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect((await screen.findAllByText('Person 2')).length).toBeGreaterThan(0)
    expect(screen.getByText('21–25 of 25')).toBeInTheDocument()
  })

  it('reports a failed load', async () => {
    server.use(http.get(`${API}/users`, () => fail(500, 'INTERNAL_ERROR', 'An unexpected error occurred')))
    renderApp('/users', { user: coordinator })
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load people')
  })

  describe('person detail', () => {
    const target = makeUser({ id: 21, fullName: 'Srushti Mane', email: 'srushti.mane@mmcoe.edu.in' })
    const withPermissions = (user) => ({ ...user, permissions: { canManage: true, assignableRoles: ['CLUB_HEAD', 'CLUB_MEMBER', 'STUDENT'] } })
    const clubs = [
      { id: 1, name: 'Developer Student Club', scope: 'DEPARTMENT', department: departments[0], head: { id: 4, fullName: 'Gaurav Jadhav' }, memberCount: 3 },
      { id: 9, name: 'Nature Club', scope: 'COLLEGE', department: null, head: null, memberCount: 0 },
    ]

    it('promotes a student to club head, warning about the replaced head', async () => {
      let change
      server.use(
        http.get(`${API}/users/21`, () => ok(withPermissions(target))),
        http.get(`${API}/directory/clubs`, () => ok(clubs)),
        http.patch(`${API}/users/21/role`, async ({ request }) => {
          change = await request.json()
          return ok(withPermissions({
            ...target,
            role: { key: 'CLUB_HEAD', name: 'Club Head / President', rank: 3 },
            clubs: [{ id: 1, name: 'Developer Student Club', scope: 'DEPARTMENT', isHead: true, position: 'PRESIDENT' }],
          }))
        }),
      )
      const { user } = renderApp('/users/21', { user: coordinator })

      await user.click(await screen.findByRole('button', { name: 'Change role' }))
      const dialog = screen.getByRole('dialog', { name: 'Change role' })
      const save = within(dialog).getByRole('button', { name: 'Save role' })
      expect(save).toBeDisabled()

      await user.click(within(dialog).getByRole('radio', { name: /Club Head/ }))
      expect(save).toBeDisabled()
      const clubSelect = within(dialog).getByLabelText('Club')
      await waitFor(() => expect(within(clubSelect).getAllByRole('option')).toHaveLength(3))
      await user.selectOptions(clubSelect, '1')
      expect(within(dialog).getByText('Replaces Gaurav Jadhav')).toBeInTheDocument()

      await user.click(save)

      expect(await screen.findByText('Role updated')).toBeInTheDocument()
      expect(change).toEqual({ role: 'CLUB_HEAD', clubId: 1 })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getAllByText('Club Head').length).toBeGreaterThan(0)
    })

    it('explains college-wide authority for a college-level club', async () => {
      server.use(
        http.get(`${API}/users/21`, () => ok(withPermissions(target))),
        http.get(`${API}/directory/clubs`, () => ok(clubs)),
      )
      const { user } = renderApp('/users/21', { user: coordinator })

      await user.click(await screen.findByRole('button', { name: 'Change role' }))
      const dialog = screen.getByRole('dialog')
      await user.click(within(dialog).getByRole('radio', { name: /Club Head/ }))
      const clubSelect = within(dialog).getByLabelText('Club')
      await waitFor(() => expect(within(clubSelect).getAllByRole('option')).toHaveLength(3))
      await user.selectOptions(clubSelect, '9')

      expect(within(dialog).getByText(/its head acts for the whole college/)).toBeInTheDocument()
    })

    it('shows an API refusal inside the dialog', async () => {
      server.use(
        http.get(`${API}/users/21`, () => ok(withPermissions(target))),
        http.get(`${API}/directory/clubs`, () => ok(clubs)),
        http.patch(`${API}/users/21/role`, () => fail(403, 'CLUB_OUT_OF_SCOPE', 'That club belongs to another department')),
      )
      const { user } = renderApp('/users/21', { user: coordinator })

      await user.click(await screen.findByRole('button', { name: 'Change role' }))
      const dialog = screen.getByRole('dialog')
      await user.click(within(dialog).getByRole('radio', { name: /Club Member/ }))
      await waitFor(() => expect(within(within(dialog).getByLabelText('Club')).getAllByRole('option')).toHaveLength(3))
      await user.selectOptions(within(dialog).getByLabelText('Club'), '1')
      await user.click(within(dialog).getByRole('button', { name: 'Save role' }))

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('another department')
    })

    it('deactivates after confirmation', async () => {
      let sent
      server.use(
        http.get(`${API}/users/21`, () => ok(withPermissions(target))),
        http.patch(`${API}/users/21/status`, async ({ request }) => {
          sent = await request.json()
          return ok(withPermissions({ ...target, isActive: false }))
        }),
      )
      const { user } = renderApp('/users/21', { user: coordinator })

      await user.click(await screen.findByRole('button', { name: 'Deactivate' }))
      const dialog = screen.getByRole('dialog', { name: 'Deactivate Srushti Mane?' })
      await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

      expect(await screen.findByText('Account deactivated')).toBeInTheDocument()
      expect(sent).toEqual({ isActive: false })
      expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument()
    })

    it('is view-only when the viewer cannot manage the person', async () => {
      server.use(http.get(`${API}/users/2`, () => ok({ ...coordinator, permissions: { canManage: false, assignableRoles: [] } })))
      renderApp('/users/2', { user: principal })
      expect(await screen.findByText('View only')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Change role' })).not.toBeInTheDocument()
    })

    it('explains a person outside the department', async () => {
      server.use(http.get(`${API}/users/99`, () => fail(404, 'NOT_FOUND', 'User not found')))
      renderApp('/users/99', { user: coordinator })
      expect(await screen.findByRole('heading', { name: 'Person not found' })).toBeInTheDocument()
    })
  })
})

it('keeps state.sessionUser isolated between tests', () => {
  expect(state.sessionUser).toBeNull()
})
