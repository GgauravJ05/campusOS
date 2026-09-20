import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarPlus, Layers, MapPin, Plus, Search, Timer, Users2, X } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { venuesApi, VENUE_TYPE_LABELS, floorLabel, equipmentLabel } from '@/features/venues/venuesApi'
import { canBook } from '@/features/bookings/bookingsApi'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Input, Select } from '@/components/ui/Field'
import { Alert, Badge, Card, EmptyState, Skeleton } from '@/components/ui/Surface'
import { VenueIcon } from '@/components/venues/VenueVisual'
import { VenueFormDialog } from '@/components/venues/VenueFormDialog'
import { cn, isFaculty } from '@/lib/utils'
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks'

const CAPACITY_STEPS = [30, 60, 100, 200, 400]

function VenueCard({ venue }) {
  const shown = venue.equipment.slice(0, 3)
  const more = venue.equipment.length - shown.length
  return (
    <article className="flex">
    <Link
      to={`/venues/${venue.id}`}
      className="group flex w-full flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-brand-500/40"
    >
      <div className="flex items-start gap-3.5">
        <VenueIcon type={venue.type} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold tracking-tight group-hover:text-brand-700 dark:group-hover:text-brand-300">{venue.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-zinc-500">
            <MapPin className="size-3.5 shrink-0" aria-hidden /> {venue.building} · {floorLabel(venue.floor)}
          </p>
        </div>
        {!venue.isActive && <Badge tone="rose">Inactive</Badge>}
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-zinc-50 px-2.5 py-2 dark:bg-zinc-800/60">
          <dt className="flex items-center gap-1 text-xs text-zinc-500"><Users2 className="size-3" aria-hidden /> Seats</dt>
          <dd className="font-semibold tabular-nums">{venue.capacity}</dd>
        </div>
        <div className="rounded-lg bg-zinc-50 px-2.5 py-2 dark:bg-zinc-800/60">
          <dt className="flex items-center gap-1 text-xs text-zinc-500"><Layers className="size-3" aria-hidden /> Type</dt>
          <dd className="truncate font-semibold">{VENUE_TYPE_LABELS[venue.type]?.split(' ')[0]}</dd>
        </div>
        <div className="rounded-lg bg-zinc-50 px-2.5 py-2 dark:bg-zinc-800/60">
          <dt className="flex items-center gap-1 text-xs text-zinc-500"><Timer className="size-3" aria-hidden /> Buffer</dt>
          <dd className="font-semibold tabular-nums">{venue.bufferMinutes} min</dd>
        </div>
      </dl>

      <div className="mt-4 flex min-h-6 flex-wrap gap-1.5">
        {shown.map((item) => <Badge key={item}>{equipmentLabel(item)}</Badge>)}
        {more > 0 && <Badge tone="brand">+{more} more</Badge>}
      </div>
    </Link>
    </article>
  )
}

export default function VenuesPage() {
  useDocumentTitle('Venues')
  const { user } = useAuth()
  const faculty = isFaculty(user)
  const [params, setParams] = useSearchParams()
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState(params.get('q') || '')
  const [creating, setCreating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const q = useDebouncedValue(search.trim(), 300)

  const building = params.get('building') || ''
  const floor = params.get('floor') || ''
  const type = params.get('type') || ''
  const minCapacity = params.get('minCapacity') || ''
  const equipment = useMemo(() => (params.get('equipment') || '').split(',').filter(Boolean), [params])

  const queryKey = `${params.toString()}#${refreshKey}`
  const [result, setResult] = useState({ key: null, items: [], error: null })
  const loading = result.key !== queryKey

  useEffect(() => {
    venuesApi.meta().then(setMeta).catch(() => {})
  }, [refreshKey])

  function setFilter(changes) {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (q !== (params.get('q') || '')) setFilter({ q })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  useEffect(() => {
    const controller = new AbortController()
    const filters = { ...Object.fromEntries(new URLSearchParams(queryKey.split('#')[0])), pageSize: 100 }
    venuesApi.list(filters, { signal: controller.signal })
      .then(({ data }) => setResult({ key: queryKey, items: data, error: null }))
      .catch((err) => err.name !== 'AbortError' && setResult({ key: queryKey, items: [], error: err }))
    return () => controller.abort()
  }, [queryKey])

  const floors = meta?.buildings.find((b) => b.name === building)?.floors ?? []
  const filtered = Boolean(params.toString())

  function toggleEquipment(item) {
    const next = equipment.includes(item) ? equipment.filter((e) => e !== item) : [...equipment, item]
    setFilter({ equipment: next.join(',') })
  }

  return (
    <>
      <PageHeader
        title="Venues"
        description="Find the right room by building, floor, capacity and equipment, then check when it is free."
        actions={(
          <>
            {faculty && <Button variant="secondary" onClick={() => setCreating(true)}><Plus className="size-4" aria-hidden /> Add venue</Button>}
            {canBook(user) && (
              <Link to="/bookings/new" className={buttonClasses()}><CalendarPlus className="size-4" aria-hidden /> Book a venue</Link>
            )}
          </>
        )}
      />

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="venue-search" className="sr-only">Search venues</label>
            <Input id="venue-search" type="search" icon={Search} placeholder="Search by name or location" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select aria-label="Building" value={building} onChange={(e) => setFilter({ building: e.target.value, floor: '' })}>
            <option value="">All buildings</option>
            {meta?.buildings.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
          </Select>
          <Select aria-label="Floor" value={floor} onChange={(e) => setFilter({ floor: e.target.value })} disabled={!building}>
            <option value="">{building ? 'All floors' : 'Pick a building'}</option>
            {floors.map((f) => <option key={f.floor} value={f.floor}>{floorLabel(f.floor)}</option>)}
          </Select>
          <Select aria-label="Venue type" value={type} onChange={(e) => setFilter({ type: e.target.value })}>
            <option value="">Any type</option>
            {Object.entries(VENUE_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
          <Select aria-label="Minimum capacity" value={minCapacity} onChange={(e) => setFilter({ minCapacity: e.target.value })}>
            <option value="">Any size</option>
            {CAPACITY_STEPS.map((n) => <option key={n} value={n}>{n}+ seats</option>)}
          </Select>
        </div>

        {meta?.equipment.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Required equipment">
            <span className="mr-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">Needs</span>
            {meta.equipment.map((item) => {
              const active = equipment.includes(item)
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleEquipment(item)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ring-inset',
                    active
                      ? 'bg-brand-600 text-white ring-brand-600 dark:bg-brand-500'
                      : 'bg-white text-zinc-600 ring-zinc-200 hover:ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700',
                  )}
                >
                  {equipmentLabel(item)}
                </button>
              )
            })}
            {filtered && (
              <button type="button" onClick={() => { setSearch(''); setParams({}, { replace: true }) }} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                <X className="size-4" aria-hidden /> Clear filters
              </button>
            )}
          </div>
        )}
      </Card>

      {result.error ? (
        <Alert tone="error" title="Could not load venues">{result.error.message}</Alert>
      ) : loading && result.items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading venues">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : result.items.length === 0 ? (
        <Card>
          <EmptyState icon={MapPin} title="No venue matches" description="Try fewer equipment requirements or a smaller capacity." />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-zinc-500" aria-live="polite">{result.items.length} venue{result.items.length === 1 ? '' : 's'}</p>
          <div className={cn('grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3', loading && 'opacity-60')}>
            {result.items.map((venue) => <VenueCard key={venue.id} venue={venue} />)}
          </div>
        </>
      )}

      {creating && (
        <VenueFormDialog
          meta={meta}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); setRefreshKey((k) => k + 1) }}
        />
      )}
    </>
  )
}
