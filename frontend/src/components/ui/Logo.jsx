import { useId } from 'react'
import { cn } from '@/lib/utils'

export function Logo({ className }) {
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9 shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9c4a22" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <path d="M32 14 12 24l20 10 20-10-20-10Z" fill="#fff" />
      <path d="M20 30v10c0 3.3 5.4 7 12 7s12-3.7 12-7V30l-12 6-12-6Z" fill="#fff" fillOpacity=".82" />
      <path d="M50 25v12" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark({ className }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Logo />
      <span className="text-lg font-semibold tracking-tight">
        Campus<span className="text-brand-600 dark:text-brand-400">OS</span>
      </span>
    </span>
  )
}
