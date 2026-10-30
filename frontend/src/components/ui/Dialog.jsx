import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal: focus moves in and is trapped, Escape and the backdrop
 * close it (unless `busy`), focus returns to the opener, and the page
 * behind stops scrolling.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', busy = false }) {
  const panelRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  // Read through refs so the effect runs once per opening. Depending on
  // `onClose` directly would re-run it on every parent render and yank focus
  // back to the first field mid-typing.
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)
  useEffect(() => {
    onCloseRef.current = onClose
    busyRef.current = busy
  })

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    const panel = panelRef.current
    const first = panel?.querySelector(FOCUSABLE)
    ;(first || panel)?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.stopPropagation()
        onCloseRef.current()
      }
      if (event.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll(FOCUSABLE)]
        if (items.length === 0) return
        const firstItem = items[0]
        const lastItem = items[items.length - 1]
        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault()
          lastItem.focus()
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault()
          firstItem.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 animate-fade-in bg-zinc-950/40 backdrop-blur-[2px]"
        onClick={() => !busy && onClose()}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-scale-in flex-col rounded-t-2xl bg-white shadow-lift sm:rounded-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800',
          size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="-mr-2 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-2">{children}</div>
        {footer && (
          <div className="mt-2 flex flex-col-reverse gap-2 border-t border-zinc-100 px-6 py-4 sm:flex-row sm:justify-end dark:border-zinc-800">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
