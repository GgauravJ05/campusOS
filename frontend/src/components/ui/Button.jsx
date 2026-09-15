import { buttonClasses } from './buttonClasses'
import { Spinner } from './Spinner'

export function Button({ variant, size, loading = false, disabled, className, children, type = 'button', ...props }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner className="size-4" label="Working" />}
      {children}
    </button>
  )
}
