import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, ClipboardCheck, Clock, Flag, MapPin, Pencil, Send, Ticket, Users2 } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { CATEGORY_LABELS } from '@/features/bookings/bookingsApi'
import {
  audienceLabel, eventsApi, EVENT_STATUS_META, REGISTRATION_STATUS_META, seatSummary, seatsLeftLabel,
} from '@/features/events/eventsApi'
import { usersApi } from '@/features/users/usersApi'
import { EventFormDialog } from '@/components/events/EventFormDialog'
import { AttendanceDialog } from '@/components/events/AttendanceDialog'
import { SeatMeter } from '@/components/events/EventCard'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Alert, Avatar, Badge, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { formatLongDate, formatTimeRange } from '@/lib/campusTime'
import { academicYearLabel, formatRelative } from '@/lib/utils'
import { useDocumentTitle } from '@/lib/hooks'

function Detail({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <div className="text-sm font-semibold">{children}</div>
      </div>
    </div>
  )
}

/**
 * Seat reservation (FR15) and backing out (FR16). Everything the student
 * needs to decide - how full it is, whether they qualify, what happens if
 * they leave - lives in this one panel.
 */
function RsvpPanel({ event, onChanged }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const mine = event.myRegistration
  const { canRegister, canCancelRegistration } = event.permissions

  async function register() {
    setError(null)
    setBusy(true)
    try {
      const { event: updated } = await eventsApi.register(event.id)
      toast.success(
        updated.myRegistration.status === 'WAITLISTED' ? 'Added to the waitlist' : "You're going",
        updated.myRegistration.status === 'WAITLISTED'
          ? 'We will move you up automatically if a seat frees up.'
          : `Your seat is confirmed for ${updated.title}.`,
      )
      onChanged(updated)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    setError(null)
    setBusy(true)
    try {
      const { event: updated } = await eventsApi.cancelRegistration(event.id)
      toast.info('Registration cancelled', 'Your seat is back in the pool.')
      setConfirming(false)
      onChanged(updated)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-semibold">{seatsLeftLabel(event)}</p>
        {event.waitlistCount > 0 && <p className="text-sm text-zinc-500">{event.waitlistCount} waiting</p>}
      </div>
      <SeatMeter event={event} className="my-3" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{seatSummary(event)}</p>

      {error && <Alert tone="error" className="mt-4">{error.message}</Alert>}

      {mine ? (
        <div className="mt-4 space-y-3">
          <Alert tone={mine.status === 'RESERVED' ? 'success' : 'warning'} title={REGISTRATION_STATUS_META[mine.status].label}>
            {mine.status === 'RESERVED'
              ? `Reserved ${formatRelative(mine.registeredAt)}.`
              : 'The event is full. You will be moved up automatically if someone cancels.'}
          </Alert>
          {canCancelRegistration && (
            <Button variant="danger-soft" className="w-full" onClick={() => setConfirming(true)}>
              Cancel my registration
            </Button>
          )}
        </div>
      ) : event.eligibility.ineligibleReason ? (
        <Alert tone="info" title="Not open to you" className="mt-4">{event.eligibility.ineligibleReason}</Alert>
      ) : canRegister ? (
        <Button className="mt-4 w-full" loading={busy} onClick={register}>
          <Ticket className="size-4" aria-hidden /> Reserve my seat
        </Button>
      ) : (
        <Alert tone="info" className="mt-4">
          {event.status !== 'PUBLISHED'
            ? 'Registration opens when the organiser publishes this event.'
            : event.isFull
              ? 'Every seat is taken. Check back in case someone cancels.'
              : 'Registration for this event has closed.'}
        </Alert>
      )}

      {confirming && (
        <Dialog
          open
          busy={busy}
          onClose={() => setConfirming(false)}
          title="Cancel your registration?"
          description={event.isFull
            ? 'Your seat goes back into the pool immediately, and the event is full - you may not get it back.'
            : 'Your seat goes back into the pool immediately. You can register again while seats last.'}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Keep my seat</Button>
              <Button variant="danger" loading={busy} onClick={cancel}>Cancel registration</Button>
            </>
          )}
        />
      )}
    </Card>
  )
}

/** The organiser's roster: who is coming, who is waiting (FR15/FR16). */
function Roster({ eventId, version, past, onMarkAttendance }) {
  // Keyed on the version so an RSVP refetches the roster, the same way the
  // venue calendar refetches after a booking changes.
  const key = `${eventId}:${version}`
  const [state, setState] = useState({ key: null, data: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    eventsApi.roster(eventId, {}, { signal: controller.signal })
      .then((data) => setState({ key, data, error: null }))
      .catch((err) => err.name !== 'AbortError' && setState({ key, data: null, error: err }))
    return () => controller.abort()
  }, [eventId, key])

  if (state.error) return <Card className="p-5"><Alert tone="error">{state.error.message}</Alert></Card>
  if (!state.data) return <Skeleton className="h-48 rounded-2xl" />

  const { items, meta } = state.data

  return (
    <Card>
      <CardHeader
        title={past ? 'Who came' : "Who's coming"}
        description={`${meta.reserved} ${meta.reserved === 1 ? 'seat' : 'seats'} reserved${meta.waitlisted ? ` · ${meta.waitlisted} waitlisted` : ''}`}
        action={past && onMarkAttendance && (
          <Button size="sm" variant="secondary" onClick={onMarkAttendance}>
            <ClipboardCheck className="size-4" aria-hidden /> Mark attendance
          </Button>
        )}
      />
      {items.length === 0 ? (
        <EmptyState icon={Users2} title="No registrations yet" description="They will appear here as students reserve seats." />
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((registration) => (
            <li key={registration.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
              <Avatar name={registration.student.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{registration.student.fullName}</p>
                <p className="truncate text-xs text-zinc-500">
                  {registration.student.department ?? '—'} · {academicYearLabel(registration.student.academicYear).split(' (')[0]} · {registration.student.email}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {registration.seats > 1 && <span className="text-xs text-zinc-500 tabular-nums">{registration.seats} seats</span>}
                <Badge tone={REGISTRATION_STATUS_META[registration.status].tone}>
                  {registration.status === 'RESERVED' ? 'Going' : 'Waitlisted'}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function EventDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [event, setEvent] = useState(null)
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [version, setVersion] = useState(0)
  const [mountedAt] = useState(() => Date.now())
  // Eligibility comes back as department ids; these turn them into codes.
  const [departmentNames, setDepartmentNames] = useState({})
  useDocumentTitle(event?.title || 'Event')

  useEffect(() => {
    let active = true
    eventsApi.get(id)
      .then((data) => active && setEvent(data))
      .catch((err) => active && setError(err))
    return () => { active = false }
  }, [id])

  useEffect(() => {
    let active = true
    usersApi.departments()
      .then((list) => active && setDepartmentNames(Object.fromEntries(list.map((d) => [d.id, d.code]))))
      .catch(() => {})
    return () => { active = false }
  }, [])

  /** A seat change also changes the roster, so both are keyed off one version. */
  function applyUpdate(updated) {
    setEvent(updated)
    setVersion((v) => v + 1)
  }

  const back = (
    <Link to="/events" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
      <ArrowLeft className="size-4" aria-hidden /> All events
    </Link>
  )

  if (error) {
    return <>{back}<Card><EmptyState icon={CalendarDays} title="Event not found" description="It may have been cancelled, or it is not published yet." /></Card></>
  }
  if (!event) {
    return <>{back}<Skeleton className="h-48 rounded-2xl" /><Skeleton className="mt-6 h-64 rounded-2xl" /></>
  }

  const status = EVENT_STATUS_META[event.status]
  const { canPublish, canEdit, canViewRoster } = event.permissions
  // Attendance is a record of what happened, so it waits until it has.
  // The clock is read once, when the page mounts: reading it during every
  // render is impure, and a page that flips mid-render helps nobody.
  const hasHappened = new Date(event.startAt).getTime() <= mountedAt && event.status !== 'CANCELLED'

  return (
    <>
      {back}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-hidden">
            {event.bannerUrl && (
              <img src={event.bannerUrl} alt="" className="h-44 w-full object-cover sm:h-56" />
            )}
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{CATEGORY_LABELS[event.category]}</Badge>
                <Badge tone={status.tone}>{status.label}</Badge>
                {event.scope === 'COLLEGE' && <Badge tone="accent">College-wide</Badge>}
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{event.title}</h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-zinc-500">
                <Flag className="size-3.5" aria-hidden />
                {event.club
                  ? <Link to={`/clubs/${event.club.id}`} className="font-medium hover:text-zinc-900 dark:hover:text-zinc-100">{event.club.name}</Link>
                  : event.department?.name ?? 'College event'}
              </p>

              {event.description && (
                <p className="mt-4 whitespace-pre-line text-[15px] text-zinc-600 dark:text-zinc-300">{event.description}</p>
              )}

              <div className="mt-6 grid gap-4 border-t border-zinc-100 pt-5 sm:grid-cols-3 dark:border-zinc-800">
                <Detail icon={CalendarDays} label="Date">{formatLongDate(event.date)}</Detail>
                <Detail icon={Clock} label="Time">{formatTimeRange(event.startTime, event.endTime)}</Detail>
                <Detail icon={MapPin} label="Venue">
                  {event.venue
                    ? <Link to={`/venues/${event.venue.id}`} className="hover:text-brand-600 dark:hover:text-brand-400">{event.venue.name}</Link>
                    : 'To be announced'}
                </Detail>
              </div>

              {(canPublish || canEdit) && (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-100 pt-5 dark:border-zinc-800">
                  {canPublish && (
                    <Button onClick={() => setDialog('publish')}>
                      <Send className="size-4" aria-hidden /> Publish event
                    </Button>
                  )}
                  {canEdit && !canPublish && (
                    <Button variant="secondary" onClick={() => setDialog('edit')}>
                      <Pencil className="size-4" aria-hidden /> Edit details
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {canViewRoster && (
            <Roster
              eventId={event.id}
              version={version}
              past={hasHappened}
              onMarkAttendance={() => setDialog('attendance')}
            />
          )}
        </div>

        <div className="space-y-6">
          {event.status === 'PUBLISHED' || event.myRegistration ? (
            <RsvpPanel event={event} onChanged={applyUpdate} />
          ) : (
            <Card className="p-5">
              <p className="text-sm font-semibold">Not open yet</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {canPublish
                  ? 'The venue is booked. Publish the event to let students reserve seats.'
                  : 'Registration opens once the organiser publishes this event.'}
              </p>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-semibold">Who can attend</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {audienceLabel(event.eligibility, departmentNames)}
            </p>
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
              Organised by {event.createdBy.fullName}
              {event.bookingId && user.role.key !== 'STUDENT' && (
                <> · <Link to={`/bookings?focus=${event.bookingId}`} className="font-medium hover:text-zinc-900 dark:hover:text-zinc-100">see the booking</Link></>
              )}
            </p>
          </Card>
        </div>
      </div>

      {(dialog === 'publish' || dialog === 'edit') && (
        <EventFormDialog
          event={event}
          mode={dialog}
          onClose={() => setDialog(null)}
          onSaved={(saved) => { setDialog(null); applyUpdate(saved) }}
        />
      )}

      {dialog === 'attendance' && (
        <AttendanceDialog
          event={event}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); setVersion((v) => v + 1) }}
        />
      )}
    </>
  )
}
