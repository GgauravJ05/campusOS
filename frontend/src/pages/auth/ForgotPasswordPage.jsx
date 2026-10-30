import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, KeyRound, Mail } from 'lucide-react'
import { authApi } from '@/features/auth/authApi'
import { AuthHeading } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Surface'
import { useDocumentTitle } from '@/lib/hooks'

export default function ForgotPasswordPage() {
  useDocumentTitle('Forgot password')
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(location.state?.email || '')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await authApi.forgotPassword(email.trim())
      navigate('/reset-password', { state: { email: email.trim().toLowerCase(), resendIn: result.resendAvailableInSeconds } })
    } catch (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  return (
    <>
      <Link to="/login" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        <ArrowLeft className="size-4" aria-hidden /> Back to sign in
      </Link>

      <AuthHeading icon={KeyRound} title="Forgot your password?">
        Enter your college email. If it has an account, we&apos;ll send a code to reset your password.
      </AuthHeading>

      {error && <Alert tone="error" className="mb-6">{error.fieldErrors.email || error.message}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field label="College email">
          {(p) => (
            <Input {...p} type="email" icon={Mail} autoComplete="email" placeholder="you@mmcoe.edu.in" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          )}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!email.includes('@')}>
          Send reset code
        </Button>
      </form>
    </>
  )
}
