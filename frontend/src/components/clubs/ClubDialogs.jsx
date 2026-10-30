import { useEffect, useState } from 'react'
import { clubsApi, POSITION_LABELS } from '@/features/clubs/clubsApi'
import { usersApi } from '@/features/users/usersApi'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'

/** Department choice for the Principal / HOD. Empty string means college-level. */
function DepartmentField({ value, onChange, error }) {
  const [departments, setDepartments] = useState([])
  useEffect(() => {
    usersApi.departments().then(setDepartments).catch(() => {})
  }, [])
  return (
    <Field label="Department" error={error} hint="A college-level club is overseen by the Principal / HOD.">
      {(p) => (
        <Select {...p} value={value} onChange={(e) => onChange(e.target.value)} error={error}>
          <option value="">College-level (no department)</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      )}
    </Field>
  )
}

/**
 * Create (no `club`) or edit a club. The Principal / HOD also chooses the
 * department; a coordinator's new club always belongs to their own.
 */
export function ClubFormDialog({ club, user, onClose, onSaved }) {
  const toast = useToast()
  const principal = user.role.key === 'SUPER_ADMIN'
  const [form, setForm] = useState({
    name: club?.name ?? '',
    description: club?.description ?? '',
    departmentId: club ? String(club.department?.id ?? '') : String(principal ? '' : user.department?.id ?? ''),
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const fieldErrors = error?.fieldErrors || {}

  async function save() {
    setError(null)
    setSaving(true)
    const payload = { name: form.name.trim(), description: form.description.trim() || null }
    const departmentId = form.departmentId === '' ? null : Number(form.departmentId)
    if (principal && (!club || departmentId !== (club.department?.id ?? null))) payload.departmentId = departmentId
    try {
      const saved = club ? await clubsApi.update(club.id, payload) : await clubsApi.create(payload)
      toast.success(club ? 'Club updated' : 'Club created', saved.name)
      onSaved(saved)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      busy={saving}
      onClose={onClose}
      title={club ? `Edit ${club.name}` : 'Create a club'}
      description={club ? 'Keep the name and description current so students know what the club does.' : 'Appoint its head afterwards from People.'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={form.name.trim().length < 2}>{club ? 'Save changes' : 'Create club'}</Button>
        </>
      )}
    >
      <form className="space-y-4 pb-2" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        {error && !Object.keys(fieldErrors).length && <Alert tone="error">{error.message}</Alert>}
        <Field label="Name" error={fieldErrors.name}>
          {(p) => <Input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Photography Club" error={fieldErrors.name} autoFocus />}
        </Field>
        <Field label="Description" optional error={fieldErrors.description}>
          {(p) => <Textarea {...p} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What the club does and who can join" />}
        </Field>
        {principal ? (
          <DepartmentField value={form.departmentId} onChange={(departmentId) => setForm({ ...form, departmentId })} error={fieldErrors.departmentId} />
        ) : !club && (
          <p className="rounded-lg bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
            The club will belong to {user.department?.name ?? 'your department'}.
          </p>
        )}
      </form>
    </Dialog>
  )
}

export function AddMemberDialog({ club, onClose, onSaved }) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('MEMBER')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const fieldErrors = error?.fieldErrors || {}

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const saved = await clubsApi.addMember(club.id, { email: email.trim(), position })
      toast.success('Member added', `They have been told they joined ${club.name}.`)
      onSaved(saved)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      size="sm"
      busy={saving}
      onClose={onClose}
      title="Add a team member"
      description="Adding someone to the team does not change their role."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!email.includes('@')}>Add member</Button>
        </>
      )}
    >
      <form className="space-y-4 pb-2" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        {error && !fieldErrors.email && <Alert tone="error">{error.message}</Alert>}
        <Field label="College email" error={fieldErrors.email} hint="They need a verified CampusOS account.">
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@mmcoe.edu.in" error={fieldErrors.email} autoFocus />}
        </Field>
        <Field label="Position">
          {(p) => (
            <Select {...p} value={position} onChange={(e) => setPosition(e.target.value)}>
              {Object.entries(POSITION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  )
}

/** A yes/no confirmation that runs `action` and reports failures inline. */
export function ConfirmDialog({ title, description, confirmLabel, variant = 'danger', action, onClose, onDone }) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setError(null)
    setBusy(true)
    try {
      onDone(await action())
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      size="sm"
      busy={busy}
      onClose={onClose}
      title={title}
      description={description}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Keep as is</Button>
          <Button variant={variant} onClick={confirm} loading={busy}>{confirmLabel}</Button>
        </>
      )}
    >
      {error ? <Alert tone="error" className="mb-2">{error.message}</Alert> : <div className="pb-1" />}
    </Dialog>
  )
}
