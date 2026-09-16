import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { downloadReport, reportsApi } from '@/features/reports/reportsApi'
import { tokenStore } from '@/lib/api'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Alert, Card, EmptyState, Skeleton } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { addDays, campusToday } from '@/lib/campusTime'
import { cn } from '@/lib/utils'
import { useDocumentTitle } from '@/lib/hooks'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

/** Percentages and counts read better right-aligned; names read better left. */
function cellClass(column) {
  return cn('px-3 py-2 text-sm whitespace-nowrap', column.align === 'right' ? 'text-right tabular-nums' : 'text-left')
}

function ReportTable({ columns, rows }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nothing in this period"
        description="Widen the dates, or pick another report."
        className="py-12"
      />
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem]">
        <thead className="border-b border-zinc-200 text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-700">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cellClass(column)}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row, index) => (
            // Report rows have no stable id of their own; the first column is
            // the subject, so it plus the index identifies the row.
            <tr key={`${row[columns[0].key]}-${index}`} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
              {columns.map((column) => (
                <td key={column.key} className={cellClass(column)}>
                  {row[column.key] === null || row[column.key] === undefined ? '—' : String(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** FR21: venue utilisation, club activity and attendance, exportable. */
export default function ReportsPage() {
  useDocumentTitle('Reports')
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [catalogue, setCatalogue] = useState({ loaded: false, reports: [] })
  const report = params.get('report') || 'venue-utilisation'
  const from = params.get('from') || addDays(campusToday(), -29)
  const to = params.get('to') || campusToday()

  const key = `${report}|${from}|${to}`
  const [result, setResult] = useState({ key: null, data: null, error: null })
  const [downloading, setDownloading] = useState(null)
  const loading = result.key !== key

  useEffect(() => {
    const controller = new AbortController()
    reportsApi.catalogue({ signal: controller.signal })
      .then((data) => setCatalogue({ loaded: true, reports: data.reports }))
      .catch(() => setCatalogue({ loaded: true, reports: [] }))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    reportsApi.get(report, { from, to }, { signal: controller.signal })
      .then((data) => setResult({ key, data, error: null }))
      .catch((err) => err.name !== 'AbortError' && setResult({ key, data: null, error: err }))
    return () => controller.abort()
  }, [key, report, from, to])

  function setFilter(changes) {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([name, value]) => (value ? next.set(name, value) : next.delete(name)))
    setParams(next, { replace: true })
  }

  async function exportAs(format) {
    setDownloading(format)
    try {
      const filename = await downloadReport(report, format, { from, to }, {
        token: tokenStore.get(),
        baseUrl: API_BASE,
      })
      toast.success('Export ready', filename)
    } catch (err) {
      toast.error('Export failed', err.message)
    } finally {
      setDownloading(null)
    }
  }

  const spec = catalogue.reports.find((r) => r.key === report)
  const data = result.data

  return (
    <>
      <PageHeader
        title="Reports"
        description="Venue utilisation, club activity and attendance - on screen, or exported for a meeting."
        actions={(
          <>
            <Button variant="secondary" onClick={() => exportAs('csv')} loading={downloading === 'csv'} disabled={Boolean(downloading)}>
              <FileSpreadsheet className="size-4" aria-hidden /> CSV
            </Button>
            <Button variant="secondary" onClick={() => exportAs('pdf')} loading={downloading === 'pdf'} disabled={Boolean(downloading)}>
              <FileText className="size-4" aria-hidden /> PDF
            </Button>
          </>
        )}
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Reports">
          {catalogue.reports.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={report === item.key}
              onClick={() => setFilter({ report: item.key })}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                report === item.key
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800',
              )}
            >
              {item.title}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-3">
          <Field label="From" className="w-40">
            {(p) => <Input {...p} type="date" value={from} max={to} onChange={(e) => setFilter({ from: e.target.value })} />}
          </Field>
          <Field label="To" className="w-40">
            {(p) => <Input {...p} type="date" value={to} min={from} onChange={(e) => setFilter({ to: e.target.value })} />}
          </Field>
        </div>
      </div>

      {spec && <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">{spec.description}</p>}

      {result.error ? (
        <Alert tone="error" title="Could not build that report">{result.error.message}</Alert>
      ) : loading && !data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : data ? (
        <Card className={cn('overflow-hidden transition-opacity', loading && 'opacity-60')}>
          {Object.keys(data.totals).length > 0 && (
            <dl className="flex flex-wrap gap-x-8 gap-y-3 border-b border-zinc-100 px-5 py-4 sm:px-6 dark:border-zinc-800">
              {Object.entries(data.totals).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs tracking-wide text-zinc-500 uppercase">{label.replace(/([A-Z])/g, ' $1')}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <ReportTable columns={data.columns} rows={data.rows} />
        </Card>
      ) : null}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
        <Download className="size-3.5" aria-hidden />
        Exports cover the dates shown above.
      </p>
    </>
  )
}
