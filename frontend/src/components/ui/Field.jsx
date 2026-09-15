import { forwardRef, useId, useState } from 'react'
import { Check, ChevronDown, Eye, EyeOff, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { passwordChecks, passwordScore, SCORE_LABELS } from '@/lib/password'

const controlBase = cn(
  'block w-full rounded-lg border bg-white px-3.5 text-[15px] text-zinc-900 shadow-sm transition-colors sm:text-sm',
  'placeholder:text-zinc-400 focus:outline-none focus:ring-4',
  'dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500',
  'disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500 dark:disabled:bg-zinc-800/60',
)

function controlState(error) {
  return error
    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15 dark:border-rose-500/70'
    : 'border-zinc-300 focus:border-brand-500 focus:ring-brand-500/15 dark:border-zinc-700 dark:focus:border-brand-400'
}

/**
 * Label + control + hint/error, wired for screen readers. The child
 * receives `id`, `aria-invalid` and `aria-describedby` via render prop.
 */
export function Field({ label, hint, error, optional, className, children, labelAction }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
            {optional && <span className="ml-1 font-normal text-zinc-400">(optional)</span>}
          </label>
          {labelAction}
        </div>
      )}
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef(function Input({ className, error, icon: Icon, ...props }, ref) {
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />}
      <input ref={ref} className={cn(controlBase, controlState(error), 'h-10', Icon && 'pl-9', className)} {...props} />
    </div>
  )
})

export const Select = forwardRef(function Select({ className, error, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(controlBase, controlState(error), 'h-10 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
    </div>
  )
})

export const PasswordInput = forwardRef(function PasswordInput({ className, error, ...props }, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn(controlBase, controlState(error), 'h-10 pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
})

const SCORE_COLORS = ['bg-zinc-200', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']

/** Live strength meter and rule checklist under a new-password field. */
export function PasswordStrength({ password, email, fullName }) {
  const score = passwordScore(password, { email, fullName })
  const checks = passwordChecks(password, { email, fullName })

  return (
    <div className="space-y-2.5" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={cn(
                'h-1.5 rounded-full transition-colors duration-300',
                score >= step ? SCORE_COLORS[score] : 'bg-zinc-200 dark:bg-zinc-800',
              )}
            />
          ))}
        </div>
        <span className="w-14 text-right text-xs font-medium text-zinc-500">{password ? SCORE_LABELS[score] : ''}</span>
      </div>
      <ul className="space-y-1">
        {checks.map((check) => (
          <li
            key={check.id}
            className={cn('flex items-center gap-2 text-xs', check.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500')}
          >
            {check.ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5 text-zinc-400" aria-hidden />}
            <span>{check.label}</span>
            <span className="sr-only">{check.ok ? '(met)' : '(not met)'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
