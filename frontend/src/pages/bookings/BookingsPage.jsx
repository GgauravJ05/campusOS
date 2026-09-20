import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarPlus, CalendarX2, Check, Clock, History, MapPin, MessageSquareWarning, PencilLine, Swords, Users2, X, Zap } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { bookingsApi, canBook, CATEGORY_LABELS, STATUS_META } from '@/features/bookings/bookingsApi'
import { floorLabel } from '@/features/venues/venuesApi'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { Alert, Badge, Card, EmptyState, Skeleton } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { dayOfMonth, formatLongDate, formatTimeRange, shortMonth } from '@/lib/campusTime'
import { cn, formatRelative, isFaculty } from '@/lib/utils'
import { useDocumentTitle } from '@/lib/hooks'
import { markSummaryStale } from '@/lib/summary'

/** URL tab → API query. "waiting" is the approver's view of requests sent back to the club. */
const VIEW_QUERY = {
  decisions: { view: 'decisions' },
  waiting: { view: 'decisions', status: 'MODIFICATION_REQUESTED' },
  all: { view: 'all' },
  mine: { view: 'mine' },
}

function DecisionDialog({ booking, action, onClose, onDone }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const copy = {
    approve: {
      title: 'Approve this request?',
      description: 'The slot becomes booked immediately. Any other pending requests that overlap it are declined automatically.',
      button: 'Approve and book',
      variant: 'primary',
    },
    reject: {
      title: 'Reject this request',
      description: 'The requester sees your reason, so make it useful.',
      button: 'Reject request',
      variant: 'danger',
      field: { label: 'Reason', placeholder: 'The hall is reserved for exam invigilation that day.' },
    },
    changes: {
      title: 'Request changes',
      description: 'The request goes back to the club with your note. The slot is not held while they edit, so another approval can still take it.',
      button: 'Send back to club',
      variant: 'primary',
      field: { label: 'What should change?', placeholder: 'Expected attendance is too high for this hall. Try Seminar Hall A, or lower the number.' },
    },
    cancel: {
      title: 'Cancel this booking?',
      description: 'The slot is released for others. This cannot be undone.',
      button: 'Cancel booking',
      variant: 'danger',
    },
  }[action]

  async function confirm() {
    setError(null)
    setBusy(true)
    try {
      const run = {
        approve: () => bookingsApi.approve(booking.id),
        reject: () => bookingsApi.reject(booking.id, text.trim()),
        changes: () => bookingsApi.requestChanges(booking.id, text.trim()),
        cancel: () => bookingsApi.cancel(booking.id),
      }[action]
      const updated = await run()
      toast.success({ approve: 'Request approved', reject: 'Request rejected', changes: 'Sent back for changes', cancel: 'Booking cancelled' }[action], updated.event.title)
      markSummaryStale()
      onDone()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  const textShort = Boolean(copy.field) && text.trim().length < 5

  return (
    <Dialog
      open
      size="sm"
      busy={busy}
      onClose={onClose}
      title={copy.title}
      description={copy.description}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Keep as is</Button>
          <Button variant={copy.variant} onClick={confirm} loading={busy} disabled={textShort}>{copy.button}</Button>
        </>
      )}
    >
      <div className="space-y-4 pb-2">
        <div className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">
          <p className="font-semibold">{booking.event.title}</p>
          <p className="text-zinc-500">{booking.venue.name} · {formatLongDate(booking.date)} · {formatTimeRange(booking.startTime, booking.endTime)}</p>
        </div>
        {error && <Alert tone="error">{error.fieldErrors.reason || error.fieldErrors.note || error.message}</Alert>}
        {copy.field && (
          <Field label={copy.field.label} hint="Required. At least 5 characters. The club sees this.">
            {(p) => <Textarea {...p} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={copy.field.placeholder} autoFocus />}
          </Field>
        )}
      </div>
    </Dialog>
  )
}

function BookingCard({ booking, onAction, showRequester, focused }) {
  const meta = STATUS_META[booking.status]
  const { canDecide, canReject, canEdit, canCancel } = booking.permissions
  const sentBack = booking.status === 'MODIFICATION_REQUESTED'
  const ref = useRef(null)

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [focused])

  return (
    <li
      ref={ref}
      data-focused={focused || undefined}
      className={cn('flex flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-start sm:p-5', focused && 'bg-brand-50/60 ring-2 ring-brand-500/60 ring-inset dark:bg-brand-500/5')}
    >
      <div className={cn(
        'flex w-14 shrink-0 flex-col items-center rounded-xl border py-2',
        booking.status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
          : booking.status === 'PENDING' ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
            : booking.status === 'MODIFICATION_REQUESTED' ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300'
              : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60',
      )}
      >
        <span className="text-[11px] font-semibold tracking-wide uppercase">{shortMonth(booking.date)}</span>
        <span className="text-xl leading-none font-semibold tabular-nums">{dayOfMonth(booking.date)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold tracking-tight">{booking.event.title}</h3>
          <Badge tone={meta.tone} dot>{meta.label}</Badge>
          {booking.isDirect && <Badge tone="accent"><Zap className="size-3" aria-hidden /> Direct</Badge>}
          {booking.revision > 0 && booking.status === 'PENDING' && <Badge tone="blue"><History className="size-3" aria-hidden /> Resubmitted</Badge>}
          {booking.status === 'PENDING' && booking.competingRequests > 0 && (
            <Badge tone="amber"><Swords className="size-3" aria-hidden /> {booking.competingRequests} competing</Badge>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
          <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{formatTimeRange(booking.startTime, booking.endTime)}</span>
          <Link to={`/venues/${booking.venue.id}`} className="flex items-center gap-1 hover:text-brand-600"><MapPin className="size-3.5" aria-hidden />{booking.venue.name}, {floorLabel(booking.venue.floor)}</Link>
          <span className="flex items-center gap-1"><Users2 className="size-3.5" aria-hidden />{booking.event.expectedAttendance} expected</span>
        </div>
        <p className="mt-1.5 text-sm text-zinc-500">
          {CATEGORY_LABELS[booking.event.category]} · {booking.event.club?.name ?? (booking.event.scope === 'COLLEGE' ? 'College event' : `${booking.event.department?.code ?? ''} department event`)}
          {showRequester && <> · requested by {booking.requestedBy.fullName} {formatRelative(booking.createdAt).toLowerCase()}</>}
        </p>
        {sentBack && booking.modificationNote && (
          <div className="mt-2 flex gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
            <MessageSquareWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p><span className="font-medium">{showRequester ? 'You asked for:' : `${booking.decidedBy?.fullName ?? 'The approver'} asked for changes:`}</span> {booking.modificationNote}</p>
          </div>
        )}
        {booking.status === 'PENDING' && booking.revision > 0 && booking.modificationNote && showRequester && (
          <p className="mt-2 text-sm text-zinc-500"><span className="font-medium">Earlier you asked for:</span> {booking.modificationNote}</p>
        )}
        {booking.status === 'REJECTED' && booking.rejectionReason && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-500/10 dark:text-rose-300">
            <span className="font-medium">Reason:</span> {booking.rejectionReason}
          </p>
        )}
        {booking.decidedBy && booking.status === 'APPROVED' && !booking.isDirect && (
          <p className="mt-1.5 text-xs text-zinc-400">Approved by {booking.decidedBy.fullName}</p>
        )}
      </div>

      {(canDecide || canReject || canEdit || canCancel) && (
        <div className="flex shrink-0 flex-wrap gap-2 sm:w-40 sm:flex-col sm:items-stretch">
          {canDecide && <Button size="sm" onClick={() => onAction(booking, 'approve')}><Check className="size-4" aria-hidden /> Approve</Button>}
          {canDecide && <Button size="sm" variant="secondary" onClick={() => onAction(booking, 'changes')}><MessageSquareWarning className="size-4" aria-hidden /> Request changes</Button>}
          {(canReject || canDecide) && <Button size="sm" variant="danger-soft" onClick={() => onAction(booking, 'reject')}><X className="size-4" aria-hidden /> Reject</Button>}
          {canEdit && (
            <Link to={`/bookings/${booking.id}/edit`} className={buttonClasses({ size: 'sm', variant: sentBack ? 'primary' : 'secondary' })}>
              <PencilLine className="size-4" aria-hidden /> {sentBack ? 'Edit & resubmit' : 'Edit'}
            </Link>
          )}
          {canCancel && !canDecide && !canReject && <Button size="sm" variant="secondary" onClick={() => onAction(booking, 'cancel')}>Cancel</Button>}
        </div>
      )}
    </li>
  )
}

export default function BookingsPage() {
  useDocumentTitle('Bookings')
  const { user } = useAuth()
  const faculty = isFaculty(user)
  const [params, setParams] = useSearchParams()
  const view = params.get('view') || (faculty ? 'decisions' : 'mine')
  const status = params.get('status') || ''
  const focus = Number(params.get('focus')) || null
  const [refresh, setRefresh] = useState(0)
  const [dialog, setDialog] = useState(null)

  const key = `${view}|${status}|${refresh}`
  const [result, setResult] = useState({ key: null, items: [], meta: null, error: null })
  const loading = result.key !== key

  useEffect(() => {
    const controller = new AbortController()
    const query = VIEW_QUERY[view] ?? VIEW_QUERY.mine
    bookingsApi.list({ ...query, status: query.status ?? (status || undefined), pageSize: 50 }, { signal: controller.signal })
      .then(({ data, meta }) => setResult({ key, items: data, meta, error: null }))
      .catch((err) => err.name !== 'AbortError' && setResult({ key, items: [], meta: null, error: err }))
    return () => controller.abort()
  }, [key, view, status])

  const tabs = faculty
    ? [['decisions', 'Needs decision'], ['waiting', 'Waiting on club'], ['all', 'Department'], ['mine', 'My bookings']]
    : [['mine', 'My bookings']]

  function setParam(name, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    if (name === 'view') {
      next.delete('status')
      next.delete('focus')
    }
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Bookings"
        description={faculty ? 'Decide venue requests and keep track of your department’s bookings.' : 'Your club’s venue requests and their status.'}
        actions={canBook(user) && <Link to="/bookings/new" className={buttonClasses()}><CalendarPlus className="size-4" aria-hidden /> Book a venue</Link>}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <div role="tablist" aria-label="Booking views" className="flex gap-1 overflow-x-auto">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={view === id}
                onClick={() => setParam('view', id)}
                className={cn(
                  'rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  view === id ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800',
                )}
              >
                {label}
                {id === view && (id === 'decisions' || id === 'waiting') && result.meta && !loading && (
                  <span className="ml-2 rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] text-white tabular-nums">{result.meta.total}</span>
                )}
              </button>
            ))}
          </div>
          {view !== 'decisions' && view !== 'waiting' && (
            <Select aria-label="Filter by status" value={status} onChange={(e) => setParam('status', e.target.value)} className="sm:w-48">
              <option value="">All statuses</option>
              {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </Select>
          )}
        </div>

        {result.error ? (
          <div className="p-4"><Alert tone="error" title="Could not load bookings">{result.error.message}</Alert></div>
        ) : loading && result.items.length === 0 ? (
          <div className="space-y-3 p-5" aria-label="Loading bookings">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        ) : result.items.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title={view === 'decisions' ? 'Nothing waiting for you' : view === 'waiting' ? 'No requests sent back' : 'No bookings yet'}
            description={view === 'decisions' ? 'New venue requests from your department appear here.'
              : view === 'waiting' ? 'Requests you send back for changes wait here until the club resubmits them.'
                : canBook(user) ? 'Book a venue for your next event.' : 'Your club’s bookings will appear here.'}
            action={view !== 'decisions' && view !== 'waiting' && canBook(user) && <Link to="/bookings/new" className={buttonClasses({ variant: 'secondary' })}>Book a venue</Link>}
          />
        ) : (
          <ul className={cn('divide-y divide-zinc-100 transition-opacity dark:divide-zinc-800', loading && 'opacity-60')}>
            {result.items.map((booking) => (
              <BookingCard key={booking.id} booking={booking} showRequester={faculty} focused={booking.id === focus} onAction={(b, action) => setDialog({ booking: b, action })} />
            ))}
          </ul>
        )}
      </Card>

      {dialog && (
        <DecisionDialog
          booking={dialog.booking}
          action={dialog.action}
          onClose={() => setDialog(null)}
          onDone={() => { setDialog(null); setRefresh((r) => r + 1) }}
        />
      )}
    </>
  )
}
