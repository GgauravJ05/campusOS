import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarCheck2, CalendarDays, ChevronsUpDown, Flag, LayoutDashboard, LogOut, Menu, MapPin, ShieldCheck, UserRound, UsersRound, X,
} from 'lucide-react'
import { useAuth } from '@/features/auth/authContext'
import { bookingsApi } from '@/features/bookings/bookingsApi'
import { useToast } from '@/components/ui/Toast'
import { Wordmark } from '@/components/ui/Logo'
import { Avatar, Badge } from '@/components/ui/Surface'
import { ThemeToggle } from './ThemeToggle'
import { NotificationBell } from './NotificationBell'
import { cn, FACULTY_ROLES, ROLE_META } from '@/lib/utils'
import { SUMMARY_STALE_EVENT } from '@/lib/summary'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/events', label: 'Events', icon: CalendarDays, soon: true },
  { to: '/venues', label: 'Venues', icon: MapPin },
  { to: '/bookings', label: 'Bookings', icon: CalendarCheck2, roles: ['CLUB_HEAD', 'CLUB_MEMBER', ...FACULTY_ROLES], badge: 'bookings' },
  { to: '/clubs', label: 'Clubs', icon: Flag },
  { to: '/users', label: 'People', icon: UsersRound, roles: FACULTY_ROLES },
  { to: '/profile', label: 'Profile & security', icon: UserRound },
]

/** What needs the user's attention on the Bookings page: decisions for faculty, sent-back requests for clubs. */
function bookingsBadge(role, summary) {
  if (!summary) return { count: 0, label: '' }
  if (FACULTY_ROLES.includes(role)) {
    const n = summary.awaitingDecision
    return { count: n, label: `${n} ${n === 1 ? 'request' : 'requests'} waiting for your decision` }
  }
  const n = summary.myChangesRequested
  return { count: n, label: `${n} ${n === 1 ? 'request needs' : 'requests need'} changes` }
}

function NavItems({ role, summary, onNavigate }) {
  return (
    <nav aria-label="Main" className="space-y-1">
      {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)).map(({ to, label, icon: Icon, soon, badge }) => {
        const attention = badge ? bookingsBadge(role, summary) : { count: 0 }
        return (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cn('size-[18px]', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300')} aria-hidden />
              <span className="flex-1">{label}</span>
              {soon && <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase dark:bg-zinc-800">Soon</span>}
              {attention.count > 0 && (
                <>
                  <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white tabular-nums" aria-hidden>{attention.count}</span>
                  <span className="sr-only">, {attention.label}</span>
                </>
              )}
            </>
          )}
        </NavLink>
        )
      })}
    </nav>
  )
}

function UserMenu({ user }) {
  const { logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleLogout() {
    setOpen(false)
    await logout().catch(() => {})
    toast.info('Signed out', 'See you soon.')
    navigate('/login', { replace: true })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/70"
      >
        <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.fullName}</span>
          <span className="block truncate text-xs text-zinc-500">{ROLE_META[user.role.key]?.short}</span>
        </span>
        <ChevronsUpDown className="size-4 text-zinc-400" aria-hidden />
      </button>

      {open && (
        <div role="menu" className="absolute bottom-full left-0 z-20 mb-2 w-full min-w-56 animate-scale-in overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-lift dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
          <Link role="menuitem" to="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <ShieldCheck className="size-4 text-zinc-400" aria-hidden /> Profile & security
          </Link>
          <button role="menuitem" type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function SidebarContent({ user, summary, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link to="/dashboard" onClick={onNavigate}><Wordmark /></Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavItems role={user.role.key} summary={summary} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-zinc-200/80 p-3 dark:border-zinc-800">
        <UserMenu user={user} />
      </div>
    </div>
  )
}

/** Signed-in frame: fixed sidebar on desktop, slide-over drawer on mobile. */
export function AppShell() {
  const { user } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()
  const [summary, setSummary] = useState(null)
  const [summaryVersion, setSummaryVersion] = useState(0)

  // Badge counts refresh on every navigation, after an in-page decision, and once a minute.
  useEffect(() => {
    const controller = new AbortController()
    bookingsApi.summary({ signal: controller.signal }).then(setSummary).catch(() => {})
    return () => controller.abort()
  }, [location.pathname, location.search, summaryVersion])

  useEffect(() => {
    const refresh = () => setSummaryVersion((v) => v + 1)
    const timer = setInterval(refresh, 60_000)
    window.addEventListener(SUMMARY_STALE_EVENT, refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener(SUMMARY_STALE_EVENT, refresh)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-lift">
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-200/80 bg-white/80 backdrop-blur lg:block dark:border-zinc-800 dark:bg-zinc-950/80">
        <SidebarContent user={user} summary={summary} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 animate-fade-in bg-zinc-950/40" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-slide-up bg-white shadow-lift dark:bg-zinc-950">
            <button type="button" onClick={() => setDrawerOpen(false)} className="absolute top-4 right-3 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close navigation">
              <X className="size-5" />
            </button>
            <SidebarContent user={user} summary={summary} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-zinc-200/80 bg-zinc-50/80 px-4 backdrop-blur sm:px-6 lg:px-10 dark:border-zinc-800 dark:bg-zinc-950/80">
          <button type="button" onClick={() => setDrawerOpen(true)} className="-ml-1 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 lg:hidden dark:hover:bg-zinc-800" aria-label="Open navigation">
            <Menu className="size-5" />
          </button>
          <Link to="/dashboard" className="lg:hidden"><Wordmark /></Link>
          <div className="flex-1" />
          {!user.isVerified && <Badge tone="amber">Email not verified</Badge>}
          <NotificationBell unread={summary?.unreadNotifications ?? 0} onChange={() => setSummaryVersion((v) => v + 1)} />
          <ThemeToggle />
        </header>

        <main id="main" key={location.pathname} className="mx-auto w-full max-w-6xl animate-fade-in px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PageHeader({ title, description, actions, eyebrow }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-sm font-medium text-brand-600 dark:text-brand-400">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

