import { useEffect, useState } from 'react'
import { CATEGORY_LABELS } from '@/features/bookings/bookingsApi'
import { eventsApi } from '@/features/events/eventsApi'
import { usersApi } from '@/features/users/usersApi'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { ACADEMIC_YEARS } from '@/lib/utils'

/**
 * A list of checkboxes standing for an eligibility array. Nothing ticked
 * means "open to everyone", which is exactly what the empty array means to
 * the API (FR15) - so the hint says so rather than leaving people guessing.
 */
function AudiencePicker({ legend, hint, options, selected, onChange }) {
  const toggle = (value) => onChange(
    selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
  )
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="mt-0.5 mb-2 text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label }) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm has-checked:border-brand-500 has-checked:bg-brand-50 has-checked:text-brand-700 dark:border-zinc-700 dark:has-checked:bg-brand-500/10 dark:has-checked:text-brand-300"
          >
            <input
              type="checkbox"
              className="size-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-600"
              checked={selected.includes(value)}
              onChange={() => toggle(value)}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Publishes an approved event (`mode="publish"`) or edits a published one.
 *
 * Publishing is the moment an approved venue booking becomes something
 * students can see, so it is also where the seat limit and the audience are
 * decided. The schedule and venue are deliberately absent: those belong to
 * the booking, where changing them re-runs conflict detection.
 */
export function EventFormDialog({ event, mode = 'publish', onClose, onSaved }) {
  const toast = useToast()
  const publishing = mode === 'publish'
  const [departments, setDepartments] = useState([])
  const [form, setForm] = useState({
    maxSeats: event.maxSeats === null ? '' : String(event.maxSeats),
    description: event.description ?? '',
    category: event.category,
    bannerUrl: event.bannerUrl ?? '',
    departments: event.eligibility.departments,
    years: event.eligibility.years,
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const fieldErrors = error?.fieldErrors || {}

  useEffect(() => {
    usersApi.departments().then(setDepartments).catch(() => {})
  }, [])

  const capacity = event.venue?.capacity
  const seats = form.maxSeats === '' ? null : Number(form.maxSeats)
  const overCapacity = capacity && seats !== null && seats > capacity

  async function save() {
    setError(null)
    setSaving(true)
    const payload = {
      maxSeats: seats,
      description: form.description.trim() || null,
      bannerUrl: form.bannerUrl.trim() || null,
      eligibleDepartments: form.departments,
      eligibleYears: form.years,
    }
    if (!publishing) payload.category = form.category
    try {
      const saved = publishing ? await eventsApi.publish(event.id, payload) : await eventsApi.update(event.id, payload)
      toast.success(
        publishing ? 'Event published' : 'Event updated',
        publishing ? `${saved.title} is now open for registration.` : saved.title,
      )
      onSaved(saved)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      busy={saving}
      onClose={onClose}
      size="lg"
      title={publishing ? `Publish ${event.title}` : `Edit ${event.title}`}
      description={publishing
        ? 'Students will see this event and can reserve a seat straight away.'
        : 'Changes are live immediately for everyone who can see the event.'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={overCapacity}>
            {publishing ? 'Publish event' : 'Save changes'}
          </Button>
        </>
      )}
    >
      <form className="space-y-5 pb-2" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        {error && !Object.keys(fieldErrors).length && <Alert tone="error">{error.message}</Alert>}

        <Field
          label="Seats"
          optional
          error={fieldErrors.maxSeats || (overCapacity ? `${event.venue.name} holds ${capacity}` : undefined)}
          hint={capacity ? `Leave empty for no limit. ${event.venue.name} holds ${capacity}.` : 'Leave empty for no limit.'}
        >
          {(p) => (
            <Input
              {...p}
              type="number"
              min={1}
              max={capacity || undefined}
              value={form.maxSeats}
              onChange={(e) => setForm({ ...form, maxSeats: e.target.value })}
              error={fieldErrors.maxSeats || overCapacity}
              autoFocus
            />
          )}
        </Field>

        {!publishing && (
          <Field label="Category" error={fieldErrors.category}>
            {(p) => (
              <Select {...p} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            )}
          </Field>
        )}

        <Field label="Description" optional error={fieldErrors.description}>
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What happens, what to bring, who to contact"
            />
          )}
        </Field>

        <AudiencePicker
          legend="Departments"
          hint="Tick none to open the event to every department."
          options={departments.map((d) => ({ value: d.id, label: d.code }))}
          selected={form.departments}
          onChange={(value) => setForm({ ...form, departments: value })}
        />

        <AudiencePicker
          legend="Academic years"
          hint="Tick none to open the event to every year."
          options={ACADEMIC_YEARS.map((y) => ({ value: y.value, label: y.label.split(' (')[0] }))}
          selected={form.years}
          onChange={(value) => setForm({ ...form, years: value })}
        />

        <Field label="Banner image link" optional error={fieldErrors.bannerUrl}>
          {(p) => (
            <Input
              {...p}
              type="url"
              value={form.bannerUrl}
              onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
              placeholder="https://..."
              error={fieldErrors.bannerUrl}
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
