import { cn } from '@/lib/utils'
import { Logo } from './Logo'

export function Spinner({ className, label = 'Loading' }) {
  return (
    <svg className={cn('size-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" role="img" aria-label={label}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading CampusOS">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <Logo className="size-11 animate-pulse" />
        <Spinner className="size-5 text-brand-500" />
      </div>
    </div>
  )
}
