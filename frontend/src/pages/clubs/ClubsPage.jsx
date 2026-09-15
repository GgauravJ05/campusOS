import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Crown, Flag, Plus, Search, Users2 } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { clubsApi, positionLabel } from '@/features/clubs/clubsApi'
import { PageHeader } from '@/components/layout/AppShell'
import { ClubFormDialog } from '@/components/clubs/ClubDialogs'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Alert, Avatar, Badge, Card, EmptyState, Skeleton } from '@/components/ui/Surface'
import { cn, isFaculty } from '@/lib/utils'
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks'

function Toggle({ pressed, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
        pressed ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800',
      )}
    >
      {children}
    </button>
  )
}

function ClubCard({ club }) {
  return (
    <li>
      <Link
        to={`/clubs/${club.id}`}
        className={cn(
          'flex h-full flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lift dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700',
          !club.isActive && 'opacity-70',
        )}
      >
        <div className="flex items-start gap-3">
          <Avatar name={club.name} size="md" className="rounded-xl" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold tracking-tight">{club.name}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {club.scope === 'COLLEGE' ? <Badge tone="violet">College-level</Badge> : <Badge>{club.department?.code}</Badge>}
              {!club.isActive && <Badge tone="rose" dot>Disabled</Badge>}
              {club.myPosition && <Badge tone="brand">You: {positionLabel(club.myPosition)}</Badge>}
            </div>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 flex-1 text-sm text-zinc-500 dark:text-zinc-400">{club.description || 'No description yet.'}</p>
        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-sm text-zinc-500 dark:border-zinc-800">
          <span className="flex min-w-0 items-center gap-1.5">
            <Crown className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{club.head?.fullName ?? 'No head yet'}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 tabular-nums"><Users2 className="size-3.5" aria-hidden />{club.memberCount}</span>
        </div>
      </Link>
    </li>
  )
}

export default function ClubsPage() {
  useDocumentTitle('Clubs')
  const { user } = useAuth()
  const navigate = useNavigate()
  const faculty = isFaculty(user)
  const [params, setParams] = useSearchParams()
  const mine = params.get('mine') === 'true'
  const inactive = faculty && params.get('inactive') === 'true'
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebouncedValue(search.trim(), 250)
  const [creating, setCreating] = useState(false)

  const key = `${q}|${mine}|${inactive}`
  const [result, setResult] = useState({ key: null, clubs: [], error: null })
  const loading = result.key !== key

  useEffect(() => {
    const controller = new AbortController()
    clubsApi.list({ q: q || undefined, mine: mine || undefined, includeInactive: inactive || undefined }, { signal: controller.signal })
      .then((clubs) => setResult({ key, clubs, error: null }))
      .catch((err) => err.name !== 'AbortError' && setResult({ key, clubs: [], error: err }))
    return () => controller.abort()
  }, [key, q, mine, inactive])

  function toggle(name, on) {
    const next = new URLSearchParams(params)
    if (on) next.set(name, 'true')
    else next.delete(name)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Clubs"
        description="Every club on campus, who leads it and who is on the team."
        actions={faculty && <Button onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden /> New club</Button>}
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-80">
          <Input icon={Search} type="search" aria-label="Search clubs" placeholder="Search clubs" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          <Toggle pressed={!mine} onClick={() => toggle('mine', false)}>All clubs</Toggle>
          <Toggle pressed={mine} onClick={() => toggle('mine', true)}>My clubs</Toggle>
          {faculty && <Toggle pressed={inactive} onClick={() => toggle('inactive', !inactive)}>Show disabled</Toggle>}
        </div>
      </div>

      {result.error ? (
        <Alert tone="error" title="Could not load clubs">{result.error.message}</Alert>
      ) : loading && result.clubs.length === 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading clubs">
          {[1, 2, 3].map((i) => <li key={i}><Skeleton className="h-44 rounded-2xl" /></li>)}
        </ul>
      ) : result.clubs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Flag}
            title={mine ? 'You are not on a club team yet' : 'No clubs found'}
            description={mine ? 'When a club head adds you to their team, the club shows up here.' : q ? 'Try a different search.' : 'Clubs appear here once faculty create them.'}
          />
        </Card>
      ) : (
        <ul className={cn('grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3', loading && 'opacity-60')}>
          {result.clubs.map((club) => <ClubCard key={club.id} club={club} />)}
        </ul>
      )}

      {creating && (
        <ClubFormDialog user={user} onClose={() => setCreating(false)} onSaved={(club) => navigate(`/clubs/${club.id}`)} />
      )}
    </>
  )
}
