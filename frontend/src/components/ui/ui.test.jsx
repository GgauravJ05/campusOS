import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OtpInput } from './OtpInput'
import { Dialog } from './Dialog'
import { Field, Input, PasswordInput, PasswordStrength } from './Field'
import { Button } from './Button'
import { Alert, Avatar, Badge, EmptyState } from './Surface'

function OtpHarness({ onComplete }) {
  const [value, setValue] = useState('')
  return (
    <>
      <OtpInput value={value} onChange={setValue} onComplete={onComplete} />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('OtpInput', () => {
  const boxes = () => screen.getAllByRole('textbox')

  it('advances focus as digits are typed and completes at six', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<OtpHarness onComplete={onComplete} />)

    await user.click(boxes()[0])
    await user.keyboard('123456')

    expect(screen.getByTestId('value')).toHaveTextContent('123456')
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('ignores non-digits', async () => {
    const user = userEvent.setup()
    render(<OtpHarness />)
    await user.click(boxes()[0])
    await user.keyboard('a1b2')
    expect(screen.getByTestId('value')).toHaveTextContent('12')
  })

  it('fills every box from a pasted code, even with spaces', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<OtpHarness onComplete={onComplete} />)

    await user.click(boxes()[0])
    await user.paste('654 321')

    expect(onComplete).toHaveBeenCalledWith('654321')
    expect(boxes().map((b) => b.value)).toEqual(['6', '5', '4', '3', '2', '1'])
  })

  it('deletes backwards with Backspace', async () => {
    const user = userEvent.setup()
    render(<OtpHarness />)
    await user.click(boxes()[0])
    await user.keyboard('123')
    await user.keyboard('{Backspace}{Backspace}')
    expect(screen.getByTestId('value')).toHaveTextContent('1')
    expect(boxes()[1]).toHaveFocus()
  })

  it('labels each box for screen readers', () => {
    render(<OtpHarness />)
    expect(screen.getByRole('group', { name: 'Verification code' })).toBeInTheDocument()
    expect(screen.getByLabelText('Digit 1 of 6')).toHaveAttribute('autocomplete', 'one-time-code')
  })
})

describe('Dialog', () => {
  it('moves focus inside, closes on Escape, and returns focus to the opener', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Confirm" footer={<button type="button">OK</button>}>
            <input aria-label="Reason" />
          </Dialog>
        </>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog', { name: 'Confirm' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()

    // Typing must not bounce focus back to the first control.
    await user.click(screen.getByLabelText('Reason'))
    await user.keyboard('abc')
    expect(screen.getByLabelText('Reason')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(
      <Dialog open onClose={() => {}} title="Trap" footer={<button type="button">Last</button>}>
        <span>Body</span>
      </Dialog>,
    )
    screen.getByRole('button', { name: 'Last' }).focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('cannot be dismissed while busy', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Dialog open busy onClose={onClose} title="Saving" />)
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeDisabled()
  })
})

describe('form fields', () => {
  it('wires label, error and aria attributes together', () => {
    render(<Field label="Email" error="Enter a valid email">{(p) => <Input {...p} />}</Field>)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Enter a valid email')
  })

  it('shows a hint when there is no error', () => {
    render(<Field label="Email" hint="Use your college address" optional>{(p) => <Input {...p} />}</Field>)
    expect(screen.getByLabelText(/Email/)).toHaveAccessibleDescription('Use your college address')
    expect(screen.getByText('(optional)')).toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    render(<Field label="Password">{(p) => <PasswordInput {...p} />}</Field>)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('announces which password rules are met', () => {
    render(<PasswordStrength password="Violet-Lantern-42" />)
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(screen.getAllByText('(met)')).toHaveLength(3)
  })
})

describe('primitives', () => {
  it('disables a loading button and marks it busy', () => {
    render(<Button loading>Save</Button>)
    const button = screen.getByRole('button', { name: /Save/ })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('renders alerts with the right live role', () => {
    render(<><Alert tone="error">Broken</Alert><Alert tone="success" title="Done" /></>)
    expect(screen.getByRole('alert')).toHaveTextContent('Broken')
    expect(screen.getByRole('status')).toHaveTextContent('Done')
  })

  it('renders avatar initials or an image', () => {
    const { container, rerender } = render(<Avatar name="Asha Kulkarni" />)
    expect(container).toHaveTextContent('AK')
    rerender(<Avatar name="Asha" src="/a.png" />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/a.png')
  })

  it('renders badges and empty states', () => {
    render(<><Badge tone="emerald" dot>Active</Badge><EmptyState title="Nothing here" description="Try later" action={<button type="button">Retry</button>} /></>)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
