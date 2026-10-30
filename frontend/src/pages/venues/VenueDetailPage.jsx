import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, ChevronLeft, ChevronRight, Layers, MapPin, Pencil, Timer, Users2 } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { venuesApi, VENUE_TYPE_LABELS, floorLabel, equipmentLabel } from '@/features/venues/venuesApi'
import { canBook } from '@/features/bookings/bookingsApi'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Alert, Badge, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/Surface'
import { VenueIcon } from '@/components/venues/VenueVisual'
import { CalendarLegend, WeekCalendar } from '@/components/venues/WeekCalendar'
import { VenueFormDialog } from '@/components/venues/VenueFormDialog'
import { addDays, campusToday, formatDayLabel, startOfWeek } from '@/lib/campusTime'
import { useDocumentTitle } from '@/lib/hooks'

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800"><Icon className="size-4" aria-hidden /></span>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  )
}

export default function VenueDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [venue, setVenue] = useState(null)
  const [error, setError] = useState(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(campusToday()))
  const [calendar, setCalendar] = useState({ key: null, data: null, error: null })
  const [editing, setEditing] = useState(false)
  const [version, setVersion] = useState(0)
  useDocumentTitle(venue?.name || 'Venue')

  useEffect(() => {
    let active = true
    venuesApi.get(id).then((v) => active && setVenue(v)).catch((err) => active && setError(err))
    return () => { active = false }
  }, [id, version])

  const calendarKey = `${id}:${weekStart}:${version}`
  useEffect(() => {
    const controller = new AbortController()
    venuesApi.availability(id, weekStart, addDays(weekStart, 6), { signal: controller.signal })
      .then((data) => setCalendar({ key: calendarKey, data, error: null }))
      .catch((err) => err.name !== 'AbortError' && setCalendar({ key: calendarKey, data: null, error: err }))
    return () => controller.abort()
  }, [id, weekStart, calendarKey])

  const back = (
    <Link to="/venues" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
      <ArrowLeft className="size-4" aria-hidden /> All venues
    </Link>
  )

  if (error) {
    return <>{back}<Card><EmptyState icon={MapPin} title="Venue not found" description="It may have been removed or deactivated." /></Card></>
  }
  if (!venue) {
    return <>{back}<Skeleton className="h-40 rounded-2xl" /><Skeleton className="mt-6 h-96 rounded-2xl" /></>
  }

  const bookable = canBook(user) && venue.isActive
  const rules = calendar.data?.rules
  const calendarLoading = calendar.key !== calendarKey
  const thisWeek = startOfWeek(campusToday())

  return (
    <>
      {back}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <VenueIcon type={venue.type} className="size-14 rounded-2xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{venue.name}</h1>
                {!venue.isActive && <Badge tone="rose">Inactive</Badge>}
              </div>
              <p className="mt-1 flex items-center gap-1 text-sm text-zinc-500">
                <MapPin className="size-3.5" aria-hidden /> {venue.location || `${venue.building}, ${floorLabel(venue.floor)}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {venue.canManage && (
              <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" aria-hidden /> Edit</Button>
            )}
            {bookable && (
              <Link to={`/bookings/new?venueId=${venue.id}`} className={buttonClasses()}>
                <CalendarPlus className="size-4" aria-hidden /> Book this venue
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-zinc-100 pt-5 sm:grid-cols-4 dark:border-zinc-800">
          <Stat icon={Users2} label="Capacity" value={`${venue.capacity} seats`} />
          <Stat icon={Layers} label="Type" value={VENUE_TYPE_LABELS[venue.type]} />
          <Stat icon={MapPin} label="Where" value={`${venue.building} · ${floorLabel(venue.floor)}`} />
          <Stat icon={Timer} label="Buffer" value={`${venue.bufferMinutes} min`} />
        </div>

        {venue.equipment.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {venue.equipment.map((item) => <Badge key={item}>{equipmentLabel(item)}</Badge>)}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Availability"
          description={`${formatDayLabel(weekStart)} – ${formatDayLabel(addDays(weekStart, 6))}${bookable ? ' · click a free time to book it' : ''}`}
          action={(
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setWeekStart(thisWeek)} disabled={weekStart === thisWeek}>This week</Button>
              <Button variant="secondary" size="sm" onClick={() => setWeekStart(addDays(weekStart, -7))} disabled={weekStart <= thisWeek} aria-label="Previous week">
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          )}
        />
        <div className="px-4 pt-3 sm:px-6"><CalendarLegend bufferMinutes={venue.bufferMinutes} /></div>
        {calendar.error ? (
          <div className="p-6"><Alert tone="error">{calendar.error.message}</Alert></div>
        ) : (
          <div className={calendarLoading ? 'p-2 opacity-50 transition-opacity sm:p-4' : 'p-2 transition-opacity sm:p-4'} aria-busy={calendarLoading}>
            <WeekCalendar
              weekStart={weekStart}
              blocks={calendar.data?.blocks ?? []}
              openingTime={rules?.openingTime ?? '07:00'}
              closingTime={rules?.closingTime ?? '21:00'}
              onSelectSlot={bookable ? (date, time) => navigate(`/bookings/new?venueId=${venue.id}&date=${date}&start=${time}`) : undefined}
            />
          </div>
        )}
      </Card>

      {editing && (
        <VenueFormDialog
          venue={venue}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); setVersion((v) => v + 1) }}
        />
      )}
    </>
  )
}
