import { Link } from 'react-router-dom'
import {
  ArrowUpRight, BarChart3, BellRing, Building2, CalendarDays, CheckCircle2, ClipboardCheck, Crown, GraduationCap, MapPin, UsersRound,
} from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { Card, CardHeader, EmptyState } from '@/components/ui/Surface'
import { RoleBadge, ScopeBadge } from '@/components/RoleBadge'
import { academicYearLabel, firstName, formatRelative, greeting, isFaculty, ROLE_META } from '@/lib/utils'
import { useDocumentTitle } from '@/lib/hooks'

/** What is live today and what each upcoming phase adds - honest, no placeholder data. */
const ROADMAP = [
  { phase: 1, title: 'Accounts & roles', icon: CheckCircle2, text: 'Sign-up, verification, secure sessions, promotions.', live: true },
  { phase: 2, title: 'Venues & scheduling', icon: MapPin, text: 'Find rooms by building, floor and equipment. Zero double bookings.', live: true },
  { phase: 3, title: 'Approvals & clubs', icon: ClipboardCheck, text: 'Approve, reject or send back requests. Clubs run their own teams.', live: true },
  { phase: 4, title: 'Events & RSVP', icon: CalendarDays, text: 'Discover events by category and reserve your seat.' },
  { phase: 5, title: 'Reminders', icon: BellRing, text: 'Automatic notifications two days and two hours before.' },
  { phase: 6, title: 'Analytics & audit', icon: BarChart3, text: 'Attendance insights and an immutable audit trail.' },
]

function StatTile({ icon: Icon, label, value, hint }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</p>
          <p className="truncate text-base font-semibold">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </Card>
  )
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { user } = useAuth()
  const faculty = isFaculty(user)
  const headed = user.clubs?.filter((c) => c.isHead) ?? []

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-violet-700 p-6 text-white shadow-lift sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-72 rounded-full bg-violet-400/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-brand-100">{greeting()}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{firstName(user.fullName)} 👋</h1>
            <p className="mt-2 max-w-xl text-brand-100">
              {ROLE_META[user.role.key]?.description}
            </p>
          </div>
          {faculty && (
            <Link
              to="/users"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-brand-700 shadow-sm transition-colors hover:bg-brand-50"
            >
              <UsersRound className="size-4" aria-hidden /> Manage people
            </Link>
          )}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Crown} label="Role" value={ROLE_META[user.role.key]?.short} />
        <StatTile icon={Building2} label="Department" value={user.department?.code ?? 'College'} />
        <StatTile icon={GraduationCap} label="Year" value={user.academicYear ? academicYearLabel(user.academicYear).split(' (')[0] : '—'} />
        <StatTile icon={UsersRound} label="Clubs" value={user.clubs?.length ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
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

        <Card className="lg:col-span-3">
          <CardHeader title="What's coming to CampusOS" description="Built in phases. Each goes live here as soon as it ships." />
          <ol className="grid gap-px overflow-hidden rounded-b-2xl bg-zinc-100 sm:grid-cols-2 dark:bg-zinc-800">
            {ROADMAP.map(({ phase, title, icon: Icon, text, live }) => (
              <li key={phase} className="flex gap-3 bg-white p-5 dark:bg-zinc-900">
                <span className={live
                  ? 'grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}
                >
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {title}
                    <span className={live ? 'text-[11px] font-medium text-emerald-600 dark:text-emerald-400' : 'text-[11px] font-medium text-zinc-400'}>
                      {live ? 'Live' : `Phase ${phase}`}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{text}</p>
                </div>
              </li>
            ))}
          </ol>
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
