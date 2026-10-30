import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp, currentPath } from '@/test/render'
import { API, coordinator, fail, makeUser, ok, server } from '@/test/server'

const student = makeUser()
const principal = makeUser({ id: 1, fullName: 'Dr. Principal', role: { key: 'SUPER_ADMIN', name: 'Principal & HOD', rank: 1 } })
const head = makeUser({ id: 4, fullName: 'Gaurav Jadhav', role: { key: 'CLUB_HEAD', name: 'Club Head', rank: 3 } })
const member = makeUser({ id: 6, fullName: 'Aditya Patil', role: { key: 'CLUB_MEMBER', name: 'Club Member', rank: 4 } })

const permissions = (overrides = {}) => ({ canManage: false, canEdit: false, canManageMembers: false, ...overrides })

function club(overrides = {}) {
  return {
    id: 1, name: 'IT Tech Club', description: 'Software, open source and hackathons.', scope: 'DEPARTMENT',
    department: { id: 1, code: 'IT', name: 'Information Technology' }, head: { id: 4, fullName: 'Gaurav Jadhav' },
    memberCount: 2, isActive: true, myPosition: null, permissions: permissions(),
    ...overrides,
  }
}

function detail(overrides = {}) {
  return club({
    members: [
      { userId: 4, fullName: 'Gaurav Jadhav', email: 'gaurav@mmcoe.edu.in', position: 'PRESIDENT', isHead: true, role: 'CLUB_HEAD', departmentCode: 'IT', academicYear: 3 },
      { userId: 6, fullName: 'Aditya Patil', email: 'aditya@mmcoe.edu.in', position: 'TECHNICAL_LEAD', isHead: false, role: 'CLUB_MEMBER', departmentCode: 'IT', academicYear: 3 },
    ],
    ...overrides,
  })
}

describe('clubs by floor', () => {
  const dept = (id, code, name, floor) => ({ id, code, name, floor })

  it('groups clubs under their department\'s floor, with college-level clubs last, and jumps to a floor', async () => {
    const scrolled = []
    Element.prototype.scrollIntoView = function scrollIntoView() { scrolled.push(this.id) }
    server.use(http.get(`${API}/clubs`, () => ok([
      club({ id: 1, name: 'IT Tech Club', department: dept(4, 'IT', 'Information Technology', 4) }),
      club({ id: 2, name: 'EESA', department: dept(1, 'ELEC', 'Electrical Engineering', 1), head: null }),
      club({ id: 3, name: 'Team Rudra', scope: 'COLLEGE', department: null, head: null }),
      club({ id: 4, name: 'Envision Club', department: dept(4, 'IT', 'Information Technology', 4) }),
    ])))
    const { user } = renderApp('/clubs', { user: makeUser() })

    await screen.findByText('IT Tech Club')
    // Sections run 1st floor, 4th floor, then college-level.
    const headings = screen.getAllByRole('heading', { level: 2 }).filter((h) => /floor|College-level/.test(h.textContent))
    expect(headings.map((h) => h.textContent)).toEqual(['1st floor', '4th floor', 'College-level'])
    const fourth = screen.getByRole('region', { name: '4th floor' })
    expect(within(fourth).getByText('Information Technology')).toBeInTheDocument()
    expect(within(fourth).getAllByRole('link').map((a) => a.textContent)).toEqual([
      expect.stringContaining('IT Tech Club'), expect.stringContaining('Envision Club'),
    ])
    expect(within(screen.getByRole('region', { name: 'College-level' })).getByText('Team Rudra')).toBeInTheDocument()

    await user.click(within(screen.getByRole('navigation', { name: 'Jump to a floor' })).getByRole('button', { name: /4th floor/ }))
    expect(scrolled).toEqual(['floor-floor-4'])
  })

  it('shows no floor chips when there is only one group', async () => {
    server.use(http.get(`${API}/clubs`, () => ok([club({ department: { id: 4, code: 'IT', name: 'Information Technology', floor: 4 } })])))
    renderApp('/clubs', { user: makeUser() })

    await screen.findByText('IT Tech Club')
    expect(screen.queryByRole('navigation', { name: 'Jump to a floor' })).not.toBeInTheDocument()
  })
})

describe('clubs directory', () => {
  it('lists clubs with their head, size and the viewer\'s position, and filters by search and "my clubs"', async () => {
    const queries = []
    server.use(http.get(`${API}/clubs`, ({ request }) => {
      const q = Object.fromEntries(new URL(request.url).searchParams)
      queries.push(q)
      if (q.mine) return ok([])
      if (q.q) return ok([club({ id: 3, name: 'Robotics Club', scope: 'COLLEGE', department: null, head: null, memberCount: 0 })])
      return ok([club({ myPosition: 'MEMBER' }), club({ id: 2, name: 'Cultural Committee', description: null, memberCount: 5 })])
    }))
    const { user } = renderApp('/clubs', { user: student })

    const dsc = await screen.findByRole('link', { name: /IT Tech Club/ })
    expect(dsc).toHaveAttribute('href', '/clubs/1')
    expect(within(dsc).getByText('You: Member')).toBeInTheDocument()
    expect(within(dsc).getByText('Gaurav Jadhav')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: /Cultural Committee/ })).getByText('No description yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /New club/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show disabled' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Search clubs'), 'robot')
    const robotics = await screen.findByRole('link', { name: /Robotics Club/ })
    expect(within(robotics).getByText('College-level')).toBeInTheDocument()
    expect(within(robotics).getByText('No head yet')).toBeInTheDocument()
    expect(queries.at(-1)).toEqual({ q: 'robot' })

    await user.clear(screen.getByLabelText('Search clubs'))
    await user.click(screen.getByRole('button', { name: 'My clubs' }))
    expect(await screen.findByRole('heading', { name: 'You are not on a club team yet' })).toBeInTheDocument()
    expect(queries.at(-1)).toMatchObject({ mine: 'true' })
    await user.click(screen.getByRole('button', { name: 'All clubs' }))
    expect(await screen.findByRole('link', { name: /IT Tech Club/ })).toBeInTheDocument()
  })

  it('lets faculty see disabled clubs and create a club in their department', async () => {
    let created
    const queries = []
    server.use(
      http.get(`${API}/clubs`, ({ request }) => {
        const q = Object.fromEntries(new URL(request.url).searchParams)
        queries.push(q)
        return ok(q.includeInactive ? [club({ id: 9, name: 'Old Club', isActive: false })] : [])
      }),
      http.post(`${API}/clubs`, async ({ request }) => {
        created = await request.json()
        return ok(detail({ id: 12, name: created.name, members: [], memberCount: 0, head: null, permissions: permissions({ canManage: true, canEdit: true, canManageMembers: true }) }), undefined, { status: 201 })
      }),
      http.get(`${API}/clubs/12`, () => ok(detail({ id: 12, name: 'Photography Club', members: [], memberCount: 0, head: null, permissions: permissions({ canManage: true, canEdit: true, canManageMembers: true }) }))),
    )
    const { user } = renderApp('/clubs', { user: coordinator })

    expect(await screen.findByRole('heading', { name: 'No clubs found' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show disabled' }))
    expect(await screen.findByText('Disabled')).toBeInTheDocument()
    expect(queries.at(-1)).toMatchObject({ includeInactive: 'true' })

    await user.click(screen.getByRole('button', { name: /New club/ }))
    const dialog = screen.getByRole('dialog', { name: 'Create a club' })
    expect(dialog).toHaveTextContent('The club will belong to Information Technology.')
    expect(within(dialog).queryByLabelText('Department')).not.toBeInTheDocument()
    const create = within(dialog).getByRole('button', { name: 'Create club' })
    expect(create).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Name'), 'Photography Club')
    await user.type(within(dialog).getByLabelText(/Description/), 'Shoot the fest')
    await user.click(create)

    await waitFor(() => expect(currentPath()).toBe('/clubs/12'))
    expect(created).toEqual({ name: 'Photography Club', description: 'Shoot the fest' })
    const noHead = (await screen.findByText('No head appointed')).closest('[role="status"]')
    expect(within(noHead).getByRole('link', { name: 'People' })).toHaveAttribute('href', '/users')
  })

  it('lets the Principal choose a department or make the club college-level, and shows name clashes', async () => {
    const bodies = []
    server.use(
      http.get(`${API}/clubs`, () => ok([])),
      http.post(`${API}/clubs`, async ({ request }) => {
        bodies.push(await request.json())
        return fail(409, 'CLUB_NAME_TAKEN', 'A club with that name already exists')
      }),
    )
    const { user } = renderApp('/clubs', { user: principal })
    await user.click(await screen.findByRole('button', { name: /New club/ }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Student Council')
    await within(dialog).findByRole('option', { name: 'Computer Engineering' })
    await user.click(within(dialog).getByRole('button', { name: 'Create club' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('already exists')

    await user.selectOptions(within(dialog).getByLabelText('Department'), '2')
    await user.click(within(dialog).getByRole('button', { name: 'Create club' }))
    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies).toEqual([
      { name: 'Student Council', description: null, departmentId: null },
      { name: 'Student Council', description: null, departmentId: 2 },
    ])
  })

  it('shows load errors', async () => {
    server.use(http.get(`${API}/clubs`, () => fail(500, 'INTERNAL_ERROR', 'Boom')))
    renderApp('/clubs', { user: student })
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load clubs')
  })
})

describe('club page', () => {
  it('lets the club head edit details and run the team', async () => {
    let current = detail({ myPosition: 'PRESIDENT', permissions: permissions({ canEdit: true, canManageMembers: true }) })
    const calls = []
    server.use(
      http.get(`${API}/clubs/1`, () => ok(current)),
      http.patch(`${API}/clubs/1`, async ({ request }) => {
        const body = await request.json()
        calls.push(['edit', body])
        current = { ...current, ...body }
        return ok(current)
      }),
      http.post(`${API}/clubs/1/members`, async ({ request }) => {
        const body = await request.json()
        calls.push(['add', body])
        if (body.email === 'nobody@mmcoe.edu.in') return fail(404, 'NOT_FOUND', 'No active, verified account uses that email')
        current = { ...current, memberCount: 3, members: [...current.members, { userId: 8, fullName: 'Srushti Mane', email: body.email, position: body.position, isHead: false, role: 'STUDENT', departmentCode: 'IT', academicYear: 2 }] }
        return ok(current, undefined, { status: 201 })
      }),
      http.patch(`${API}/clubs/1/members/6`, async ({ request }) => {
        const body = await request.json()
        calls.push(['position', body])
        current = { ...current, members: current.members.map((m) => (m.userId === 6 ? { ...m, position: body.position } : m)) }
        return ok(current)
      }),
      http.delete(`${API}/clubs/1/members/8`, () => {
        calls.push(['remove', 8])
        current = { ...current, memberCount: 2, members: current.members.filter((m) => m.userId !== 8) }
        return ok(current)
      }),
    )
    const { user } = renderApp('/clubs/1', { user: head })

    expect(await screen.findByRole('heading', { name: 'IT Tech Club' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Disable/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave club' })).not.toBeInTheDocument()
    const team = screen.getAllByRole('listitem')
    expect(within(team[0]).getByText('President')).toBeInTheDocument()
    expect(within(team[0]).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    expect(within(team[1]).getByText(/aditya@mmcoe.edu.in/)).toBeInTheDocument()

    // Details
    await user.click(screen.getByRole('button', { name: /Edit/ }))
    const edit = screen.getByRole('dialog', { name: 'Edit IT Tech Club' })
    expect(within(edit).queryByLabelText('Department')).not.toBeInTheDocument()
    await user.clear(within(edit).getByLabelText(/Description/))
    await user.type(within(edit).getByLabelText(/Description/), 'Build things together')
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Build things together')).toBeInTheDocument()
    expect(calls[0]).toEqual(['edit', { name: 'IT Tech Club', description: 'Build things together' }])

    // Add: an unknown email, then a real one
    await user.click(screen.getByRole('button', { name: /Add member/ }))
    const add = screen.getByRole('dialog', { name: 'Add a team member' })
    await user.type(within(add).getByLabelText('College email'), 'nobody@mmcoe.edu.in')
    await user.click(within(add).getByRole('button', { name: 'Add member' }))
    expect(await within(add).findByRole('alert')).toHaveTextContent('No active, verified account')
    await user.clear(within(add).getByLabelText('College email'))
    await user.type(within(add).getByLabelText('College email'), 'srushti@mmcoe.edu.in')
    await user.selectOptions(within(add).getByLabelText('Position'), 'SECRETARY')
    await user.click(within(add).getByRole('button', { name: 'Add member' }))
    expect(await screen.findByText('Srushti Mane')).toBeInTheDocument()
    expect(calls.at(-1)).toEqual(['add', { email: 'srushti@mmcoe.edu.in', position: 'SECRETARY' }])
    expect(screen.getByText('3 people')).toBeInTheDocument()

    // Position
    await user.selectOptions(screen.getByLabelText('Position for Aditya Patil'), 'VICE_PRESIDENT')
    expect(await screen.findByText('Position updated')).toBeInTheDocument()
    expect(calls.at(-1)).toEqual(['position', { position: 'VICE_PRESIDENT' }])

    // Remove
    await user.click(screen.getByRole('button', { name: 'Remove Srushti Mane' }))
    const remove = screen.getByRole('dialog', { name: 'Remove Srushti Mane?' })
    expect(remove).toHaveTextContent(/role are not changed/)
    await user.click(within(remove).getByRole('button', { name: 'Remove from team' }))
    expect(await screen.findByText('Member removed')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).not.toContainEqual(expect.stringContaining('Srushti Mane'))
    expect(calls.at(-1)).toEqual(['remove', 8])
  })

  it('reports a failed position change without losing the page', async () => {
    server.use(
      http.get(`${API}/clubs/1`, () => ok(detail({ permissions: permissions({ canEdit: true, canManageMembers: true }) }))),
      http.patch(`${API}/clubs/1/members/6`, () => fail(409, 'CLUB_INACTIVE', 'This club is disabled')),
    )
    const { user } = renderApp('/clubs/1', { user: head })
    await user.selectOptions(await screen.findByLabelText('Position for Aditya Patil'), 'MEMBER')
    expect(await screen.findByText('Could not change the position')).toBeInTheDocument()
  })

  it('lets faculty disable and re-enable a club, and the Principal move it', async () => {
    let current = detail({ permissions: permissions({ canManage: true, canEdit: true, canManageMembers: true }) })
    const bodies = []
    server.use(
      http.get(`${API}/clubs/1`, () => ok(current)),
      http.patch(`${API}/clubs/1`, async ({ request }) => {
        const body = await request.json()
        bodies.push(body)
        current = { ...current, ...body, ...(body.isActive === false ? { permissions: permissions({ canManage: true, canEdit: true }) } : {}) }
        return ok(current)
      }),
    )
    const { user } = renderApp('/clubs/1', { user: principal })

    await user.click(await screen.findByRole('button', { name: /Disable/ }))
    const dialog = screen.getByRole('dialog', { name: 'Disable IT Tech Club?' })
    expect(dialog).toHaveTextContent(/open venue requests are withdrawn/)
    await user.click(within(dialog).getByRole('button', { name: 'Disable club' }))

    expect(await screen.findByText('This club is disabled')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add member/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Position for Aditya Patil')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Re-enable/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Re-enable club' }))
    await waitFor(() => expect(screen.queryByText('This club is disabled')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Edit/ }))
    const edit = screen.getByRole('dialog')
    await within(edit).findByRole('option', { name: 'Computer Engineering' })
    expect(within(edit).getByLabelText('Department')).toHaveValue('1')
    await user.selectOptions(within(edit).getByLabelText('Department'), '')
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(bodies.at(-1)).toMatchObject({ departmentId: null }))
    expect(bodies.slice(0, 2)).toEqual([{ isActive: false }, { isActive: true }])
  })

  it('shows a disabled-club failure inside the confirmation', async () => {
    server.use(
      http.get(`${API}/clubs/1`, () => ok(detail({ permissions: permissions({ canManage: true }) }))),
      http.patch(`${API}/clubs/1`, () => fail(403, 'FORBIDDEN', 'Only faculty can disable or re-enable a club')),
    )
    const { user } = renderApp('/clubs/1', { user: coordinator })
    await user.click(await screen.findByRole('button', { name: /Disable/ }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Disable club' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Only faculty')
  })

  it('lets a member see the team read-only and leave', async () => {
    let left = false
    server.use(
      http.get(`${API}/clubs/1`, () => ok(detail({
        myPosition: 'TECHNICAL_LEAD',
        members: detail().members.map((m) => ({ ...m, email: null })),
      }))),
      http.delete(`${API}/clubs/1/members/6`, () => { left = true; return ok(detail({ memberCount: 1, members: [detail().members[0]] })) }),
    )
    const { user } = renderApp('/clubs/1', { user: member })

    expect(await screen.findByText('Technical lead')).toBeInTheDocument()
    expect(screen.getByText('(you)')).toBeInTheDocument()
    expect(screen.queryByText(/@mmcoe.edu.in/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Leave club' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Leave IT Tech Club?' })).getByRole('button', { name: 'Leave club' }))
    expect(await screen.findByText('You left the club')).toBeInTheDocument()
    expect(left).toBe(true)
    expect(screen.queryByRole('button', { name: 'Leave club' })).not.toBeInTheDocument()
  })

  it('shows an empty team and a missing club', async () => {
    server.use(http.get(`${API}/clubs/2`, () => ok(detail({ id: 2, members: [], memberCount: 0, head: null, department: null, scope: 'COLLEGE' }))))
    const { unmount } = renderApp('/clubs/2', { user: student })
    expect(await screen.findByRole('heading', { name: 'No team members yet' })).toBeInTheDocument()
    expect(screen.getByText('Principal / HOD')).toBeInTheDocument()
    expect(screen.queryByText('No head appointed')).not.toBeInTheDocument()
    unmount()

    server.use(http.get(`${API}/clubs/99`, () => HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Club not found' } }, { status: 404 })))
    renderApp('/clubs/99', { user: student })
    expect(await screen.findByRole('alert')).toHaveTextContent('Club not found')
  })
})
