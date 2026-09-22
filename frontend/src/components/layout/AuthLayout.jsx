import { Link, Outlet } from 'react-router-dom'
import { CalendarCheck2, ShieldCheck, Users2 } from 'lucide-react'
import { Wordmark } from '@/components/ui/Logo'
import { ThemeToggle } from './ThemeToggle'

const HIGHLIGHTS = [
  { icon: CalendarCheck2, title: 'Conflict-free venues', text: 'Book seminar halls and labs without double bookings.' },
  { icon: Users2, title: 'Every club, one place', text: 'Discover events and reserve your seat in seconds.' },
  { icon: ShieldCheck, title: 'Faculty approvals', text: 'Transparent, audited decisions for every request.' },
]

/** Split screen: brand story on the left (desktop), the form on the right. */
export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-zinc-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -top-40 -left-32 size-[34rem] rounded-full bg-brand-600/35 blur-3xl" />
          <div className="absolute -right-40 bottom-0 size-[30rem] rounded-full bg-accent-600/25 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.5) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            }}
          />
        </div>

        <Link to="/" className="relative text-white">
          <Wordmark />
        </Link>

        <div className="relative max-w-md">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200">
            MMCOE Smart Campus Platform
          </p>
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-white xl:text-5xl">
            Your campus, <span className="bg-gradient-to-r from-brand-300 to-accent-300 bg-clip-text text-transparent">beautifully organised.</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-400">
            Clubs request venues, faculty approve, events go live, and students never miss what matters.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-brand-300">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="block text-sm text-zinc-400">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative text-xs text-zinc-500">
          <small>© {new Date().getFullYear()} Team A6 · Marathwada Mitra Mandal&apos;s College of Engineering, Pune</small>
        </footer>
      </aside>

      <main className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="lg:invisible">
            <Wordmark />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[26rem] animate-slide-up">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}

/** Title block shared by every auth page. */
export function AuthHeading({ icon: Icon, title, children }) {
  return (
    <div className="mb-8">
      {Icon && (
        <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:ring-brand-500/20">
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
      {children && <p className="mt-2 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">{children}</p>}
    </div>
  )
}
