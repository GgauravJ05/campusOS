import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Check } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Surface'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { useDocumentTitle } from '@/lib/hooks'

/**
 * Events arrive in Phase 4. Until their APIs exist these
 * pages describe what is coming rather than showing invented data - the UI
 * is built against the real API, never against mocks.
 */
const MODULES = {
  events: {
    icon: CalendarDays,
    title: 'Events',
    phase: 4,
    tagline: 'Everything happening on campus, in one feed.',
    features: [
      'Discover events filtered by category and department',
      'Reserve a seat in one tap - never overbooked',
      'Personalised recommendations based on your interests',
      'Reminders two days and two hours before it starts',
    ],
  },
}

export default function ModulePreviewPage({ module }) {
  const { icon: Icon, title, phase, tagline, features } = MODULES[module]
  useDocumentTitle(title)

  return (
    <>
      <PageHeader title={title} description={tagline} />
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-brand-500/10 blur-3xl" aria-hidden />
        <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/20">
              <span className="size-1.5 animate-pulse rounded-full bg-brand-500" aria-hidden />
              In development · Phase {phase}
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">{title} is on its way</h2>
            <p className="mt-3 text-zinc-500 dark:text-zinc-400">
              Accounts, roles and venue booking are live today. This module is next on the build plan, and it will appear right here when it ships.
            </p>
            <ul className="mt-6 space-y-3">
              {features.map((feature) => (
                <li key={feature} className="flex gap-3 text-sm">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Check className="size-3" aria-hidden />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <Link to="/dashboard" className={buttonClasses({ variant: 'secondary', className: 'mt-8' })}>
              <ArrowLeft className="size-4" aria-hidden /> Back to dashboard
            </Link>
          </div>

          <div className="relative mx-auto grid w-full max-w-sm place-items-center" aria-hidden>
            <div className="absolute inset-6 rounded-[2rem] bg-gradient-to-br from-brand-500/20 to-violet-500/20 blur-2xl" />
            <div className="relative grid aspect-square w-full grid-cols-3 gap-3 rounded-[2rem] border border-zinc-200/80 bg-white/70 p-6 shadow-lift backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
              {Array.from({ length: 9 }, (_, i) => (
                <div
                  key={i}
                  className={i === 4
                    ? 'grid place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-600/30'
                    : 'rounded-2xl bg-zinc-100 dark:bg-zinc-800'}
                  style={i === 4 ? undefined : { opacity: 0.35 + ((i * 37) % 50) / 100 }}
                >
                  {i === 4 && <Icon className="size-9" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </>
  )
}
