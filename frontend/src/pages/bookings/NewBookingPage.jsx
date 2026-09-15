import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Building2, CalendarClock, Check, CheckCircle2, ClipboardList, Clock, Flag, Info, Layers, Loader2, MapPin, MessageSquareWarning, Users2,
} from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { venuesApi, floorLabel, VENUE_TYPE_LABELS } from '@/features/venues/venuesApi'
import { bookingsApi, CATEGORY_LABELS } from '@/features/bookings/bookingsApi'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Alert, Card, Skeleton } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { VenueIcon } from '@/components/venues/VenueVisual'
import { addDays, campusToday, durationLabel, formatLongDate, formatTimeRange, timeOptions, toMinutes } from '@/lib/campusTime'
import { cn, isFaculty } from '@/lib/utils'
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks'
import { markSummaryStale } from '@/lib/summary'

const STEPS = [
  { id: 'venue', label: 'Venue', icon: Building2 },
  { id: 'time', label: 'Date & time', icon: CalendarClock },
  { id: 'details', label: 'Event details', icon: ClipboardList },
]

function Stepper({ step }) {
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Booking steps">
      {STEPS.map((s, i) => {
        const done = i < step
        const current = i === step
        return (
          <li key={s.id} aria-current={current ? 'step' : undefined} className="flex flex-col gap-2">
            <div className={cn('h-1.5 rounded-full transition-colors', done || current ? 'bg-brand-600 dark:bg-brand-500' : 'bg-zinc-200 dark:bg-zinc-800')} />
            <span className={cn('flex items-center gap-1.5 text-sm font-medium', current ? 'text-brand-700 dark:text-brand-300' : done ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-400')}>
              {done ? <Check className="size-4" aria-hidden /> : <s.icon className="size-4" aria-hidden />}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sr-only sm:hidden">{s.label}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ChoiceButton({ selected, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-xl border p-3.5 text-left transition-all',
        selected
          ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500 dark:bg-brand-500/10'
          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600',
        className,
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Building -> Floor -> Venue (FR6 hierarchy)
// ---------------------------------------------------------------------------

function VenueStep({ meta, selection, onChange }) {
  const building = meta.buildings.find((b) => b.name === selection.building)
  const floor = building?.floors.find((f) => f.floor === selection.floor)

  return (
    <div className="space-y-7">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">1. Building</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {meta.buildings.map((b) => (
            <ChoiceButton key={b.name} selected={selection.building === b.name} onClick={() => onChange({ building: b.name, floor: null, venueId: null })}>
              <span className="flex items-center gap-3">
                <Building2 className="size-5 text-zinc-400" aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{b.name}</span>
                  <span className="block text-xs text-zinc-500">{b.floors.reduce((n, f) => n + f.venues.length, 0)} venues</span>
                </span>
              </span>
            </ChoiceButton>
          ))}
        </div>
      </section>

      {building && (
        <section className="animate-fade-in">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">2. Floor</h2>
          <div className="flex flex-wrap gap-2">
            {building.floors.map((f) => (
              <ChoiceButton key={f.floor} className="px-4 py-2.5" selected={selection.floor === f.floor} onClick={() => onChange({ floor: f.floor, venueId: null })}>
                <span className="flex items-center gap-2 text-sm font-medium"><Layers className="size-4 text-zinc-400" aria-hidden />{floorLabel(f.floor)}</span>
              </ChoiceButton>
            ))}
          </div>
        </section>
      )}

      {floor && (
        <section className="animate-fade-in">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">3. Venue</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {floor.venues.map((v) => (
              <ChoiceButton key={v.id} selected={selection.venueId === v.id} onClick={() => onChange({ venueId: v.id })}>
                <span className="flex items-center gap-3">
                  <VenueIcon type={v.type} className="size-10" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{v.name}</span>
                    <span className="block text-xs text-zinc-500">{VENUE_TYPE_LABELS[v.type]} · {v.capacity} seats</span>
                  </span>
                </span>
              </ChoiceButton>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: date & time with live conflict detection (FR7-FR9)
// ---------------------------------------------------------------------------

function AvailabilityPanel({ status, onPick }) {
  if (status.state === 'idle') return null
  if (status.state === 'checking') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Checking availability…
      </div>
    )
  }
  if (status.state === 'invalid') {
    return <Alert tone="warning" title="Adjust the time">{status.messages.join(' ')}</Alert>
  }
  if (status.state === 'error') return <Alert tone="error">{status.message}</Alert>

  const { result } = status
  if (result.available) {
    return (
      <div className="space-y-3" role="status">
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">This slot is free</p>
            <p className="text-sm opacity-90">Includes the {result.bufferMinutes}-minute setup and teardown buffer around other bookings.</p>
          </div>
        </div>
        {result.competingRequests > 0 && (
          <Alert tone="info" title={`${result.competingRequests} other request${result.competingRequests > 1 ? 's' : ''} pending for this time`}>
            Requests can compete for a slot. Whichever the coordinator approves first gets it.
          </Alert>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3" role="status">
      <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">Already booked</p>
          <ul className="mt-1 space-y-0.5 text-sm opacity-90">
            {result.conflicts.map((c, i) => (
              <li key={i}>{c.title} · {c.club} · {formatTimeRange(c.startTime, c.endTime)}</li>
            ))}
          </ul>
          <p className="mt-1 text-sm opacity-90">Bookings need a {result.bufferMinutes}-minute gap either side.</p>
        </div>
      </div>
      {result.suggestions.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Free times of the same length that day</p>
          <div className="flex flex-wrap gap-2">
            {result.suggestions.map((s) => (
              <button
                key={s.startTime}
                type="button"
                onClick={() => onPick(s)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium tabular-nums hover:border-brand-400 hover:text-brand-700 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:text-brand-300"
              >
                {formatTimeRange(s.startTime, s.endTime)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No free window of that length remains that day. Try another date or a shorter time.</p>
      )}
    </div>
  )
}

function TimeStep({ venue, rules, slot, onChange, status }) {
  const today = campusToday()
  const options = timeOptions(rules.openingTime, rules.closingTime)
  const startOptions = options.slice(0, -1)
  const endOptions = options.filter((t) => !slot.startTime || toMinutes(t) > toMinutes(slot.startTime))

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <VenueIcon type={venue.type} className="size-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{venue.name}</p>
            <p className="text-xs text-zinc-500">{venue.building} · {floorLabel(venue.floor)} · {venue.capacity} seats</p>
          </div>
        </div>
        <Field label="Date" hint={`Up to ${rules.maxAdvanceDays} days ahead`}>
          {(p) => (
            <Input {...p} type="date" min={today} max={addDays(today, rules.maxAdvanceDays)} value={slot.date} onChange={(e) => onChange({ date: e.target.value })} />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts">
            {(p) => (
              <Select {...p} value={slot.startTime} onChange={(e) => {
                const start = e.target.value
                const keepEnd = slot.endTime && toMinutes(slot.endTime) > toMinutes(start)
                onChange({ startTime: start, endTime: keepEnd ? slot.endTime : options[Math.min(options.indexOf(start) + 4, options.length - 1)] })
              }}
              >
                <option value="" disabled>Start</option>
                {startOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Ends">
            {(p) => (
              <Select {...p} value={slot.endTime} onChange={(e) => onChange({ endTime: e.target.value })} disabled={!slot.startTime}>
                <option value="" disabled>End</option>
                {endOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </Field>
        </div>
        {slot.startTime && slot.endTime && (
          <p className="flex items-center gap-1.5 text-sm text-zinc-500">
            <Clock className="size-4" aria-hidden /> {durationLabel(slot.startTime, slot.endTime)} · venues open {rules.openingTime}–{rules.closingTime}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {slot.date && <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{formatLongDate(slot.date)}</p>}
        {status.state === 'idle' ? (
          <div className="flex gap-3 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> Pick a date, start and end time. Availability updates as you choose.
          </div>
        ) : (
          <AvailabilityPanel status={status} onPick={(s) => onChange(s)} />
        )}
        <Link to={`/venues/${venue.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
          See this venue&apos;s week calendar
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: event details + review
// ---------------------------------------------------------------------------

function DetailsStep({ user, venue, slot, details, onChange, clubs, errors, existing }) {
  const faculty = isFaculty(user)
  const set = (key) => (e) => onChange({ [key]: e.target.value })

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Field label="Event title" error={errors.title}>
          {(p) => <Input {...p} value={details.title} onChange={set('title')} placeholder="Hack Night 2026" error={errors.title} autoFocus />}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" error={errors.category}>
            {(p) => (
              <Select {...p} value={details.category} onChange={set('category')}>
                <option value="" disabled>Choose</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Expected attendance" error={errors.expectedAttendance} hint={`${venue.name} holds ${venue.capacity}`}>
            {(p) => (
              <Input {...p} type="number" min="1" max={venue.capacity} value={details.expectedAttendance} onChange={set('expectedAttendance')} error={errors.expectedAttendance} />
            )}
          </Field>
        </div>

        {existing ? (
          <div>
            <p className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Organising club</p>
            <p className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2.5 text-sm dark:bg-zinc-800/60">
              <Flag className="size-4 text-zinc-400" aria-hidden />
              {existing.event.club?.name ?? 'Official event'}
              <span className="ml-auto text-xs text-zinc-500">Can&apos;t be changed</span>
            </p>
          </div>
        ) : (
          <Field label={faculty ? 'Organising club' : 'Your club'} error={errors.clubId} optional={faculty}>
            {(p) => (
              <Select {...p} value={details.clubId} onChange={set('clubId')} error={errors.clubId}>
                {faculty ? <option value="">No club — official event</option> : <option value="" disabled>Choose your club</option>}
                {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}{c.scope === 'COLLEGE' ? ' (college-level)' : ''}</option>)}
              </Select>
            )}
          </Field>
        )}

        {!existing && user.role.key === 'SUPER_ADMIN' && !details.clubId && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Event level</legend>
            <div className="grid grid-cols-2 gap-2">
              {[['COLLEGE', 'College-wide'], ['DEPARTMENT', 'My department']].map(([value, label]) => (
                <label key={value} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm', details.scope === value ? 'border-brand-500 ring-1 ring-brand-500' : 'border-zinc-200 dark:border-zinc-700')}>
                  <input type="radio" name="scope" value={value} checked={details.scope === value} onChange={set('scope')} className="accent-brand-600" /> {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <Field label="Description" optional error={errors.description}>
          {(p) => <Textarea {...p} value={details.description} onChange={set('description')} placeholder="What is it, who is it for, anything the venue team should know" />}
        </Field>
      </div>

      <Card className="h-fit p-5">
        <h2 className="text-sm font-semibold">Summary</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex gap-3"><MapPin className="size-4 shrink-0 text-zinc-400" aria-hidden /><dd>{venue.name}<span className="block text-zinc-500">{venue.building} · {floorLabel(venue.floor)}</span></dd></div>
          <div className="flex gap-3"><CalendarClock className="size-4 shrink-0 text-zinc-400" aria-hidden /><dd>{formatLongDate(slot.date)}<span className="block text-zinc-500">{formatTimeRange(slot.startTime, slot.endTime)}</span></dd></div>
          <div className="flex gap-3"><Users2 className="size-4 shrink-0 text-zinc-400" aria-hidden /><dd>{details.expectedAttendance || '—'} expected</dd></div>
        </dl>
        <div className="mt-5 rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400">
          {existing
            ? 'Resubmitting sends this back to the approver as a new version. Until they decide, another club may still request the same time.'
            : faculty
              ? 'As faculty, this is booked immediately. Any pending requests that overlap it will be declined automatically.'
              : 'This goes to your department coordinator for approval. The slot shows as pending until then, and another club may request the same time.'}
        </div>
      </Card>
    </div>
  )
}

/** Resolves a venue id into its full entry, including building and floor. */
function findVenue(meta, venueId) {
  if (!meta || !venueId) return null
  for (const b of meta.buildings) {
    for (const f of b.floors) {
      const v = f.venues.find((x) => x.id === venueId)
      if (v) return { ...v, building: b.name, floor: f.floor }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** True when two same-day HH:MM windows overlap. */
function overlaps(a, b) {
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)
}

export default function NewBookingPage() {
  useDocumentTitle('Book a venue')
  return <BookingWizard />
}

/**
 * The three-step booking flow. With `existing`, it edits an open request
 * instead (FR13 resubmission): prefilled, starting at the time step, with
 * the organising club locked.
 */
export function BookingWizard({ existing = null }) {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const faculty = isFaculty(user)
  const editing = Boolean(existing)

  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState(null)
  const [step, setStep] = useState(editing ? 1 : 0)
  const [selection, setSelection] = useState({
    building: null,
    floor: null,
    venueId: existing?.venue.id ?? (params.get('venueId') ? Number(params.get('venueId')) : null),
  })
  const [slot, setSlot] = useState(existing
    ? { date: existing.date, startTime: existing.startTime, endTime: existing.endTime }
    : { date: params.get('date') || '', startTime: params.get('start') || '', endTime: '' })
  const [details, setDetails] = useState(existing
    ? {
      title: existing.event.title, category: existing.event.category, expectedAttendance: String(existing.event.expectedAttendance ?? ''),
      clubId: existing.event.club?.id ?? '', description: existing.event.description ?? '', scope: existing.event.scope,
    }
    : { title: '', category: '', expectedAttendance: '', clubId: '', description: '', scope: 'COLLEGE' })
  const [facultyClubs, setFacultyClubs] = useState([])
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    venuesApi.meta().then(setMeta).catch(setMetaError)
    if (faculty && !editing) bookingsApi.appointableClubs().then(setFacultyClubs).catch(() => {})
  }, [faculty, editing])

  // Resolve a venue id from the URL into its building and floor.
  const venue = findVenue(meta, selection.venueId)

  const effectiveSelection = venue && !selection.building ? { ...selection, building: venue.building, floor: venue.floor } : selection

  // Prefilled start from the calendar: default a two-hour window.
  const effectiveSlot = slot.startTime && !slot.endTime && meta
    ? { ...slot, endTime: timeOptions(meta.rules.openingTime, meta.rules.closingTime).find((t) => toMinutes(t) === Math.min(toMinutes(slot.startTime) + 120, toMinutes(meta.rules.closingTime))) || '' }
    : slot

  const clubs = faculty ? facultyClubs : (user.clubs || []).filter((c) => c.isHead)

  // Live availability, debounced so rapid changes send one request.
  const slotKey = venue && effectiveSlot.date && effectiveSlot.startTime && effectiveSlot.endTime
    ? `${venue.id}|${effectiveSlot.date}|${effectiveSlot.startTime}|${effectiveSlot.endTime}`
    : null
  const debouncedKey = useDebouncedValue(slotKey, 250)
  const [check, setCheck] = useState({ key: null, state: 'idle' })

  useEffect(() => {
    if (!debouncedKey) return undefined
    const [venueId, date, startTime, endTime] = debouncedKey.split('|')
    const controller = new AbortController()
    venuesApi.check({ venueId: Number(venueId), date, startTime, endTime }, { signal: controller.signal })
      .then((result) => setCheck({ key: debouncedKey, state: 'done', result }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        if (err.status === 422) setCheck({ key: debouncedKey, state: 'invalid', messages: (err.details || []).map((d) => d.message) })
        else setCheck({ key: debouncedKey, state: 'error', message: err.message })
      })
    return () => controller.abort()
  }, [debouncedKey])

  const rawStatus = !slotKey ? { state: 'idle' } : check.key === slotKey ? check : { state: 'checking' }
  // The request being edited is itself pending, so it would count as its own competitor.
  const selfCompeting = editing && rawStatus.state === 'done' && venue?.id === existing.venue.id
    && effectiveSlot.date === existing.date && overlaps(effectiveSlot, existing)
  const status = selfCompeting
    ? { ...rawStatus, result: { ...rawStatus.result, competingRequests: Math.max(rawStatus.result.competingRequests - 1, 0) } }
    : rawStatus
  const slotOk = status.state === 'done' && status.result.available

  function validateDetails() {
    const found = {}
    if (details.title.trim().length < 3) found.title = 'Give the event a title (3+ characters)'
    if (!details.category) found.category = 'Choose a category'
    const n = Number(details.expectedAttendance)
    if (!Number.isInteger(n) || n < 1) found.expectedAttendance = 'Enter how many people you expect'
    else if (n > venue.capacity) found.expectedAttendance = `${venue.name} holds ${venue.capacity}`
    if (!faculty && !editing && !details.clubId) found.clubId = 'Choose the club organising this'
    return found
  }

  async function submit() {
    const found = validateDetails()
    setErrors(found)
    if (Object.keys(found).length) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      if (editing) {
        await bookingsApi.update(existing.id, {
          venueId: venue.id,
          ...effectiveSlot,
          title: details.title.trim(),
          category: details.category,
          expectedAttendance: Number(details.expectedAttendance),
          description: details.description.trim(),
        })
        toast.success('Request resubmitted', 'It is back with the approver.')
        markSummaryStale()
        navigate(`/bookings?focus=${existing.id}`, { replace: true })
        return
      }
      const booking = await bookingsApi.create({
        venueId: venue.id,
        ...effectiveSlot,
        title: details.title.trim(),
        category: details.category,
        expectedAttendance: Number(details.expectedAttendance),
        description: details.description.trim() || null,
        clubId: details.clubId ? Number(details.clubId) : null,
        ...(user.role.key === 'SUPER_ADMIN' && !details.clubId ? { scope: details.scope } : {}),
      })
      if (booking.status === 'APPROVED') toast.success('Venue booked', `${venue.name}, ${formatTimeRange(booking.startTime, booking.endTime)}`)
      else toast.success('Request sent for approval', 'You will see the decision in My bookings.')
      navigate('/bookings', { replace: true })
    } catch (err) {
      setSubmitting(false)
      if (err.code === 'SLOT_UNAVAILABLE') {
        // Someone took the slot while this form was open: back to the time step.
        setCheck({ key: slotKey, state: 'done', result: { available: false, bufferMinutes: venue.bufferMinutes ?? meta.rules.defaultBufferMinutes, competingRequests: 0, ...err.details } })
        setStep(1)
        toast.error('That slot was just booked', 'Pick one of the free times instead.')
        return
      }
      if (Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors)
      else setSubmitError(err)
    }
  }

  if (metaError) return <Alert tone="error" title="Could not load venues">{metaError.message}</Alert>

  const canContinue = step === 0 ? Boolean(venue) : step === 1 ? slotOk : true

  return (
    <>
      <Link to={editing ? '/bookings' : '/venues'} className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        <ArrowLeft className="size-4" aria-hidden /> {editing ? 'Bookings' : 'Venues'}
      </Link>
      <PageHeader
        title={editing ? 'Edit request' : 'Book a venue'}
        description={editing
          ? 'Change the venue, time or details, then resubmit it for approval.'
          : faculty ? 'Faculty bookings are confirmed immediately.' : 'Your request goes to your department coordinator for approval.'}
      />

      {existing?.status === 'MODIFICATION_REQUESTED' && existing.modificationNote && (
        <div className="mb-6 flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200" role="status">
          <MessageSquareWarning className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">{existing.decidedBy?.fullName ?? 'The approver'} asked for changes</p>
            <p className="text-sm opacity-90">{existing.modificationNote}</p>
          </div>
        </div>
      )}

      <Stepper step={step} />

      <Card className="p-5 sm:p-8">
        {!meta ? (
          <div className="space-y-3" aria-label="Loading venues"><Skeleton className="h-6 w-40" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
        ) : step === 0 ? (
          <VenueStep meta={meta} selection={effectiveSelection} onChange={(c) => setSelection({ ...effectiveSelection, ...c })} />
        ) : step === 1 ? (
          <TimeStep venue={{ ...venue, bufferMinutes: meta.rules.defaultBufferMinutes }} rules={meta.rules} slot={effectiveSlot} status={status} onChange={(c) => setSlot({ ...effectiveSlot, ...c })} />
        ) : (
          <>
            {submitError && <Alert tone="error" className="mb-6">{submitError.message}</Alert>}
            <DetailsStep user={user} venue={venue} slot={effectiveSlot} details={details} onChange={(c) => setDetails({ ...details, ...c })} clubs={clubs} errors={errors} existing={existing} />
          </>
        )}

        {meta && (
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-zinc-100 pt-6 sm:flex-row sm:justify-between dark:border-zinc-800">
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || submitting}>
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
            {step < 2 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canContinue}>
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={submit} loading={submitting}>
                {editing ? 'Resubmit request' : faculty ? 'Book venue' : 'Send request'}
              </Button>
            )}
          </div>
        )}
      </Card>
    </>
  )
}
