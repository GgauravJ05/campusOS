import { anchorId } from '@/lib/floors'
import { cn } from '@/lib/utils'

/**
 * A row of chips, one per group, that scrolls the page to that group's
 * section: "jump to floor 4" instead of scrolling past three floors of cards.
 */
export function FloorNav({ groups, className }) {
  if (groups.length < 2) return null
  return (
    <nav aria-label="Jump to a floor" className={cn('mb-6 flex gap-1.5 overflow-x-auto pb-1', className)}>
      {groups.map((group) => (
        <button
          key={group.key}
          type="button"
          onClick={() => document.getElementById(anchorId(group.key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-zinc-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
        >
          {group.chip ?? group.title}
          <span className="ml-1.5 text-xs text-zinc-400 tabular-nums">{group.count}</span>
        </button>
      ))}
    </nav>
  )
}

/** One floor: a heading with its department and count, then whatever goes on it. */
export function FloorSection({ group, children }) {
  const id = anchorId(group.key)
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mb-10 scroll-mt-24">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">{group.title}</h2>
        {group.subtitle && <p className="text-sm text-zinc-500 dark:text-zinc-400">{group.subtitle}</p>}
        <p className="ml-auto text-sm text-zinc-400 tabular-nums">{group.count}</p>
      </header>
      {children}
    </section>
  )
}
