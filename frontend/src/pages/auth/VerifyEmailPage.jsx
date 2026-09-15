import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { authApi } from '@/features/auth/authApi'
import { AuthHeading } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { OtpInput } from '@/components/ui/OtpInput'
import { Alert } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { firstName } from '@/lib/utils'
import { useCountdown, useDocumentTitle } from '@/lib/hooks'

export default function VerifyEmailPage() {
  useDocumentTitle('Verify email')
  const location = useLocation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { verifyEmail } = useAuth()
  const toast = useToast()

  const initialEmail = location.state?.email || params.get('email') || ''
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [resendIn, restartCountdown] = useCountdown(location.state?.resendIn ?? (initialEmail ? 60 : 0))
  const [resent, setResent] = useState(false)

  async function submit(fullCode = code) {
    if (fullCode.length !== 6 || !email || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const user = await verifyEmail(email.trim(), fullCode)
      toast.success(`You're in, ${firstName(user.fullName)}!`, 'Your email is verified.')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err)
      setCode('')
      setSubmitting(false)
    }
  }

  async function resend() {
    setError(null)
    const result = await authApi.resendVerification(email.trim()).catch((err) => {
      setError(err)
      return null
    })
    if (result) {
      setResent(true)
      restartCountdown(result.resendAvailableInSeconds || 60)
    }
  }

  const attemptsHint = error?.code === 'INVALID_CODE' ? error.fieldErrors.code : null

  return (
    <>
      <AuthHeading icon={MailCheck} title="Check your inbox">
        {initialEmail ? (
          <>We sent a 6-digit code to <span className="font-medium text-zinc-900 dark:text-zinc-100">{initialEmail}</span>. It expires in 10 minutes.</>
        ) : (
          'Enter your college email and the 6-digit code we sent you.'
        )}
      </AuthHeading>

      {error && (
        <Alert tone="error" className="mb-6" title={error.message}>
          {attemptsHint}
        </Alert>
      )}
      {resent && !error && <Alert tone="success" className="mb-6">A new code is on its way. Check spam if you don&apos;t see it.</Alert>}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {!initialEmail && (
          <Field label="College email">
            {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mmcoe.edu.in" />}
          </Field>
        )}

        <OtpInput value={code} onChange={setCode} onComplete={submit} disabled={submitting} error={Boolean(error)} autoFocus={Boolean(initialEmail)} />

        <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={code.length !== 6 || !email}>
          Verify and continue
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-zinc-500 dark:text-zinc-400">Didn&apos;t get it?</span>
        {resendIn > 0 ? (
          <span className="text-zinc-500 tabular-nums">Resend in {resendIn}s</span>
        ) : (
          <button type="button" onClick={resend} disabled={!email} className="font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 dark:text-brand-400">
            Resend code
          </button>
        )}
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Wrong email? <Link to="/register" className="font-semibold text-brand-600 dark:text-brand-400">Start again</Link>
      </p>
    </>
  )
}
