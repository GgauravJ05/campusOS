/** Event the app shell listens for to refresh badge counts (a decision, an edit) without waiting for navigation. */
export const SUMMARY_STALE_EVENT = 'campusos:summary-stale'

export function markSummaryStale() {
  window.dispatchEvent(new Event(SUMMARY_STALE_EVENT))
}
