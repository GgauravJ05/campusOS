import { useState } from 'react'
import { venuesApi, VENUE_TYPE_LABELS } from '@/features/venues/venuesApi'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, Input, Select } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'

function toForm(venue) {
  return {
    name: venue?.name ?? '',
    building: venue?.building ?? '',
    floor: venue ? String(venue.floor) : '0',
    type: venue?.type ?? 'SEMINAR_HALL',
    capacity: venue ? String(venue.capacity) : '',
    location: venue?.location ?? '',
    equipment: venue?.equipment.join(', ') ?? '',
    bufferMinutes: venue?.bufferOverride == null ? '' : String(venue.bufferOverride),
  }
}

/** Create (no `venue`) or edit a venue. Mounted only while open. */
export function VenueFormDialog({ venue, meta, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(() => toForm(venue))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const fieldErrors = error?.fieldErrors || {}
  const defaultBuffer = meta?.rules?.defaultBufferMinutes ?? 15

  async function save(extra = {}) {
    setError(null)
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      building: form.building.trim(),
      floor: Number(form.floor),
      type: form.type,
      capacity: Number(form.capacity),
      location: form.location.trim() || null,
      equipment: form.equipment.split(',').map((s) => s.trim()).filter(Boolean),
      bufferMinutes: form.bufferMinutes === '' ? null : Number(form.bufferMinutes),
      ...extra,
    }
    try {
      const saved = venue ? await venuesApi.update(venue.id, payload) : await venuesApi.create(payload)
      toast.success(venue ? 'Venue updated' : 'Venue added', saved.name)
      onSaved(saved)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      size="lg"
      busy={saving}
      onClose={onClose}
      title={venue ? `Edit ${venue.name}` : 'Add a venue'}
      description="Accurate capacity and equipment keep bookings realistic."
      footer={(
        <>
          {venue && (
            <Button variant={venue.isActive ? 'danger-soft' : 'secondary'} className="sm:mr-auto" onClick={() => save({ isActive: !venue.isActive })} disabled={saving}>
              {venue.isActive ? 'Deactivate venue' : 'Reactivate venue'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => save()} loading={saving} disabled={!form.name || !form.building || !form.capacity}>
            {venue ? 'Save changes' : 'Add venue'}
          </Button>
        </>
      )}
    >
      <form className="grid gap-4 pb-2 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save() }} noValidate>
        {error && !Object.keys(fieldErrors).length && <Alert tone="error" className="sm:col-span-2">{error.message}</Alert>}
        <Field label="Name" error={fieldErrors.name} className="sm:col-span-2">
          {(p) => <Input {...p} value={form.name} onChange={set('name')} placeholder="Seminar Hall C" error={fieldErrors.name} />}
        </Field>
        <Field label="Building" error={fieldErrors.building}>
          {(p) => (
            <>
              <Input {...p} list="venue-buildings" value={form.building} onChange={set('building')} placeholder="Main Building" error={fieldErrors.building} />
              <datalist id="venue-buildings">{meta?.buildings.map((b) => <option key={b.name} value={b.name} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="Floor" error={fieldErrors.floor} hint="0 is the ground floor">
          {(p) => <Input {...p} type="number" min="0" max="50" value={form.floor} onChange={set('floor')} error={fieldErrors.floor} />}
        </Field>
        <Field label="Type" error={fieldErrors.type}>
          {(p) => (
            <Select {...p} value={form.type} onChange={set('type')}>
              {Object.entries(VENUE_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Capacity" error={fieldErrors.capacity}>
          {(p) => <Input {...p} type="number" min="1" value={form.capacity} onChange={set('capacity')} placeholder="120" error={fieldErrors.capacity} />}
        </Field>
        <Field label="Location" optional className="sm:col-span-2">
          {(p) => <Input {...p} value={form.location} onChange={set('location')} placeholder="Second floor, near the library" />}
        </Field>
        <Field label="Equipment" optional hint="Separate with commas: projector, AC, sound system" className="sm:col-span-2">
          {(p) => <Input {...p} value={form.equipment} onChange={set('equipment')} />}
        </Field>
        <Field label="Setup / teardown buffer" optional error={fieldErrors.bufferMinutes} hint={`Minutes between back-to-back bookings. Empty uses the campus default (${defaultBuffer} min).`}>
          {(p) => <Input {...p} type="number" min="0" max="120" value={form.bufferMinutes} onChange={set('bufferMinutes')} placeholder={String(defaultBuffer)} error={fieldErrors.bufferMinutes} />}
        </Field>
      </form>
    </Dialog>
  )
}
