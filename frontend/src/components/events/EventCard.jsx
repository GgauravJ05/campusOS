import { Link } from 'react-router-dom'
import { MapPin, Users2 } from 'lucide-react'
import { CATEGORY_LABELS } from '@/features/bookings/bookingsApi'
import { EVENT_STATUS_META, REGISTRATION_STATUS_META, seatFraction, seatsLeftLabel } from '@/features/events/eventsApi'
import { Badge } from '@/components/ui/Surface'
import { dayOfMonth, formatTimeRange, shortMonth } from '@/lib/campusTime'
import { cn } from '@/lib/utils'

/** The date block on the left of a card - the thing people scan for. */
export function DateChip({ date, className }) {
  return (
    <time
      dateTime={date}
      className={cn('grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300', className)}
      aria-hidden
    >
      <span className="text-[10px] font-semibold tracking-wide uppercase">{shortMonth(date)}</span>
      <span className="-mt-0.5 text-lg leading-none font-semibold tabular-nums">{dayOfMonth(date)}</span>
    </time>
  )
}

/**
 * How full an event is. Turns amber as it fills and rose when it is gone, so
 * "nearly full" reads at a glance rather than needing the numbers.
 */
export function SeatMeter({ event, className }) {
  const fraction = seatFraction(event)
  if (event.maxSeats === null) return null
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-[width]',
          event.isFull ? 'bg-rose-500' : fraction > 0.8 ? 'bg-amber-500' : 'bg-emerald-500',
        )}
        style={{ width: `${Math.max(fraction * 100, event.bookedSeats > 0 ? 4 : 0)}%` }}
        role="progressbar"
        aria-valuenow={event.bookedSeats}
        aria-valuemin={0}
        aria-valuemax={event.maxSeats}
        aria-label={`${event.bookedSeats} of ${event.maxSeats} seats taken`}
      />
    </div>
  )
}

/**
 * One event in the feed.
 *
 * @param {{ event: object, reason?: string }} props `reason` is the
 *        recommendation explanation (FR17), shown only on the rail.
 */
export function EventCard({ event, reason }) {
  const status = EVENT_STATUS_META[event.status]
  const mine = event.myRegistration && REGISTRATION_STATUS_META[event.myRegistration.status]

  return (
    <li>
      <article className="h-full">
      <Link
        to={`/events/${event.id}`}
        className="flex h-full flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lift dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
      >
        <div className="flex items-start gap-3">
          <DateChip date={event.date} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold tracking-tight">{event.title}</h3>
            <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
              {event.club?.name ?? event.department?.name ?? 'College event'}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="brand">{CATEGORY_LABELS[event.category]}</Badge>
          {mine && <Badge tone={mine.tone} dot>{mine.label}</Badge>}
          {event.status !== 'PUBLISHED' && <Badge tone={status.tone}>{status.label}</Badge>}
          {event.status === 'PUBLISHED' && event.isFull && !mine && <Badge tone="rose">Full</Badge>}
          {event.eligibility.ineligibleReason && !mine && <Badge tone="zinc">Not open to you</Badge>}
        </div>

        {reason && <p className="mt-3 text-sm text-brand-700 dark:text-brand-300">{reason}</p>}

        <dl className="mt-3 flex-1 space-y-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Time</dt>
            <dd>{formatTimeRange(event.startTime, event.endTime)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Venue</dt>
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <dd className="truncate">{event.venue?.name ?? 'Venue to be announced'}</dd>
          </div>
        </dl>

        <figure className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <SeatMeter event={event} className="mb-2" />
          <figcaption className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <Users2 className="size-3.5" aria-hidden />
            {seatsLeftLabel(event)}
          </figcaption>
        </figure>
      </Link>
      </article>
    </li>
  )
}
