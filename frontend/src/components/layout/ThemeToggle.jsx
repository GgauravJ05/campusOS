import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/features/theme/ThemeProvider'

const NEXT = { light: 'dark', dark: 'system', system: 'light' }
const ICON = { light: Sun, dark: Moon, system: Monitor }
const LABEL = { light: 'Light theme', dark: 'Dark theme', system: 'System theme' }

/** Cycles light → dark → system. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = ICON[theme]
  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      className="grid size-9 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      aria-label={`${LABEL[theme]} (switch to ${LABEL[NEXT[theme]].toLowerCase()})`}
      title={LABEL[theme]}
    >
      <Icon className="size-[18px]" />
    </button>
  )
}
