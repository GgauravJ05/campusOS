import { http } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderApp, currentPath } from '@/test/render'
import { API, fail, makeUser, ok, server, session, state } from '@/test/server'

const student = makeUser()

describe('route guards', () => {
  it('sends a guest to sign in, remembering where they were going', async () => {
    const { user } = renderApp('/users/7')
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    await waitFor(() => expect(currentPath()).toBe('/login'))

    server.use(http.post(`${API}/auth/login`, () => ok(session(makeUser({ role: { key: 'DEPT_COORDINATOR', name: 'C', rank: 2 } })))))
    server.use(http.get(`${API}/users/7`, () => fail(404, 'NOT_FOUND', 'User not found')))
    await user.type(screen.getByLabelText('College email'), 'c@mmcoe.edu.in')
    await user.type(screen.getByLabelText('Password'), 'Campus@123')
    await user.click(screen.getByRole('button', { name: /Sign in/ }))

    await waitFor(() => expect(currentPath()).toBe('/users/7'))
  })

  it('restores the session from the refresh cookie on reload', async () => {
    renderApp('/dashboard', { user: student })
    expect(await screen.findByRole('heading', { name: /Asha/ })).toBeInTheDocument()
  })

  it('sends a signed-in user away from the sign-in page', async () => {
    renderApp('/login', { user: student })
    await waitFor(() => expect(currentPath()).toBe('/dashboard'))
  })

  it('blocks students from faculty pages', async () => {
    renderApp('/users', { user: student })
    expect(await screen.findByRole('heading', { name: "You don't have access here" })).toBeInTheDocument()
  })

  it('shows a friendly 404', async () => {
    renderApp('/nope')
    expect(await screen.findByRole('heading', { name: 'This page wandered off' })).toBeInTheDocument()
  })
})

describe('sign in', () => {
  it('signs in and lands on the dashboard with a welcome', async () => {
    let body
    server.use(http.post(`${API}/auth/login`, async ({ request }) => {
      body = await request.json()
      return ok(session(student))
    }))
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('College email'), '  asha.kulkarni@mmcoe.edu.in ')
    await user.type(screen.getByLabelText('Password'), 'Violet-Lantern-42')
    await user.click(screen.getByRole('button', { name: /Sign in/ }))

    expect(await screen.findByText('Welcome back, Asha')).toBeInTheDocument()
    await waitFor(() => expect(currentPath()).toBe('/dashboard'))
    expect(body).toEqual({ email: 'asha.kulkarni@mmcoe.edu.in', password: 'Violet-Lantern-42' })
  })

  it('shows the server message for wrong credentials and stays put', async () => {
    server.use(http.post(`${API}/auth/login`, () => fail(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.')))
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('College email'), 'asha@mmcoe.edu.in')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /Sign in/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
    await waitFor(() => expect(currentPath()).toBe('/login'))
  })

  it('sends an unverified user to verification with a fresh code', async () => {
    let resent = false
    server.use(
      http.post(`${API}/auth/login`, () => fail(403, 'EMAIL_NOT_VERIFIED', 'Verify your email')),
      http.post(`${API}/auth/resend-verification`, () => { resent = true; return ok({ email: 'a@mmcoe.edu.in', resendAvailableInSeconds: 60 }, undefined, { status: 202 }) }),
    )
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('College email'), 'a@mmcoe.edu.in')
    await user.type(screen.getByLabelText('Password'), 'Violet-Lantern-42')
    await user.click(screen.getByRole('button', { name: /Sign in/ }))

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument()
    expect(resent).toBe(true)
    expect(screen.getByText('a@mmcoe.edu.in')).toBeInTheDocument()
  })
})

describe('registration and verification', () => {
  it('validates before calling the API, including the college domain', async () => {
    const { user } = renderApp('/register')

    await user.type(await screen.findByLabelText('College email'), 'asha@gmail.com')
    await user.click(screen.getByRole('button', { name: /Create account/ }))

    expect(screen.getByLabelText('College email')).toHaveAccessibleDescription('Use your @mmcoe.edu.in address')
    expect(screen.getByLabelText('Full name')).toHaveAccessibleDescription('Enter your full name')
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
  })

  it('registers, verifies with the emailed code, and signs the student in', async () => {
    let registered
    server.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        registered = await request.json()
        return ok({ email: registered.email, resendAvailableInSeconds: 60 }, undefined, { status: 202 })
      }),
      http.post(`${API}/auth/verify-email`, async ({ request }) => {
        const { code } = await request.json()
        if (code !== '482913') return fail(400, 'INVALID_CODE', 'That code is incorrect', [{ field: 'code', message: '4 attempt(s) left' }])
        state.sessionUser = student
        return ok(session(student))
      }),
    )
    const { user } = renderApp('/register')

    await user.type(await screen.findByLabelText('Full name'), 'Asha Kulkarni')
    await user.type(screen.getByLabelText('College email'), 'Asha.Kulkarni@mmcoe.edu.in')
    await waitFor(() => expect(screen.getByRole('option', { name: 'Information Technology' })).toBeInTheDocument())
    await user.selectOptions(screen.getByLabelText('Department'), '1')
    await user.selectOptions(screen.getByLabelText('Academic year'), '2')
    await user.type(screen.getByLabelText('Password'), 'Violet-Lantern-42')
    await user.type(screen.getByLabelText('Confirm password'), 'Violet-Lantern-42')
    await user.click(screen.getByRole('button', { name: /Create account/ }))

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument()
    expect(registered).toEqual({
      fullName: 'Asha Kulkarni', email: 'asha.kulkarni@mmcoe.edu.in', password: 'Violet-Lantern-42', departmentId: 1, academicYear: 2,
    })
    expect(screen.getByText('Resend in 60s')).toBeInTheDocument()

    // A wrong code shows attempts left and clears the boxes.
    await user.click(screen.getByLabelText('Digit 1 of 6'))
    await user.paste('111111')
    expect(await screen.findByRole('alert')).toHaveTextContent('4 attempt(s) left')
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue('')

    await user.click(screen.getByLabelText('Digit 1 of 6'))
    await user.paste('482913')
    expect(await screen.findByText("You're in, Asha!")).toBeInTheDocument()
    await waitFor(() => expect(currentPath()).toBe('/dashboard'))
  })

  it('shows server field errors from registration', async () => {
    server.use(http.post(`${API}/auth/register`, () =>
      fail(422, 'VALIDATION_ERROR', 'Choose a stronger password', [{ field: 'password', message: 'This password is too common' }])))
    const { user } = renderApp('/register')

    await user.type(await screen.findByLabelText('Full name'), 'Asha Kulkarni')
    await user.type(screen.getByLabelText('College email'), 'asha.k@mmcoe.edu.in')
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(2))
    await user.selectOptions(screen.getByLabelText('Department'), '1')
    await user.selectOptions(screen.getByLabelText('Academic year'), '1')
    await user.type(screen.getByLabelText('Password'), 'Welcome@2026')
    await user.type(screen.getByLabelText('Confirm password'), 'Welcome@2026')
    await user.click(screen.getByRole('button', { name: /Create account/ }))

    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('This password is too common'))
  })

  it('lets a visitor with no email in context type it, then resend', async () => {
    let resentFor
    server.use(http.post(`${API}/auth/resend-verification`, async ({ request }) => {
      resentFor = (await request.json()).email
      return ok({ email: resentFor, resendAvailableInSeconds: 60 }, undefined, { status: 202 })
    }))
    const { user } = renderApp('/verify-email')

    await user.type(await screen.findByLabelText('College email'), 'late@mmcoe.edu.in')
    await user.click(screen.getByRole('button', { name: 'Resend code' }))

    expect(await screen.findByText(/A new code is on its way/)).toBeInTheDocument()
    expect(resentFor).toBe('late@mmcoe.edu.in')
    expect(screen.getByText('Resend in 60s')).toBeInTheDocument()
  })
})

describe('password reset', () => {
  it('requests a code, sets a new password, and returns to sign in', async () => {
    let reset
    server.use(
      http.post(`${API}/auth/forgot-password`, () => ok({ email: 'asha@mmcoe.edu.in', resendAvailableInSeconds: 60 }, undefined, { status: 202 })),
      http.post(`${API}/auth/reset-password`, async ({ request }) => {
        reset = await request.json()
        return ok({ message: 'Password updated.' })
      }),
    )
    const { user } = renderApp('/login')

    await user.click(await screen.findByRole('link', { name: 'Forgot password?' }))
    // Wait for the new page before typing: the sign-in page's "College email" field has the same
    // label and can still be mounted for a moment, which swallowed the first letter typed.
    await screen.findByRole('heading', { name: 'Forgot your password?' })
    await user.type(await screen.findByLabelText('College email'), 'Asha@mmcoe.edu.in')
    await user.click(screen.getByRole('button', { name: 'Send reset code' }))

    expect(await screen.findByRole('heading', { name: 'Set a new password' })).toBeInTheDocument()
    const submit = screen.getByRole('button', { name: 'Update password' })
    expect(submit).toBeDisabled()

    await user.click(screen.getByLabelText('Digit 1 of 6'))
    await user.paste('246810')
    await user.type(screen.getByLabelText('New password'), 'Copper-Kettle-58')
    await user.type(screen.getByLabelText('Confirm new password'), 'Copper-Kettle-58')
    await user.click(submit)

    expect(await screen.findByText('Password updated')).toBeInTheDocument()
    await waitFor(() => expect(currentPath()).toBe('/login'))
    expect(reset).toEqual({ email: 'asha@mmcoe.edu.in', code: '246810', newPassword: 'Copper-Kettle-58' })
    expect(screen.getByLabelText('College email')).toHaveValue('asha@mmcoe.edu.in')
  })

  it('warns when the confirmation does not match', async () => {
    const { user } = renderApp('/reset-password', { state: { email: 'a@mmcoe.edu.in' } })
    await user.type(await screen.findByLabelText('New password'), 'Copper-Kettle-58')
    await user.type(screen.getByLabelText('Confirm new password'), 'Copper-Kettle-5')
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('clears the code and explains an expired one', async () => {
    server.use(http.post(`${API}/auth/reset-password`, () => fail(400, 'CODE_EXPIRED', 'That code has expired or was replaced - request a new one')))
    const { user } = renderApp('/reset-password', { state: { email: 'a@mmcoe.edu.in' } })

    await user.click(await screen.findByLabelText('Digit 1 of 6'))
    await user.paste('246810')
    await user.type(screen.getByLabelText('New password'), 'Copper-Kettle-58')
    await user.type(screen.getByLabelText('Confirm new password'), 'Copper-Kettle-58')
    await user.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('expired')
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveValue('')
  })
})
