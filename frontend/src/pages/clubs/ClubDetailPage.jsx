import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Crown, Pencil, Power, UserMinus, UserPlus, Users2 } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { clubsApi, POSITION_LABELS, positionLabel } from '@/features/clubs/clubsApi'
import { AddMemberDialog, ClubFormDialog, ConfirmDialog } from '@/components/clubs/ClubDialogs'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Alert, Avatar, Badge, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { academicYearLabel, cn, isFaculty } from '@/lib/utils'
import { useDocumentTitle } from '@/lib/hooks'

function Fact({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 p-4 sm:p-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800"><Icon className="size-4" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold">{children}</p>
      </div>
    </div>
  )
}

function MemberRow({ member, canManage, isSelf, onPosition, onRemove, busy }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={member.fullName} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {member.fullName}
            {isSelf && <span className="ml-1.5 text-xs font-normal text-zinc-500">(you)</span>}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {[member.email, member.departmentCode, member.academicYear && academicYearLabel(member.academicYear)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        {member.isHead ? (
          <Badge tone="amber"><Crown className="size-3" aria-hidden /> President</Badge>
        ) : canManage ? (
          <>
            <Select
              aria-label={`Position for ${member.fullName}`}
              value={member.position}
              onChange={(e) => onPosition(member, e.target.value)}
              disabled={busy}
              className="h-8 w-44 py-0 text-sm"
            >
              {Object.entries(POSITION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
            <Button size="icon" variant="ghost" aria-label={`Remove ${member.fullName}`} onClick={() => onRemove(member)} disabled={busy}>
              <UserMinus className="size-4" aria-hidden />
            </Button>
          </>
        ) : (
          <Badge tone={member.position === 'MEMBER' ? 'zinc' : 'brand'}>{positionLabel(member.position)}</Badge>
        )}
      </div>
    </li>
  )
}

export default function ClubDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const [state, setState] = useState({ id: null, club: null, error: null })
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const club = state.id === id ? state.club : null
  useDocumentTitle(club?.name ?? 'Club')

  useEffect(() => {
    const controller = new AbortController()
    clubsApi.get(id, { signal: controller.signal })
      .then((data) => setState({ id, club: data, error: null }))
      .catch((error) => error.name !== 'AbortError' && setState({ id, club: null, error }))
    return () => controller.abort()
  }, [id])

  const replace = (updated) => setState({ id, club: updated, error: null })
  const close = () => setDialog(null)

  async function changePosition(member, position) {
    setBusy(true)
    try {
      replace(await clubsApi.updateMember(club.id, member.userId, position))
      toast.success('Position updated', `${member.fullName} is now ${positionLabel(position).toLowerCase()}.`)
    } catch (err) {
      toast.error('Could not change the position', err.message)
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <Link to="/clubs" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
      <ArrowLeft className="size-4" aria-hidden /> Clubs
    </Link>
  )

  if (state.id === id && state.error) {
    return <>{back}<Alert tone="error" title="Could not open this club">{state.error.message}</Alert></>
  }
  if (!club) {
    return <>{back}<Card className="space-y-3 p-8" aria-label="Loading club"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-80" /><Skeleton className="h-32" /></Card></>
  }

  const { canEdit, canManage, canManageMembers } = club.permissions
  const me = club.members.find((m) => m.userId === user.id)
  const canLeave = Boolean(me && !me.isHead)

  return (
    <>
      {back}

      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={club.name} size="lg" className="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{club.name}</h1>
            {club.scope === 'COLLEGE' ? <Badge tone="accent">College-level</Badge> : <Badge>{club.department?.code}</Badge>}
            {!club.isActive && <Badge tone="rose" dot>Disabled</Badge>}
          </div>
          <p className="mt-1.5 max-w-2xl text-[15px] text-zinc-500 dark:text-zinc-400">{club.description || 'No description yet.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button variant="secondary" onClick={() => setDialog({ type: 'edit' })}><Pencil className="size-4" aria-hidden /> Edit</Button>}
          {canManage && (
            <Button variant={club.isActive ? 'danger-soft' : 'secondary'} onClick={() => setDialog({ type: 'toggle' })}>
              <Power className="size-4" aria-hidden /> {club.isActive ? 'Disable' : 'Re-enable'}
            </Button>
          )}
          {canLeave && <Button variant="ghost" onClick={() => setDialog({ type: 'leave' })}>Leave club</Button>}
        </div>
      </div>

      {!club.isActive && (
        <Alert tone="warning" title="This club is disabled" className="mb-6">
          It is hidden from students, cannot request venues, and its team cannot change.
        </Alert>
      )}
      {!club.head && isFaculty(user) && (
        <Alert tone="info" title="No head appointed" className="mb-6">
          Appoint one by promoting a student to club head from <Link to="/users" className="font-medium underline">People</Link>.
        </Alert>
      )}

      <Card className="mb-6 grid divide-y divide-zinc-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-zinc-800">
        <Fact icon={Crown} label="Club head">{club.head?.fullName ?? 'Not appointed'}</Fact>
        <Fact icon={Building2} label="Overseen by">{club.department?.name ?? 'Principal / HOD'}</Fact>
        <Fact icon={Users2} label="Team size">{club.memberCount} {club.memberCount === 1 ? 'person' : 'people'}</Fact>
      </Card>

      <Card>
        <CardHeader
          title="Organising team"
          description={canManageMembers ? 'Add people, set their positions, or remove them.' : 'The people who run this club.'}
          action={canManageMembers && <Button size="sm" onClick={() => setDialog({ type: 'add' })}><UserPlus className="size-4" aria-hidden /> Add member</Button>}
        />
        {club.members.length === 0 ? (
          <EmptyState icon={Users2} title="No team members yet" description={canManageMembers ? 'Add the first member by their college email.' : 'Nobody has been added to this team yet.'} />
        ) : (
          <ul className={cn('divide-y divide-zinc-100 dark:divide-zinc-800', busy && 'opacity-70')}>
            {club.members.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                canManage={canManageMembers}
                isSelf={member.userId === user.id}
                busy={busy}
                onPosition={changePosition}
                onRemove={(m) => setDialog({ type: 'remove', member: m })}
              />
            ))}
          </ul>
        )}
      </Card>

      {dialog?.type === 'edit' && (
        <ClubFormDialog club={club} user={user} onClose={close} onSaved={(updated) => { replace(updated); close() }} />
      )}
      {dialog?.type === 'add' && (
        <AddMemberDialog club={club} onClose={close} onSaved={(updated) => { replace(updated); close() }} />
      )}
      {dialog?.type === 'toggle' && (
        <ConfirmDialog
          title={club.isActive ? `Disable ${club.name}?` : `Re-enable ${club.name}?`}
          description={club.isActive
            ? 'Its open venue requests are withdrawn and the requesters are told. Approved bookings stay until faculty cancel them.'
            : 'The club becomes visible again and can request venues.'}
          confirmLabel={club.isActive ? 'Disable club' : 'Re-enable club'}
          variant={club.isActive ? 'danger' : 'primary'}
          action={() => clubsApi.update(club.id, { isActive: !club.isActive })}
          onClose={close}
          onDone={(updated) => { replace(updated); close(); toast.success(updated.isActive ? 'Club re-enabled' : 'Club disabled', updated.name) }}
        />
      )}
      {dialog?.type === 'remove' && (
        <ConfirmDialog
          title={`Remove ${dialog.member.fullName}?`}
          description="They leave the organising team. Their account and role are not changed."
          confirmLabel="Remove from team"
          action={() => clubsApi.removeMember(club.id, dialog.member.userId)}
          onClose={close}
          onDone={(updated) => { replace(updated); close(); toast.success('Member removed', dialog.member.fullName) }}
        />
      )}
      {dialog?.type === 'leave' && (
        <ConfirmDialog
          title={`Leave ${club.name}?`}
          description="You will no longer see this club's bookings. The club head can add you back."
          confirmLabel="Leave club"
          action={() => clubsApi.removeMember(club.id, user.id)}
          onClose={close}
          onDone={(updated) => { replace(updated); close(); toast.info('You left the club', club.name) }}
        />
      )}
    </>
  )
}
