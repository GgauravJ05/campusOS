import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BarChart3, CalendarDays, UsersRound } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { dashboardApi } from '@/features/reports/reportsApi'
import { Alert, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/Surface'
import { RoleBadge, ScopeBadge } from '@/components/RoleBadge'
import { DateChip } from '@/components/events/EventCard'
import { firstName, formatRelative, greeting, isFaculty, ROLE_META } from '@/lib/utils'
import { formatTimeRange } from '@/lib/campusTime'
import { useDocumentTitle } from '@/lib/hooks'

/**
 * FR18: a dedicated, role-tailored dashboard.
 *
 * The metrics and the schedule come from the API, which decides what each
 * role should see. This screen renders whatever it is handed rather than
 * deciding for itself, so adding a metric never means releasing both sides.
 */

function MetricTile({ metric }) {
  const body = (
    <>
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{metric.label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{metric.value}</p>
    </>
  )
  const base = 'block h-full rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900/60'

  if (!metric.href) return <li className={base}>{body}</li>
  return (
    <li>
      <Link to={metric.href} className={`${base} transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lift dark:hover:border-zinc-700`}>
        {body}
        <span className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
          Open <ArrowUpRight className="size-3" aria-hidden />
        </span>
      </Link>
    </li>
  )
}

function ScheduleRow({ item }) {
  return (
    <li>
      <Link
        to={`/events/${item.eventId}`}
        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50 sm:px-6 dark:hover:bg-zinc-800/60"
      >
        <DateChip date={item.date} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="truncate text-xs text-zinc-500">
            {formatTimeRange(item.startTime, item.endTime)} · {item.venue}
            {item.club && ` · ${item.club}`}
          </p>
        </div>
        {item.seatsLeft !== null && (
          <span className="shrink-0 text-xs text-zinc-500 tabular-nums">{item.seatsLeft} left</span>
        )}
      </Link>
    </li>
  )
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const faculty = isFaculty(user)
  const headed = user.clubs?.filter((c) => c.isHead) ?? []
  const [state, setState] = useState({ loaded: false, data: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    dashboardApi.get({ signal: controller.signal })
      .then((data) => setState({ loaded: true, data, error: null }))
      .catch((err) => err.name !== 'AbortError' && setState({ loaded: true, data: null, error: err }))
    return () => controller.abort()
  }, [])

  const { data } = state

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-violet-700 p-6 text-white shadow-lift sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-violet-400/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-brand-100">{greeting()}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{firstName(user.fullName)} 👋</h1>
            <p className="mt-2 max-w-xl text-brand-100">{ROLE_META[user.role.key]?.description}</p>
          </div>
          {faculty && (
            <Link
              to="/reports"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-brand-700 shadow-sm transition-colors hover:bg-brand-50"
            >
              <BarChart3 className="size-4" aria-hidden /> Reports
            </Link>
          )}
        </div>
      </section>

      {state.error && <Alert tone="error" title="Could not load your dashboard">{state.error.message}</Alert>}

      {!state.loaded ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading metrics">
          {[1, 2, 3, 4].map((i) => <li key={i}><Skeleton className="h-28 rounded-2xl" /></li>)}
        </ul>
      ) : data ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.metrics.map((metric) => <MetricTile key={metric.key} metric={metric} />)}
        </ul>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title={data?.schedule.title ?? 'What is next'}
            description="Times are campus time."
            action={<Link to="/events" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">All events</Link>}
          />
          {!state.loaded ? (
            <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
          ) : data?.schedule.items.length ? (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.schedule.items.map((item) => <ScheduleRow key={item.eventId} item={item} />)}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Nothing scheduled yet"
              description={faculty ? 'Events appear here once a venue is booked.' : 'Reserve a seat and your events show up here.'}
              className="py-10"
            />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Your clubs" description={headed.length ? `You lead ${headed.length} club${headed.length > 1 ? 's' : ''}.` : 'Clubs you belong to.'} />
          {user.clubs?.length ? (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {user.clubs.map((club) => (
                <li key={club.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span className="grid size-9 place-items-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {club.name[0]}
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
            <EmptyState
              icon={UsersRound}
              title="No clubs yet"
              description="When a faculty coordinator adds you to a club, it shows up here."
              className="py-10"
            />
          )}
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:px-6">
        <div className="flex items-center gap-3">
          <RoleBadge role={user.role} />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Signed in as <span className="font-medium text-zinc-800 dark:text-zinc-200">{user.email}</span>
            {user.lastLoginAt && <> · last sign-in {formatRelative(user.lastLoginAt)}</>}
          </p>
        </div>
        <Link to="/profile" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
          Profile & security <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </Card>
    </div>
  )
}
