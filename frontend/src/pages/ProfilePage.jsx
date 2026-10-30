import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { usersApi } from '@/features/users/usersApi'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, PasswordInput, PasswordStrength, Select } from '@/components/ui/Field'
import { Alert, Avatar, Card, CardHeader } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { RoleBadge } from '@/components/RoleBadge'
import { ACADEMIC_YEARS, formatDateTime } from '@/lib/utils'
import { passwordChecks } from '@/lib/password'
import { useDocumentTitle } from '@/lib/hooks'

function ReadOnlyRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-6">
      <dt className="w-36 shrink-0 text-sm text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  )
}

function PersonalInfo() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    fullName: user.fullName,
    phone: user.phone || '',
    academicYear: user.academicYear ? String(user.academicYear) : '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const dirty = form.fullName !== user.fullName
    || form.phone !== (user.phone || '')
    || form.academicYear !== (user.academicYear ? String(user.academicYear) : '')

  async function handleSubmit(event) {
    event.preventDefault()
    setErrors({})
    setSaving(true)
    try {
      const updated = await usersApi.updateMe({
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || null,
        ...(form.academicYear ? { academicYear: Number(form.academicYear) } : {}),
      })
      setUser(updated)
      toast.success('Profile saved')
    } catch (err) {
      setErrors(err.fieldErrors)
      if (!Object.keys(err.fieldErrors).length) toast.error('Could not save your profile', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Personal information" description="Your name and contact details as clubs and faculty see them." />
      <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar name={form.fullName || user.fullName} src={user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.fullName}</p>
            <div className="mt-1"><RoleBadge role={user.role} /></div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" error={errors.fullName} className="sm:col-span-2">
            {(p) => <Input {...p} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} autoComplete="name" error={errors.fullName} />}
          </Field>
          <Field label="Phone" optional error={errors.phone}>
            {(p) => <Input {...p} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" autoComplete="tel" error={errors.phone} />}
          </Field>
          <Field label="Academic year" optional error={errors.academicYear}>
            {(p) => (
              <Select {...p} value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })}>
                <option value="">Not a student</option>
                {ACADEMIC_YEARS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
              </Select>
            )}
          </Field>
        </div>

        <dl className="divide-y divide-zinc-100 rounded-xl border border-zinc-100 px-4 dark:divide-zinc-800 dark:border-zinc-800">
          <ReadOnlyRow label="Email">{user.email}</ReadOnlyRow>
          <ReadOnlyRow label="Department">{user.department?.name ?? '—'}</ReadOnlyRow>
          <ReadOnlyRow label="Member since">{formatDateTime(user.createdAt)}</ReadOnlyRow>
        </dl>
        <p className="-mt-3 text-xs text-zinc-500">Email, department and role are managed by your department coordinator.</p>

        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!dirty || !form.fullName.trim()}>Save changes</Button>
        </div>
      </form>
    </Card>
  )
}

function ChangePassword() {
  const { user, changePassword } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const policyOk = passwordChecks(form.next, { email: user.email, fullName: user.fullName }).every((c) => c.ok)
  const mismatch = form.confirm.length > 0 && form.confirm !== form.next
  const canSubmit = form.current && policyOk && form.next === form.confirm

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await changePassword(form.current, form.next)
      setForm({ current: '', next: '', confirm: '' })
      toast.success('Password changed', 'Your other devices were signed out.')
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  const fieldErrors = error?.fieldErrors || {}

  return (
    <Card>
      <CardHeader title="Change password" description="Changing it signs out every other device." />
      <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6" noValidate>
        {error && !Object.keys(fieldErrors).length && <Alert tone="error">{error.message}</Alert>}
        <Field label="Current password" error={fieldErrors.currentPassword}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} error={fieldErrors.currentPassword} />}
        </Field>
        <Field label="New password" error={fieldErrors.newPassword}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} error={fieldErrors.newPassword} />}
        </Field>
        {form.next && <PasswordStrength password={form.next} email={user.email} fullName={user.fullName} />}
        <Field label="Confirm new password" error={mismatch ? 'Passwords do not match' : null}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} error={mismatch} />}
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!canSubmit}>Update password</Button>
        </div>
      </form>
    </Card>
  )
}

function Sessions() {
  const { user, logoutEverywhere } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    await logoutEverywhere().catch(() => {})
    toast.info('Signed out everywhere')
    navigate('/login', { replace: true })
  }

  return (
    <Card>
      <CardHeader title="Sessions" description="Where your account is signed in." />
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium">This device</p>
            <p className="text-sm text-zinc-500">Last sign-in {formatDateTime(user.lastLoginAt)}</p>
          </div>
        </div>
        <Button variant="danger-soft" onClick={() => setConfirming(true)}>
          <LogOut className="size-4" aria-hidden /> Sign out of all devices
        </Button>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        busy={busy}
        size="sm"
        title="Sign out of all devices?"
        description="Every browser and phone signed in to your account, including this one, will need to sign in again."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirm} loading={busy}>Sign out everywhere</Button>
          </>
        )}
      />
    </Card>
  )
}

export default function ProfilePage() {
  useDocumentTitle('Profile & security')
  return (
    <>
      <PageHeader title="Profile & security" description="Manage your details, password and signed-in devices." />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3"><PersonalInfo /></div>
        <div className="space-y-6 lg:col-span-2">
          <ChangePassword />
          <Sessions />
        </div>
      </div>
    </>
  )
}
