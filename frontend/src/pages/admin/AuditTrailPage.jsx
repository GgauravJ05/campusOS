import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, ShieldCheck } from 'lucide-react'
import { AUDIT_GROUP_LABELS, reportsApi } from '@/features/reports/reportsApi'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Alert, Avatar, Badge, Card, EmptyState, Skeleton } from '@/components/ui/Surface'
import { ROLE_META, cn, formatDateTime } from '@/lib/utils'
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks'

const GROUP_TONES = {
  ACCESS: 'zinc',
  ROLES: 'accent',
  VENUES: 'blue',
  BOOKINGS: 'amber',
  CLUBS: 'emerald',
  EVENTS: 'brand',
  OTHER: 'zinc',
}

/** The details JSONB, rendered as "from STUDENT, to CLUB_HEAD". */
function detailsSummary(details) {
  if (!details || typeof details !== 'object') return null
  const parts = Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0))
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
  return parts.length ? parts.join(' · ') : null
}

/**
 * FR20: the immutable audit trail. Read-only by design - there is no edit
 * control anywhere on this page, because the table itself refuses UPDATE
 * and DELETE.
 */
export default function AuditTrailPage() {
  useDocumentTitle('Audit trail')
  const [params, setParams] = useSearchParams()
  const group = params.get('group') || ''
  const page = Number(params.get('page')) || 1
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebouncedValue(search.trim(), 250)

  const key = `${group}|${q}|${page}`
  const [result, setResult] = useState({ key: null, items: [], meta: null, error: null })
  const loading = result.key !== key

  useEffect(() => {
    const controller = new AbortController()
    reportsApi.auditTrail(
      { group: group || undefined, q: q || undefined, page: page > 1 ? page : undefined, pageSize: 25 },
      { signal: controller.signal },
    )
      .then(({ data, meta }) => setResult({ key, items: data, meta, error: null }))
      .catch((err) => err.name !== 'AbortError' && setResult({ key, items: [], meta: null, error: err }))
    return () => controller.abort()
  }, [key, group, q, page])

  function setFilter(changes) {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([name, value]) => (value ? next.set(name, value) : next.delete(name)))
    if (!('page' in changes)) next.delete('page')
    setParams(next, { replace: true })
  }

  const meta = result.meta

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Every sign-in, role change, venue decision and approval. Append-only - nothing here can be edited or deleted."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-72">
          <Input
            icon={Search}
            type="search"
            aria-label="Search the trail"
            placeholder="Search by person or action"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilter({ page: null }) }}
          />
        </div>
        <div className="sm:w-56">
          <Select aria-label="Filter by area" value={group} onChange={(e) => setFilter({ group: e.target.value })}>
            <option value="">Everything</option>
            {Object.entries(AUDIT_GROUP_LABELS).filter(([key]) => key !== 'OTHER').map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        {meta && <p className="text-sm text-zinc-500 sm:ml-auto">{meta.total} recorded {meta.total === 1 ? 'action' : 'actions'}</p>}
      </div>

      {result.error ? (
        <Alert tone="error" title="Could not load the trail">{result.error.message}</Alert>
      ) : loading && result.items.length === 0 ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : result.items.length === 0 ? (
        <Card>
          <EmptyState icon={ShieldCheck} title="Nothing recorded yet" description="Administrative actions appear here as they happen." />
        </Card>
      ) : (
        <>
          <Card className={cn('overflow-hidden transition-opacity', loading && 'opacity-60')}>
            <ul aria-label="Recorded actions" className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {result.items.map((entry) => {
                const details = detailsSummary(entry.details)
                return (
                  <li key={entry.id} className="flex gap-3 px-5 py-3.5 sm:px-6">
                    <Avatar name={entry.actor.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{entry.actor.fullName}</span>
                        <span className="text-zinc-500"> · {entry.label.toLowerCase()}</span>
                        {entry.subjectType && (
                          <span className="text-zinc-400"> ({entry.subjectType.toLowerCase()} {entry.subjectId})</span>
                        )}
                      </p>
                      {details && <p className="mt-0.5 truncate text-xs text-zinc-500">{details}</p>}
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {formatDateTime(entry.at)}
                        {entry.ip && ` · ${entry.ip}`}
                        {` · ${ROLE_META[entry.actor.role]?.short ?? entry.actor.role}`}
                      </p>
                    </div>
                    <Badge tone={GROUP_TONES[entry.group]} className="h-fit shrink-0">
                      {AUDIT_GROUP_LABELS[entry.group] ?? entry.group}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          </Card>

          {meta && meta.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
              <p className="text-sm text-zinc-500">Page {meta.page} of {meta.totalPages}</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => setFilter({ page: String(meta.page - 1) })}>
                  <ChevronLeft className="size-4" aria-hidden /> Previous
                </Button>
                <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setFilter({ page: String(meta.page + 1) })}>
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
