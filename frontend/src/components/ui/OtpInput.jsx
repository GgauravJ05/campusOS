import { useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Six single-digit boxes that behave like one field: typing advances,
 * Backspace goes back, and pasting a whole code (or an SMS autofill) fills
 * every box at once. Calls onComplete when all digits are present.
 */
export function OtpInput({ value, onChange, onComplete, length = 6, disabled, error, autoFocus, label = 'Verification code' }) {
  const refs = useRef([])
  const digits = Array.from({ length }, (_, i) => value[i] || '')

  function commit(next) {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    if (clean.length === length) onComplete?.(clean)
    return clean
  }

  function focus(index) {
    refs.current[Math.max(0, Math.min(length - 1, index))]?.focus()
  }

  function handleChange(index, raw) {
    const typed = raw.replace(/\D/g, '')
    if (!typed) return
    if (typed.length > 1) {
      // Autofill or paste landing in a single box.
      const filled = commit(value.slice(0, index) + typed)
      focus(filled.length)
      return
    }
    const chars = digits.slice()
    chars[index] = typed
    commit(chars.join(''))
    focus(index + 1)
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      // Delete this box's digit, or the previous one if this box is empty.
      const target = digits[index] ? index : index - 1
      if (target < 0) return
      onChange(value.slice(0, target) + value.slice(target + 1))
      focus(target)
    } else if (event.key === 'ArrowLeft') {
      focus(index - 1)
    } else if (event.key === 'ArrowRight') {
      focus(index + 1)
    }
  }

  function handlePaste(event) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!pasted) return
    event.preventDefault()
    const filled = commit(pasted)
    focus(filled.length)
  }

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el
          }}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={length}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-invalid={error ? true : undefined}
          className={cn(
            'h-13 w-full min-w-0 rounded-xl border bg-white text-center text-xl font-semibold tabular-nums shadow-sm transition-all sm:h-14 sm:text-2xl',
            'focus:outline-none focus:ring-4 dark:bg-zinc-900',
            error
              ? 'border-rose-400 focus:ring-rose-500/15'
              : digit
                ? 'border-brand-400 focus:border-brand-500 focus:ring-brand-500/15 dark:border-brand-500/60'
                : 'border-zinc-300 focus:border-brand-500 focus:ring-brand-500/15 dark:border-zinc-700',
            'disabled:opacity-60',
          )}
        />
      ))}
    </div>
  )
}
