import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { bookingsApi } from '@/features/bookings/bookingsApi'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Alert, Card, Skeleton } from '@/components/ui/Surface'
import { useDocumentTitle } from '@/lib/hooks'
import { BookingWizard } from './NewBookingPage'

/** Edit and resubmit an open venue request (FR13). The API decides who may. */
export default function EditBookingPage() {
  useDocumentTitle('Edit request')
  const { id } = useParams()
  const [state, setState] = useState({ id: null, booking: null, error: null })

  useEffect(() => {
    let active = true
    bookingsApi.get(id)
      .then((booking) => active && setState({ id, booking, error: null }))
      .catch((error) => active && setState({ id, booking: null, error }))
    return () => { active = false }
  }, [id])

  const back = (
    <Link to="/bookings" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
      <ArrowLeft className="size-4" aria-hidden /> Bookings
    </Link>
  )

  if (state.id !== id) {
    return (
      <>
        {back}
        <Card className="space-y-3 p-8" aria-label="Loading request"><Skeleton className="h-7 w-48" /><Skeleton className="h-24" /></Card>
      </>
    )
  }

  if (state.error) {
    return (
      <>
        {back}
        <Alert tone="error" title="Could not open this request">{state.error.message}</Alert>
      </>
    )
  }

  if (!state.booking.permissions.canEdit) {
    return (
      <>
        {back}
        <Alert tone="warning" title="This request can no longer be edited">
          Only open requests can be changed, by the person who made them or their club head.
        </Alert>
        <Link to={`/bookings?focus=${state.booking.id}`} className={buttonClasses({ variant: 'secondary', className: 'mt-4' })}>See its status</Link>
      </>
    )
  }

  return <BookingWizard existing={state.booking} />
}
