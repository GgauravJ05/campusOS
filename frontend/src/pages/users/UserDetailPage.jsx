import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Crown, Lock, RotateCcw, UserCog, UsersRound } from 'lucide-react'
import { usersApi } from '@/features/users/usersApi'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Select } from '@/components/ui/Field'
import { Alert, Avatar, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { RoleBadge, ScopeBadge, StatusBadge } from '@/components/RoleBadge'
import { academicYearLabel, cn, formatDateTime, formatRelative, ROLE_META } from '@/lib/utils'
import { useDocumentTitle } from '@/lib/hooks'

const CLUB_ROLES = ['CLUB_HEAD', 'CLUB_MEMBER']

/** Mounted only while open, so every opening starts from a clean form. */
function ChangeRoleDialog({ onClose, person, onChanged }) {
  const toast = useToast()
  const [role, setRole] = useState(person.role.key)
  const [clubId, setClubId] = useState('')
  const [clubs, setClubs] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    usersApi.appointableClubs()
      .then((list) => active && setClubs(list))
      .catch(() => active && setClubs([]))
    return () => { active = false }
  }, [])

  const needsClub = CLUB_ROLES.includes(role)
  const selectedClub = clubs?.find((c) => String(c.id) === clubId)
  const unchanged = role === person.role.key && !needsClub
  const replacing = role === 'CLUB_HEAD' && selectedClub?.head && selectedClub.head.id !== person.id

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const updated = await usersApi.changeRole(person.id, role, needsClub ? Number(clubId) : undefined)
      toast.success('Role updated', `${person.fullName} is now ${ROLE_META[role].label.toLowerCase()}.`)
      onChanged(updated)
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={saving}
      title="Change role"
      description={`Choose what ${person.fullName} can do in CampusOS. Takes effect immediately and is recorded in the audit log.`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={unchanged || (needsClub && !clubId)}>Save role</Button>
        </>
      )}
    >
      <div className="space-y-5 pb-2">
        {error && <Alert tone="error">{error.message}</Alert>}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Role</legend>
          <div className="grid gap-2">
            {person.permissions.assignableRoles.map((key) => (
              <label
                key={key}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors',
                  role === key
                    ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500 dark:bg-brand-500/10'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600',
                )}
              >
                <input type="radio" name="role" value={key} checked={role === key} onChange={() => setRole(key)} className="mt-0.5 size-4 accent-brand-600" />
                <span>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {ROLE_META[key].label}
                    {key === person.role.key && <span className="text-xs font-normal text-zinc-500">(current)</span>}
                  </span>
                  <span className="block text-sm text-zinc-500 dark:text-zinc-400">{ROLE_META[key].description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {needsClub && (
          <Field label="Club" hint={selectedClub ? undefined : 'Club roles are tied to one club.'}>
            {(p) => (
              <Select {...p} value={clubId} onChange={(e) => setClubId(e.target.value)} disabled={!clubs}>
                <option value="" disabled>{clubs ? 'Select a club' : 'Loading clubs…'}</option>
                {clubs?.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.name} · {club.scope === 'COLLEGE' ? 'College-wide' : club.department?.code}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {selectedClub?.scope === 'COLLEGE' && role === 'CLUB_HEAD' && (
          <Alert tone="info">This is a college-level club, so its head acts for the whole college.</Alert>
        )}
        {replacing && (
          <Alert tone="warning" title={`Replaces ${selectedClub.head.fullName}`}>
            They stay in the club as a member, and step down to club member if they lead no other club.
          </Alert>
        )}
      </div>
    </Dialog>
  )
}

function StatusDialog({ onClose, person, onChanged }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const deactivating = person.isActive

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      const updated = await usersApi.setActive(person.id, !deactivating)
      toast.success(deactivating ? 'Account deactivated' : 'Account reactivated')
      onChanged(updated)
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      busy={saving}
      size="sm"
      title={deactivating ? `Deactivate ${person.fullName}?` : `Reactivate ${person.fullName}?`}
      description={deactivating
        ? 'They are signed out of every device immediately and cannot sign in until reactivated. Their history is kept.'
        : 'They will be able to sign in again with their existing password.'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant={deactivating ? 'danger' : 'primary'} onClick={handleConfirm} loading={saving}>
            {deactivating ? 'Deactivate' : 'Reactivate'}
          </Button>
        </>
      )}
    >
      {error && <Alert tone="error" className="mb-2">{error.message}</Alert>}
    </Dialog>
  )
}

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  )
}

export default function UserDetailPage() {
  const { id } = useParams()
  const [person, setPerson] = useState(null)
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null)
  useDocumentTitle(person?.fullName || 'Person')

  // The shell remounts the page on every path change, so state starts fresh per id.
  useEffect(() => {
    let active = true
    usersApi.get(id)
      .then((data) => active && setPerson(data))
      .catch((err) => active && setError(err))
    return () => { active = false }
  }, [id])

  const back = (
    <Link to="/users" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
      <ArrowLeft className="size-4" aria-hidden /> All people
    </Link>
  )

  if (error) {
    return (
      <>
        {back}
        <Card><EmptyState icon={UsersRound} title={error.status === 404 ? 'Person not found' : 'Could not load this person'} description={error.status === 404 ? 'They may be outside your department.' : error.message} /></Card>
      </>
    )
  }

  if (!person) {
    return (
      <>
        {back}
        <Card className="p-6" aria-label="Loading person">
          <div className="flex items-center gap-4"><Skeleton className="size-20 rounded-full" /><div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-64" /></div></div>
        </Card>
      </>
    )
  }

  const { canManage } = person.permissions

  return (
    <>
      {back}

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-brand-500/15 via-indigo-500/10 to-transparent dark:from-brand-500/20" aria-hidden />
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-6 sm:px-8">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
            <Avatar name={person.fullName} src={person.avatarUrl} size="xl" className="-mt-10 ring-4 ring-white dark:ring-zinc-900" />
            <div className="min-w-0 sm:pt-3">
              <h1 className="text-2xl font-semibold tracking-tight">{person.fullName}</h1>
              <p className="text-sm text-zinc-500">{person.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5"><RoleBadge role={person.role} /><StatusBadge user={person} /></div>
            </div>
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-2 sm:pt-4">
              <Button variant="secondary" onClick={() => setDialog('role')} disabled={!person.isActive || !person.isVerified}>
                <UserCog className="size-4" aria-hidden /> Change role
              </Button>
              {person.isActive ? (
                <Button variant="danger-soft" onClick={() => setDialog('status')}><Ban className="size-4" aria-hidden /> Deactivate</Button>
              ) : (
                <Button variant="secondary" onClick={() => setDialog('status')}><RotateCcw className="size-4" aria-hidden /> Reactivate</Button>
              )}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-zinc-500 sm:pt-6"><Lock className="size-4" aria-hidden /> View only</p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-6 border-t border-zinc-100 px-5 py-6 sm:grid-cols-4 sm:px-8 dark:border-zinc-800">
          <Detail label="Department">{person.department?.name ?? '—'}</Detail>
          <Detail label="Academic year">{academicYearLabel(person.academicYear)}</Detail>
          <Detail label="Last sign-in">{formatRelative(person.lastLoginAt)}</Detail>
          <Detail label="Joined">{formatDateTime(person.createdAt)}</Detail>
        </dl>
      </Card>

      {canManage && !person.isVerified && (
        <Alert tone="warning" className="mt-6" title="Email not verified yet">
          Roles can be assigned once they verify their email address.
        </Alert>
      )}

      <Card className="mt-6">
        <CardHeader title="Clubs" description="Club roles and memberships." />
        {person.clubs.length ? (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {person.clubs.map((club) => (
              <li key={club.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                <span className={cn('grid size-9 place-items-center rounded-lg', club.isHead ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800')}>
                  {club.isHead ? <Crown className="size-4" aria-hidden /> : <UsersRound className="size-4" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{club.name}</p>
                  <p className="text-xs text-zinc-500">{club.isHead ? 'Club head' : club.position.replace(/_/g, ' ').toLowerCase()}</p>
                </div>
                <ScopeBadge scope={club.scope} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={UsersRound} title="Not in any club" description={canManage ? 'Use “Change role” to make them a club member or head.' : undefined} className="py-10" />
        )}
      </Card>

      {canManage && (
        <>
          {dialog === 'role' && <ChangeRoleDialog onClose={() => setDialog(null)} person={person} onChanged={setPerson} />}
          {dialog === 'status' && <StatusDialog onClose={() => setDialog(null)} person={person} onChanged={setPerson} />}
        </>
      )}
    </>
  )
}
