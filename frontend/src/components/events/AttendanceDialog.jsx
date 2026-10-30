import { useEffect, useState } from 'react'
import { CheckCircle2, CircleSlash, MinusCircle } from 'lucide-react'
import { attendanceApi } from '@/features/events/attendanceApi'
import { ATTENDANCE_STATUS_META } from '@/features/reports/reportsApi'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Alert, Avatar, Skeleton } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

const CHOICES = [
  { status: 'PRESENT', icon: CheckCircle2, cls: 'has-checked:border-emerald-500 has-checked:bg-emerald-50 has-checked:text-emerald-700 dark:has-checked:bg-emerald-500/10 dark:has-checked:text-emerald-300' },
  { status: 'ABSENT', icon: CircleSlash, cls: 'has-checked:border-rose-500 has-checked:bg-rose-50 has-checked:text-rose-700 dark:has-checked:bg-rose-500/10 dark:has-checked:text-rose-300' },
  { status: 'EXCUSED', icon: MinusCircle, cls: 'has-checked:border-amber-500 has-checked:bg-amber-50 has-checked:text-amber-800 dark:has-checked:bg-amber-500/10 dark:has-checked:text-amber-300' },
]

/**
 * Marks who turned up, which is what FR21's turnout metric measures.
 *
 * Everyone starts as whatever they were marked before - nobody is silently
 * defaulted to present, because "present" is a claim about a person that
 * should be made deliberately.
 */
export function AttendanceDialog({ event, onClose, onSaved }) {
  const toast = useToast()
  const [state, setState] = useState({ loaded: false, items: [], meta: null, error: null })
  const [marks, setMarks] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    attendanceApi.get(event.id, { signal: controller.signal })
      .then((data) => {
        setState({ loaded: true, ...data, error: null })
        setMarks(Object.fromEntries(data.items.filter((i) => i.status).map((i) => [i.studentId, i.status])))
      })
      .catch((err) => err.name !== 'AbortError' && setState({ loaded: true, items: [], meta: null, error: err }))
    return () => controller.abort()
  }, [event.id])

  const changed = Object.keys(marks).length > 0

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const payload = Object.entries(marks).map(([studentId, status]) => ({ studentId: Number(studentId), status }))
      const result = await attendanceApi.mark(event.id, payload)
      toast.success('Attendance saved', `${result.attendance.meta.present} of ${result.attendance.meta.registered} present.`)
      onSaved(result.attendance)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  function markAllPresent() {
    setMarks(Object.fromEntries(state.items.map((i) => [i.studentId, 'PRESENT'])))
  }

  return (
    <Dialog
      open
      busy={saving}
      onClose={onClose}
      size="lg"
      title={`Attendance · ${event.title}`}
      description="Mark who turned up. You can come back and correct it later."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!changed}>Save attendance</Button>
        </>
      )}
    >
      <div className="space-y-4 pb-2">
        {error && <Alert tone="error">{error.message}</Alert>}
        {state.error && <Alert tone="error">{state.error.message}</Alert>}

        {!state.loaded ? (
          <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
        ) : state.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Nobody reserved a seat for this event.</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                {state.meta.registered} registered · {Object.values(marks).filter((s) => s === 'PRESENT').length} marked present
              </p>
              <button type="button" onClick={markAllPresent} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                Mark everyone present
              </button>
            </div>

            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {state.items.map((student) => (
                <li key={student.studentId} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={student.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{student.fullName}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {student.department ?? '—'}
                      {student.seats > 1 && ` · ${student.seats} seats`}
                      {student.markedBy && ` · marked by ${student.markedBy}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5" role="group" aria-label={`Attendance for ${student.fullName}`}>
                    {CHOICES.map(({ status, icon: Icon, cls }) => (
                      <label
                        key={status}
                        className={cn(
                          'flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium dark:border-zinc-700',
                          cls,
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={`attendance-${student.studentId}`}
                          value={status}
                          checked={marks[student.studentId] === status}
                          onChange={() => setMarks({ ...marks, [student.studentId]: status })}
                        />
                        <Icon className="size-3.5" aria-hidden />
                        {ATTENDANCE_STATUS_META[status].label}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Dialog>
  )
}
