/**
 * Campus calendar helpers. The campus runs on Asia/Kolkata (UTC+05:30, no
 * daylight saving); the API speaks campus-local 'YYYY-MM-DD' and 'HH:MM', so
 * the UI does too, whatever timezone the viewer's laptop is set to.
 */

const IST_OFFSET_MS = 330 * 60 * 1000

/** Today's date on campus. */
export function campusToday(now = new Date()) {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Monday of the week containing `date`. */
export function startOfWeek(date) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(date, weekday === 0 ? -6 : 1 - weekday)
}

export function toMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** '14:30' -> '2:30 pm' */
export function formatTime(time) {
  const minutes = toMinutes(time)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatTimeRange(start, end) {
  return `${formatTime(start)} – ${formatTime(end)}`
}

const parts = (date) => new Date(`${date}T12:00:00Z`)

/** 'Mon, 15 Sept' */
export function formatDayLabel(date) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parts(date))
}

/** 'Monday, 15 September 2026' */
export function formatLongDate(date) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parts(date))
}

export function dayOfMonth(date) {
  return Number(date.slice(8, 10))
}

export function shortMonth(date) {
  return new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(parts(date))
}

/** Every 'HH:MM' from `open` to `close` inclusive, in `step`-minute increments. */
export function timeOptions(open, close, step = 15) {
  const options = []
  for (let m = toMinutes(open); m <= toMinutes(close); m += step) options.push(fromMinutes(m))
  return options
}

export function durationLabel(start, end) {
  const minutes = toMinutes(end) - toMinutes(start)
  if (minutes <= 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ')
}
