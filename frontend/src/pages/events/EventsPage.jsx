import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Search, Sparkles } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { CATEGORY_LABELS } from '@/features/bookings/bookingsApi'
import { eventsApi } from '@/features/events/eventsApi'
import { PageHeader } from '@/components/layout/AppShell'
import { EventCard } from '@/components/events/EventCard'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Alert, Card, EmptyState, Skeleton } from '@/components/ui/Surface'
import { cn, isFaculty } from '@/lib/utils'
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks'

/**
 * The student event discovery feed (FR14), with the category / club / venue /
 * date / status filters the requirement asks for, plus the FR17
 * recommendation rail above it.
 */

const VIEWS = {
  upcoming: { label: 'Upcoming', filters: { upcoming: true } },
  going: { label: "I'm going", filters: { mine: true } },
  // Organisers only: events of theirs that are approved but not yet open.
  publishable: { label: 'Ready to publish', filters: { status: 'APPROVED' } },
}

function Toggle({ pressed, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
        pressed
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800',
      )}
    >
      {children}
    </button>
  )
}

/** FR17. Hidden entirely when there is nothing worth suggesting. */
function RecommendedRail() {
  const [state, setState] = useState({ loaded: false, items: [], basedOnHistory: false })

  useEffect(() => {
    const controller = new AbortController()
    eventsApi.recommended(3, { signal: controller.signal })
      .then((data) => setState({ loaded: true, ...data }))
      .catch((err) => err.name !== 'AbortError' && setState({ loaded: true, items: [], basedOnHistory: false }))
    return () => controller.abort()
  }, [])

  if (!state.loaded || state.items.length === 0) return null

  return (
    <section className="mb-8" aria-labelledby="recommended-heading">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-brand-600 dark:text-brand-400" aria-hidden />
        <h2 id="recommended-heading" className="text-sm font-semibold tracking-tight">
          {state.basedOnHistory ? 'Recommended for you' : 'Happening soon'}
        </h2>
        <span className="text-sm text-zinc-500">
          {state.basedOnHistory ? 'Based on what you have registered for' : 'Open to you'}
        </span>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.items.map((event) => <EventCard key={event.id} event={event} reason={event.reason} />)}
      </ul>
    </section>
  )
}

export default function EventsPage() {
  useDocumentTitle('Events')
  const { user } = useAuth()
  const organiser = isFaculty(user) || user.role.key === 'CLUB_HEAD'
  const [params, setParams] = useSearchParams()

  const view = VIEWS[params.get('view')] ? params.get('view') : 'upcoming'
  const category = params.get('category') || ''
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebouncedValue(search.trim(), 250)

  const key = `${view}|${category}|${q}|${page}`
  const [result, setResult] = useState({ key: null, items: [], meta: null, error: null })
  const loading = result.key !== key

  useEffect(() => {
    const controller = new AbortController()
    eventsApi.list(
      { ...VIEWS[view].filters, category: category || undefined, q: q || undefined, page: page > 1 ? page : undefined },
      { signal: controller.signal },
    )
      .then(({ items, meta }) => setResult({ key, items, meta, error: null }))
      .catch((err) => err.name !== 'AbortError' && setResult({ key, items: [], meta: null, error: err }))
    return () => controller.abort()
  }, [key, view, category, q, page])

  /** Any filter change resets to page 1 - page 3 of a different search is meaningless. */
  function setFilter(changes) {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([name, value]) => {
      if (value) next.set(name, value)
      else next.delete(name)
    })
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  const meta = result.meta
  const showRecommendations = view === 'upcoming' && !category && !q && page === 1

  return (
    <>
      <PageHeader
        title="Events"
        description="Everything happening on campus. Reserve a seat in one tap."
      />

      {showRecommendations && <RecommendedRail />}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-72">
          <Input
            icon={Search}
            type="search"
            aria-label="Search events"
            placeholder="Search events"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilter({ page: null }) }}
          />
        </div>
        <div className="sm:w-48">
          <Select aria-label="Filter by category" value={category} onChange={(e) => setFilter({ category: e.target.value })}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {Object.entries(VIEWS)
            .filter(([name]) => name !== 'publishable' || organiser)
            .map(([name, { label }]) => (
              <Toggle key={name} pressed={view === name} onClick={() => setFilter({ view: name === 'upcoming' ? null : name })}>
                {label}
              </Toggle>
            ))}
        </div>
      </div>

      {result.error ? (
        <Alert tone="error" title="Could not load events">{result.error.message}</Alert>
      ) : loading && result.items.length === 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading events">
          {[1, 2, 3].map((i) => <li key={i}><Skeleton className="h-56 rounded-2xl" /></li>)}
        </ul>
      ) : result.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title={
              view === 'going' ? 'You have not reserved a seat yet'
                : view === 'publishable' ? 'Nothing waiting to be published'
                : q || category ? 'No events match those filters'
                : 'No events coming up'
            }
            description={
              view === 'going' ? 'Reserve a seat and the event will show up here.'
                : view === 'publishable' ? 'Once a venue request is approved, publish it here to open registration.'
                : q || category ? 'Try a different search or category.'
                : 'When clubs publish their events, they appear here.'
            }
          />
        </Card>
      ) : (
        <>
          <ul className={cn('grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3', loading && 'opacity-60')}>
            {result.items.map((event) => <EventCard key={event.id} event={event} />)}
          </ul>

          {meta && meta.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              <p className="text-sm text-zinc-500">Page {meta.page} of {meta.totalPages} · {meta.total} events</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setFilter({ page: String(meta.page - 1) })}
                >
                  <ChevronLeft className="size-4" aria-hidden /> Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setFilter({ page: String(meta.page + 1) })}
                >
                  Next <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </>
  )
}
