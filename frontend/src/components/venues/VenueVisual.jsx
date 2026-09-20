import { Building2, Dumbbell, FlaskConical, Mic2, Presentation, School, Theater, Trees } from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_STYLE = {
  AUDITORIUM: { icon: Theater, gradient: 'from-indigo-500 to-fuchsia-500' },
  SEMINAR_HALL: { icon: Mic2, gradient: 'from-brand-500 to-indigo-500' },
  LABORATORY: { icon: FlaskConical, gradient: 'from-sky-500 to-cyan-500' },
  CLASSROOM: { icon: School, gradient: 'from-emerald-500 to-teal-500' },
  CONFERENCE_ROOM: { icon: Presentation, gradient: 'from-amber-500 to-orange-500' },
  SPORTS_GROUND: { icon: Dumbbell, gradient: 'from-lime-500 to-emerald-600' },
  OPEN_AIR: { icon: Trees, gradient: 'from-teal-500 to-green-600' },
}

function venueTypeStyle(type) {
  return TYPE_STYLE[type] || { icon: Building2, gradient: 'from-zinc-500 to-zinc-600' }
}

export function VenueIcon({ type, className }) {
  const { icon: Icon, gradient } = venueTypeStyle(type)
  return (
    <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm', gradient, className)} aria-hidden>
      <Icon className="size-5" />
    </span>
  )
}
