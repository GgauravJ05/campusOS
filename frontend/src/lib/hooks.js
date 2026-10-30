import { useCallback, useEffect, useState } from 'react'

/** Counts down once a second; `restart(n)` starts again from n. */
export function useCountdown(initialSeconds = 0) {
  const [remaining, setRemaining] = useState(initialSeconds)

  useEffect(() => {
    if (remaining <= 0) return undefined
    const timer = setTimeout(() => setRemaining((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  const restart = useCallback((seconds) => setRemaining(seconds), [])
  return [remaining, restart]
}

/** Debounces a fast-changing value, e.g. a search box. */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Sets document.title as "<page> · CampusOS". */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · CampusOS` : 'CampusOS'
  }, [title])
}
