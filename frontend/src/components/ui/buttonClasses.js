import { cn } from '@/lib/utils'

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-600/20 hover:bg-brand-700 active:bg-brand-800 dark:bg-brand-500 dark:hover:bg-brand-400 dark:text-white',
  secondary:
    'bg-white text-zinc-800 ring-1 ring-inset ring-zinc-200 shadow-sm hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800',
  'danger-soft': 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20',
}

const SIZES = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-sm',
  md: 'h-10 gap-2 rounded-lg px-4 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[15px]',
  icon: 'size-9 rounded-lg',
}

/** Button styling, also used to make a <Link> look like a button. */
export function buttonClasses({ variant = 'primary', size = 'md', className } = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}
