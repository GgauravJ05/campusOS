import { addDays, campusToday, dayOfMonth, formatTime, formatTimeRange, toMinutes } from '@/lib/campusTime'
import { cn } from '@/lib/utils'

const HOUR_PX = 48

const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' })

/**
 * A week of venue availability (FR7, FR12 colours): booked slots red,
 * pending requests amber, the viewer's own requests outlined. Empty space
 * is clickable to start a booking at that time.
 *
 * @param {{ weekStart: string, blocks: Array, openingTime: string, closingTime: string,
 *           onSelectSlot?: (date: string, time: string) => void }} props
 */
export function WeekCalendar({ weekStart, blocks, openingTime, closingTime, onSelectSlot }) {
  const open = toMinutes(openingTime)
  const close = toMinutes(closingTime)
  const firstHour = Math.floor(open / 60)
  const lastHour = Math.ceil(close / 60)
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = campusToday()
  const height = hours.length * HOUR_PX

  const top = (time) => ((toMinutes(time) - firstHour * 60) / 60) * HOUR_PX

  function handleColumnClick(date, event) {
    if (!onSelectSlot) return
    const rect = event.currentTarget.getBoundingClientRect()
    const minutes = firstHour * 60 + Math.floor(((event.clientY - rect.top) / HOUR_PX) * 4) * 15
    const clamped = Math.min(Math.max(minutes, open), close - 30)
    onSelectSlot(date, `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`)
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-zinc-100 dark:border-zinc-800">
          <div />
          {days.map((date) => {
            const isToday = date === today
            return (
              <div key={date} className="px-2 py-3 text-center">
                <p className={cn('text-xs font-medium tracking-wide uppercase', isToday ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-500')}>
                  {WEEKDAY.format(new Date(`${date}T12:00:00Z`))}
                </p>
                <p className={cn(
                  'mx-auto mt-1 grid size-8 place-items-center rounded-full text-sm font-semibold tabular-nums',
                  isToday && 'bg-brand-600 text-white dark:bg-brand-500',
                )}
                >
                  {dayOfMonth(date)}
                </p>
              </div>
            )
          })}
        </div>

        <div className="relative grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height }}>
          <div className="relative">
            {hours.map((hour, i) => (
              <span key={hour} className="absolute right-2 -translate-y-2 text-[11px] text-zinc-400 tabular-nums" style={{ top: i * HOUR_PX }}>
                {i === 0 ? '' : formatTime(`${String(hour).padStart(2, '0')}:00`)}
              </span>
            ))}
          </div>

          {days.map((date) => {
            const past = date < today
            const dayBlocks = blocks.filter((b) => b.date === date)
            return (
              <div
                key={date}
                data-testid={`day-${date}`}
                className={cn(
                  'relative border-l border-zinc-100 dark:border-zinc-800',
                  past ? 'bg-zinc-50/80 dark:bg-zinc-900/40' : onSelectSlot && 'cursor-cell hover:bg-brand-50/30 dark:hover:bg-brand-500/5',
                )}
                onClick={past ? undefined : (e) => handleColumnClick(date, e)}
              >
                {hours.map((hour, i) => (
                  <div key={hour} className="absolute inset-x-0 border-t border-zinc-100 dark:border-zinc-800/80" style={{ top: i * HOUR_PX }} aria-hidden />
                ))}

                {dayBlocks.map((block) => {
                  const booked = block.status === 'BOOKED'
                  const blockTop = top(block.startTime)
                  const blockHeight = Math.max(top(block.endTime) - blockTop, 22)
                  const label = booked ? (block.title || 'Booked') : block.title || 'Approval pending'
                  return (
                    <div
                      key={block.bookingId}
                      role="note"
                      aria-label={`${booked ? 'Booked' : 'Pending approval'}: ${label}, ${formatTimeRange(block.startTime, block.endTime)}`}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-[11px] leading-tight shadow-sm',
                        booked
                          ? 'bg-rose-500 text-white dark:bg-rose-600'
                          : 'border border-dashed border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/20 dark:text-amber-100',
                        block.mine && 'ring-2 ring-brand-500 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900',
                      )}
                      style={{ top: blockTop + 1, height: blockHeight - 2 }}
                    >
                      <p className="truncate font-semibold">{label}</p>
                      {blockHeight > 34 && <p className="truncate opacity-90">{formatTimeRange(block.startTime, block.endTime)}</p>}
                      {blockHeight > 50 && block.club && <p className="truncate opacity-80">{block.club}</p>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function CalendarLegend({ bufferMinutes }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-rose-500" aria-hidden /> Booked</span>
      <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-dashed border-amber-400 bg-amber-100" aria-hidden /> Approval pending (others may still request)</span>
      <span className="flex items-center gap-1.5"><span className="size-3 rounded ring-2 ring-brand-500" aria-hidden /> Your request</span>
      {bufferMinutes != null && <span>{bufferMinutes} min setup / teardown between bookings</span>}
    </div>
  )
}
