import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Mail, Sparkles } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { authApi } from '@/features/auth/authApi'
import { AuthHeading } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input, PasswordInput } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { firstName } from '@/lib/utils'
import { useDocumentTitle } from '@/lib/hooks'

/** Seeded development accounts (db/seed.sql). Never rendered in a production build. */
const DEMO_ACCOUNTS = [
  { label: 'Principal', email: 'gaurav.principal@mmcoe.edu.in' },
  { label: 'Coordinator', email: 'gaurav.coordinator.it@mmcoe.edu.in' },
  { label: 'Club head', email: 'gaurav.head.ittech@mmcoe.edu.in' },
  { label: 'Student', email: 'gaurav.student.a@mmcoe.edu.in' },
]

export default function LoginPage() {
  useDocumentTitle('Sign in')
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const user = await login(email.trim(), password)
      toast.success(`Welcome back, ${firstName(user.fullName)}`)
      navigate(location.state?.from || '/dashboard', { replace: true })
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        const sent = await authApi.resendVerification(email.trim()).catch(() => null)
        navigate('/verify-email', { state: { email: email.trim(), resendIn: sent?.resendAvailableInSeconds } })
        return
      }
      setError(err)
      setSubmitting(false)
    }
  }

  const fieldErrors = error?.fieldErrors || {}

  return (
    <>
      <AuthHeading title="Welcome back">Sign in with your college email to continue.</AuthHeading>

      {location.state?.notice && <Alert tone="success" className="mb-6">{location.state.notice}</Alert>}
      {error && !Object.keys(fieldErrors).length && (
        <Alert tone="error" className="mb-6">{error.message}</Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field label="College email" error={fieldErrors.email}>
          {(props) => (
            <Input
              {...props}
              type="email"
              icon={Mail}
              autoComplete="email"
              placeholder="you@mmcoe.edu.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              required
              autoFocus
            />
          )}
        </Field>

        <Field
          label="Password"
          error={fieldErrors.password}
          labelAction={
            <Link to="/forgot-password" state={{ email }} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Forgot password?
            </Link>
          }
        >
          {(props) => (
            <PasswordInput
              {...props}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              required
            />
          )}
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!email || !password}>
          Sign in {!submitting && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        New to CampusOS?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Create your student account
        </Link>
      </p>

      {import.meta.env.DEV && (
        <div className="mt-10 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            <Sparkles className="size-3.5" aria-hidden /> Demo accounts · password Campus@123
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email)
                  setPassword('Campus@123')
                }}
                className="rounded-lg bg-zinc-100 px-3 py-2 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-brand-500/10"
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
