import { Link } from 'react-router-dom'
import { Compass, ShieldAlert } from 'lucide-react'
import { buttonClasses } from '@/components/ui/buttonClasses'
import { Logo } from '@/components/ui/Logo'
import { useDocumentTitle } from '@/lib/hooks'

const VARIANTS = {
  notFound: { code: '404', icon: Compass, title: 'This page wandered off', text: "The link may be broken, or the page may have moved." },
  forbidden: { code: '403', icon: ShieldAlert, title: "You don't have access here", text: 'This area is for a different role. Ask your department coordinator if you think that is wrong.' },
}

export default function StatusPage({ variant = 'notFound' }) {
  const { code, icon: Icon, title, text } = VARIANTS[variant]
  useDocumentTitle(title)

  return (
    <div className="grid min-h-[70dvh] place-items-center px-6 py-16">
      <div className="max-w-md animate-slide-up text-center">
        <div className="relative mx-auto mb-8 grid size-20 place-items-center">
          <Logo className="absolute size-20 opacity-10 blur-sm" />
          <span className="grid size-16 place-items-center rounded-2xl bg-white text-brand-600 shadow-lift ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-brand-400 dark:ring-zinc-800">
            <Icon className="size-8" aria-hidden />
          </span>
        </div>
        <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">Error {code}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-zinc-500 dark:text-zinc-400">{text}</p>
        <Link to="/" className={buttonClasses({ size: 'lg', className: 'mt-8' })}>Take me home</Link>
      </div>
    </div>
  )
}
