import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, UsersRound } from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { usersApi } from '@/features/users/usersApi'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Alert, Avatar, Card, EmptyState, Skeleton } from '@/components/ui/Surface'
import { RoleBadge, StatusBadge } from '@/components/RoleBadge'
import { formatRelative, ROLE_META } from '@/lib/utils'
import { useDebouncedValue, useDocumentTitle } from '@/lib/hooks'

const PAGE_SIZE = 20

export default function UsersPage() {
  useDocumentTitle('People')
  const { user } = useAuth()
  const navigate = useNavigate()
  const isPrincipal = user.role.key === 'SUPER_ADMIN'

  // Filters live in the URL, so a filtered view can be bookmarked and shared.
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const q = useDebouncedValue(search.trim(), 300)
  const role = params.get('role') || ''
  const status = params.get('status') || ''
  const departmentId = params.get('departmentId') || ''

  // Each response is tagged with the query it answers; while the tag differs
  // from the current URL, a newer request is in flight.
  const queryKey = params.toString()
  const [result, setResult] = useState({ key: null, items: [], meta: null, error: null })
  const loading = result.key !== queryKey
  const error = result.error
  const [departments, setDepartments] = useState([])

  useEffect(() => {
    if (isPrincipal) usersApi.departments().then(setDepartments).catch(() => {})
  }, [isPrincipal])

  function setFilter(key, value) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (q === (params.get('q') || '')) return
    const next = new URLSearchParams(params)
    if (q) next.set('q', q)
    else next.delete('q')
    next.delete('page')
    setParams(next, { replace: true })
  }, [q, params, setParams])

  useEffect(() => {
    const controller = new AbortController()
    const filters = Object.fromEntries(new URLSearchParams(queryKey))
    usersApi
      .list({ ...filters, pageSize: PAGE_SIZE }, { signal: controller.signal })
      .then(({ data, meta }) => setResult({ key: queryKey, items: data, meta, error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setResult({ key: queryKey, items: [], meta: null, error: err })
      })
    return () => controller.abort()
  }, [queryKey])

  const { items, meta } = result
  const filtered = Boolean(params.get('q') || role || status || departmentId)

  return (
    <>
      <PageHeader
        eyebrow={isPrincipal ? 'All departments' : user.department?.name}
        title="People"
        description="Find students and staff, promote club leaders, and manage account access."
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center dark:border-zinc-800">
          <div className="flex-1">
            <label htmlFor="people-search" className="sr-only">Search people</label>
            <Input id="people-search" icon={Search} type="search" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Select aria-label="Filter by role" value={role} onChange={(e) => setFilter('role', e.target.value)} className="sm:w-44">
              <option value="">All roles</option>
              {Object.entries(ROLE_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </Select>
            <Select aria-label="Filter by status" value={status} onChange={(e) => setFilter('status', e.target.value)} className="sm:w-36">
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="unverified">Unverified</option>
              <option value="inactive">Deactivated</option>
            </Select>
            {isPrincipal && (
              <Select aria-label="Filter by department" value={departmentId} onChange={(e) => setFilter('departmentId', e.target.value)} className="col-span-2 sm:w-40">
                <option value="">All departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.code}</option>)}
              </Select>
            )}
          </div>
        </div>

        {error ? (
          <div className="p-4"><Alert tone="error" title="Could not load people">{error.message}</Alert></div>
        ) : loading && !items.length ? (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800" aria-label="Loading people">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-56" /></div>
                <Skeleton className="hidden h-5 w-24 rounded-full sm:block" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={filtered ? 'Nobody matches those filters' : 'No people yet'}
            description={filtered ? 'Try a different name, or clear the filters.' : 'Students appear here once they sign up.'}
            action={filtered && (
              <Button variant="secondary" onClick={() => { setSearch(''); setParams({}, { replace: true }) }}>Clear filters</Button>
            )}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className={loading ? 'w-full text-sm opacity-60 transition-opacity' : 'w-full text-sm transition-opacity'}>
                <thead>
                  <tr className="text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    <th scope="col" className="px-5 py-3 font-medium">Name</th>
                    <th scope="col" className="px-3 py-3 font-medium">Role</th>
                    <th scope="col" className="px-3 py-3 font-medium">Department</th>
                    <th scope="col" className="px-3 py-3 font-medium">Status</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Last sign-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {items.map((person) => (
                    <tr
                      key={person.id}
                      onClick={() => navigate(`/users/${person.id}`)}
                      className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-5 py-3">
                        <Link to={`/users/${person.id}`} className="flex items-center gap-3 focus-visible:outline-offset-4" onClick={(e) => e.stopPropagation()}>
                          <Avatar name={person.fullName} src={person.avatarUrl} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-zinc-900 dark:text-zinc-100">{person.fullName}</span>
                            <span className="block truncate text-zinc-500">{person.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3"><RoleBadge role={person.role} short /></td>
                      <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{person.department?.code ?? '—'}</td>
                      <td className="px-3 py-3"><StatusBadge user={person} /></td>
                      <td className="px-5 py-3 text-right text-zinc-500">{formatRelative(person.lastLoginAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-zinc-100 md:hidden dark:divide-zinc-800">
              {items.map((person) => (
                <li key={person.id}>
                  <Link to={`/users/${person.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <Avatar name={person.fullName} src={person.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{person.fullName}</p>
                      <p className="truncate text-xs text-zinc-500">{person.email}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5"><RoleBadge role={person.role} short /><StatusBadge user={person} /></div>
                    </div>
                    <ChevronRight className="size-4 text-zinc-400" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {meta && meta.total > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-zinc-100 px-5 py-3 text-sm dark:border-zinc-800">
            <p className="text-zinc-500">
              {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => setFilter('page', String(meta.page - 1))} aria-label="Previous page">
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setFilter('page', String(meta.page + 1))} aria-label="Next page">
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
