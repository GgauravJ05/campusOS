import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { authApi } from '@/features/auth/authApi'
import { AuthHeading } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input, PasswordInput, PasswordStrength } from '@/components/ui/Field'
import { OtpInput } from '@/components/ui/OtpInput'
import { Alert } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { passwordChecks } from '@/lib/password'
import { useCountdown, useDocumentTitle } from '@/lib/hooks'

export default function ResetPasswordPage() {
  useDocumentTitle('Reset password')
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  const initialEmail = location.state?.email || ''
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [resendIn, restartCountdown] = useCountdown(location.state?.resendIn ?? 0)

  const policyOk = passwordChecks(password, { email }).every((c) => c.ok)
  const mismatch = confirm.length > 0 && confirm !== password
  const canSubmit = email && code.length === 6 && policyOk && confirm === password

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      await authApi.resetPassword(email.trim(), code, password)
      toast.success('Password updated', 'Every device was signed out. Sign in with your new password.')
      navigate('/login', { replace: true, state: { email: email.trim() } })
    } catch (err) {
      setError(err)
      if (['INVALID_CODE', 'CODE_EXPIRED', 'CODE_ATTEMPTS_EXCEEDED'].includes(err.code)) setCode('')
      setSubmitting(false)
    }
  }

  async function resend() {
    const result = await authApi.forgotPassword(email.trim()).catch(() => null)
    if (result) {
      toast.info('New code sent', 'Check your inbox and spam folder.')
      restartCountdown(result.resendAvailableInSeconds || 60)
    }
  }

  return (
    <>
      <Link to="/forgot-password" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        <ArrowLeft className="size-4" aria-hidden /> Use a different email
      </Link>

      <AuthHeading icon={LockKeyhole} title="Set a new password">
        {initialEmail ? (
          <>If <span className="font-medium text-zinc-900 dark:text-zinc-100">{initialEmail}</span> has an account, a 6-digit code is on its way.</>
        ) : (
          'Enter your email, the code we sent, and your new password.'
        )}
      </AuthHeading>

      {error && (
        <Alert tone="error" className="mb-6" title={error.message}>
          {error.code === 'INVALID_CODE' ? error.fieldErrors.code : null}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {!initialEmail && (
          <Field label="College email">
            {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Reset code</span>
            {resendIn > 0 ? (
              <span className="text-zinc-500 tabular-nums">Resend in {resendIn}s</span>
            ) : (
              <button type="button" onClick={resend} disabled={!email} className="font-medium text-brand-600 disabled:opacity-50 dark:text-brand-400">Resend code</button>
            )}
          </div>
          <OtpInput value={code} onChange={setCode} label="Reset code" autoFocus={Boolean(initialEmail)} error={['INVALID_CODE', 'CODE_EXPIRED'].includes(error?.code)} />
        </div>

        <Field label="New password" error={error?.fieldErrors.password}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a strong password" />}
        </Field>
        <PasswordStrength password={password} email={email} />

        <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : null}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch} placeholder="Type it again" />}
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!canSubmit}>
          Update password
        </Button>
      </form>
    </>
  )
}
