import { useEffect, useState } from 'react'
import { MessageSquareText, Star } from 'lucide-react'
import { eventsApi, feedbackAnswerLabel, feedbackQuestionLabel } from '@/features/events/eventsApi'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea } from '@/components/ui/Field'
import { Alert, Card, CardHeader, Skeleton } from '@/components/ui/Surface'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

/** One row of radio buttons; `name` groups them, so the arrow keys move between them. */
function ChoiceGroup({ legend, name, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value: optionValue, label }) => (
          <label
            key={String(optionValue)}
            className={cn(
              'cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
              value === optionValue
                ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/10 dark:text-brand-300'
                : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const YES_NO = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]

/**
 * A student's feedback form for an event they attended a seat at. The
 * questions come from the API because they differ by event category.
 * Sending again replaces the earlier answer, and the card says so.
 */
export function FeedbackCard({ eventId }) {
  const toast = useToast()
  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [rating, setRating] = useState(0)
  const [answers, setAnswers] = useState({})
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    eventsApi.feedbackForm(eventId, { signal: controller.signal })
      .then(setForm)
      .catch((err) => err.name !== 'AbortError' && setLoadError(err))
    return () => controller.abort()
  }, [eventId])

  if (loadError) return <Card className="p-5"><Alert tone="error">{loadError.message}</Alert></Card>
  if (!form) return <Skeleton className="h-56 rounded-2xl" />

  async function submit(e) {
    e.preventDefault()
    if (rating < 1) {
      setError({ message: 'Choose a rating from 1 to 5 stars.' })
      return
    }
    setError(null)
    setBusy(true)
    try {
      await eventsApi.submitFeedback(eventId, {
        rating,
        answers: { ...answers, ...(comment.trim() ? { comment: comment.trim() } : {}) },
      })
      toast.success('Thanks for the feedback', 'Organisers see it without your name.')
      setSubmitted(true)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <Card className="p-5">
        <Alert tone="success" title="Feedback sent">
          Organisers see your answers without your name. You can change them until you close this page.
        </Alert>
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setSubmitted(false)}>Change my answers</Button>
      </Card>
    )
  }

  const setAnswer = (key) => (value) => setAnswers((prev) => ({ ...prev, [key]: value }))

  return (
    <Card as="section" aria-labelledby="feedback-title">
      <CardHeader title={<span id="feedback-title">How was it?</span>} description="Only the organisers see this, and not your name." />
      <form onSubmit={submit} className="space-y-5 p-5 sm:p-6" noValidate>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">Your rating</legend>
          <div className="flex gap-1">
            {Array.from({ length: form.rating.max - form.rating.min + 1 }, (_, i) => form.rating.min + i).map((n) => (
              <label key={n} className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500">
                <input type="radio" name="rating" className="sr-only" checked={rating === n} onChange={() => setRating(n)} />
                <Star
                  className={cn('size-7', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-300 dark:text-zinc-600')}
                  aria-hidden
                />
                <span className="sr-only">{n} {n === 1 ? 'star' : 'stars'}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {Object.entries(form.questions).map(([key, rule]) => (
          rule.type === 'enum' ? (
            <ChoiceGroup
              key={key}
              legend={feedbackQuestionLabel(key)}
              name={key}
              options={rule.values.map((v) => ({ value: v, label: feedbackAnswerLabel(v) }))}
              value={answers[key]}
              onChange={setAnswer(key)}
            />
          ) : (
            <ChoiceGroup key={key} legend={feedbackQuestionLabel(key)} name={key} options={YES_NO} value={answers[key]} onChange={setAnswer(key)} />
          )
        ))}

        <Field label="Anything else?" optional hint={`${comment.length} / ${form.commentMaxLength}`}>
          {(p) => <Textarea {...p} rows={3} maxLength={form.commentMaxLength} value={comment} onChange={(e) => setComment(e.target.value)} />}
        </Field>

        {error && <Alert tone="error">{error.message}</Alert>}
        <Button type="submit" className="w-full" loading={busy}>Send feedback</Button>
      </form>
    </Card>
  )
}

/** What the organiser sees: the rating spread, a tally per question and the comments. Never who said what. */
export function FeedbackSummary({ eventId }) {
  const [state, setState] = useState({ data: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    eventsApi.feedbackSummary(eventId, { signal: controller.signal })
      .then((data) => setState({ data, error: null }))
      .catch((err) => err.name !== 'AbortError' && setState({ data: null, error: err }))
    return () => controller.abort()
  }, [eventId])

  if (state.error) return <Card className="p-5"><Alert tone="error">{state.error.message}</Alert></Card>
  if (!state.data) return <Skeleton className="h-48 rounded-2xl" />

  const { responses, averageRating, ratingSpread, questions, comments } = state.data
  if (responses === 0) {
    return (
      <Card>
        <CardHeader title="Feedback" description="Anonymous, from students who held a seat." />
        <p className="px-5 py-8 text-center text-sm text-zinc-500 sm:px-6">No feedback yet.</p>
      </Card>
    )
  }
  const most = Math.max(...Object.values(ratingSpread))

  return (
    <Card>
      <CardHeader
        title="Feedback"
        description={`${responses} ${responses === 1 ? 'response' : 'responses'}, anonymous.`}
        action={<p className="flex items-center gap-1 text-lg font-semibold tabular-nums"><Star className="size-5 fill-amber-400 text-amber-400" aria-hidden />{averageRating.toFixed(1)}<span className="text-sm font-normal text-zinc-500"> / 5</span></p>}
      />
      <div className="space-y-6 p-5 sm:p-6">
        <dl className="space-y-1.5" aria-label="Ratings">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-3 text-sm">
              <dt className="w-12 shrink-0 text-zinc-500">{n} {n === 1 ? 'star' : 'stars'}</dt>
              <dd className="flex flex-1 items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${((ratingSpread[n] ?? 0) / most) * 100}%` }} />
                </span>
                <span className="w-6 text-right tabular-nums">{ratingSpread[n] ?? 0}</span>
              </dd>
            </div>
          ))}
        </dl>

        {Object.keys(questions).length > 0 && (
          <dl className="grid gap-4 border-t border-zinc-100 pt-5 sm:grid-cols-2 dark:border-zinc-800">
            {Object.entries(questions).map(([key, tally]) => (
              <div key={key}>
                <dt className="text-sm font-medium">{feedbackQuestionLabel(key)}</dt>
                <dd className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  {Object.entries(tally).map(([answer, n]) => `${feedbackAnswerLabel(answer)} ${n}`).join(' · ')}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {comments.length > 0 && (
          <div className="border-t border-zinc-100 pt-5 dark:border-zinc-800">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium"><MessageSquareText className="size-4 text-zinc-400" aria-hidden /> Comments</h3>
            <ul className="space-y-2">
              {comments.map((c, i) => (
                <li key={i} className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300">{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}
