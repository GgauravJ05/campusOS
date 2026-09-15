import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, CalendarCheck2, CalendarX2, CheckCheck, Flag, MessageSquareWarning, Send } from 'lucide-react'
import { notificationLink, notificationsApi } from '@/features/notifications/notificationsApi'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatRelative } from '@/lib/utils'

const CATEGORY_ICONS = {
  BOOKING_REQUESTED: { icon: Send, cls: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' },
  BOOKING_APPROVED: { icon: CalendarCheck2, cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  BOOKING_REJECTED: { icon: CalendarX2, cls: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
  BOOKING_CHANGES_REQUESTED: { icon: MessageSquareWarning, cls: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400' },
  BOOKING_CANCELLED: { icon: CalendarX2, cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800' },
  CLUB_MEMBERSHIP: { icon: Flag, cls: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400' },
}
const FALLBACK_ICON = { icon: Bell, cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800' }

/** Header bell: unread count, the latest notifications, and a jump to what each one is about. */
export function NotificationBell({ unread, onChange }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState({ state: 'idle', items: [] })
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    notificationsApi.list({ pageSize: 8 }, { signal: controller.signal })
      .then(({ data }) => setList({ state: 'done', items: data }))
      .catch((err) => err.name !== 'AbortError' && setList({ state: 'error', items: [] }))

    const onPointer = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      controller.abort()
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle() {
    if (!open) setList({ state: 'loading', items: [] })
    setOpen((v) => !v)
  }

  async function openNotification(notification) {
    setOpen(false)
    if (!notification.isRead) {
      await notificationsApi.markRead(notification.id).catch(() => {})
      onChange()
    }
    const to = notificationLink(notification)
    if (to) navigate(to)
  }

  async function markAll() {
    await notificationsApi.markAllRead().catch(() => {})
    setList((l) => ({ ...l, items: l.items.map((n) => ({ ...n, isRead: true })) }))
    onChange()
  }

  const hasUnread = unread > 0 || list.items.some((n) => !n.isRead)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative grid size-9 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Bell className="size-[18px]" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-semibold text-white tabular-nums ring-2 ring-zinc-50 dark:ring-zinc-950" aria-hidden>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <section
          aria-label="Notifications"
          className="absolute top-full right-0 z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] animate-scale-in overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lift dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {hasUnread && (
              <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                <CheckCheck className="size-3.5" aria-hidden /> Mark all read
              </button>
            )}
          </div>

          {list.state === 'loading' || list.state === 'idle' ? (
            <div className="grid place-items-center py-10"><Spinner label="Loading notifications" /></div>
          ) : list.state === 'error' ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">Could not load notifications. Try again in a moment.</p>
          ) : list.items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <BellOff className="mb-2 size-6 text-zinc-300 dark:text-zinc-600" aria-hidden />
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="mt-0.5 text-xs text-zinc-500">Decisions on your requests and club news show up here.</p>
            </div>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
              {list.items.map((n) => {
                const { icon: Icon, cls } = CATEGORY_ICONS[n.category] ?? FALLBACK_ICON
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60', !n.isRead && 'bg-brand-50/40 dark:bg-brand-500/5')}
                    >
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', cls)}><Icon className="size-4" aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm', n.isRead ? 'text-zinc-700 dark:text-zinc-300' : 'font-semibold')}>{n.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">{n.message}</span>
                        <span className="mt-1 block text-[11px] text-zinc-400">{formatRelative(n.createdAt)}</span>
                      </span>
                      {!n.isRead && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500"><span className="sr-only">Unread</span></span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
