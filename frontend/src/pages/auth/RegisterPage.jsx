import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, GraduationCap } from 'lucide-react'
import { authApi } from '@/features/auth/authApi'
import { AuthHeading } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Field, Input, PasswordInput, PasswordStrength, Select } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Surface'
import { ACADEMIC_YEARS } from '@/lib/utils'
import { passwordChecks } from '@/lib/password'
import { useDocumentTitle } from '@/lib/hooks'

const COLLEGE_DOMAIN = 'mmcoe.edu.in'

const EMPTY = { fullName: '', email: '', departmentId: '', academicYear: '', password: '', confirmPassword: '' }

function validate(form) {
  const errors = {}
  if (form.fullName.trim().length < 2) errors.fullName = 'Enter your full name'
  if (!/^[^\s@]+@[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address'
  else if (!form.email.trim().toLowerCase().endsWith(`@${COLLEGE_DOMAIN}`)) errors.email = `Use your @${COLLEGE_DOMAIN} address`
  if (!form.departmentId) errors.departmentId = 'Choose your department'
  if (!form.academicYear) errors.academicYear = 'Choose your year'
  if (!passwordChecks(form.password, { email: form.email, fullName: form.fullName }).every((c) => c.ok)) {
    errors.password = 'Meet every password requirement below'
  }
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match'
  return errors
}

export default function RegisterPage() {
  useDocumentTitle('Create account')
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [departments, setDepartments] = useState([])
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState(false)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    authApi.departments()
      .then(setDepartments)
      .catch(() => setFormError('Could not load departments. Refresh the page to try again.'))
  }, [])

  const update = (key) => (event) => {
    const next = { ...form, [key]: event.target.value }
    setForm(next)
    if (touched) setErrors(validate(next))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    setFormError(null)
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      const email = form.email.trim().toLowerCase()
      const result = await authApi.register({
        fullName: form.fullName.trim(),
        email,
        password: form.password,
        departmentId: Number(form.departmentId),
        academicYear: Number(form.academicYear),
      })
      navigate('/verify-email', { state: { email, resendIn: result.resendAvailableInSeconds } })
    } catch (err) {
      const fields = err.fieldErrors
      if (Object.keys(fields).length) setErrors(fields)
      else setFormError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <>
      <AuthHeading icon={GraduationCap} title="Create your account">
        For MMCOE students. We&apos;ll email you a code to confirm it&apos;s really you.
      </AuthHeading>

      {formError && <Alert tone="error" className="mb-6">{formError}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Field label="Full name" error={errors.fullName}>
          {(p) => <Input {...p} autoComplete="name" placeholder="Asha Kulkarni" value={form.fullName} onChange={update('fullName')} error={errors.fullName} autoFocus />}
        </Field>

        <Field label="College email" error={errors.email} hint={`Must end with @${COLLEGE_DOMAIN}`}>
          {(p) => <Input {...p} type="email" autoComplete="email" placeholder={`firstname.lastname@${COLLEGE_DOMAIN}`} value={form.email} onChange={update('email')} error={errors.email} />}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Department" error={errors.departmentId}>
            {(p) => (
              <Select {...p} value={form.departmentId} onChange={update('departmentId')} error={errors.departmentId}>
                <option value="" disabled>Select</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Academic year" error={errors.academicYear}>
            {(p) => (
              <Select {...p} value={form.academicYear} onChange={update('academicYear')} error={errors.academicYear}>
                <option value="" disabled>Select</option>
                {ACADEMIC_YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Password" error={errors.password}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" placeholder="Create a strong password" value={form.password} onChange={update('password')} error={errors.password} />}
        </Field>
        <PasswordStrength password={form.password} email={form.email} fullName={form.fullName} />

        <Field label="Confirm password" error={errors.confirmPassword}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" placeholder="Type it again" value={form.confirmPassword} onChange={update('confirmPassword')} error={errors.confirmPassword} />}
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Create account {!submitting && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">Sign in</Link>
      </p>
    </>
  )
}
